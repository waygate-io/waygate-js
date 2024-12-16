import omnistreams from './lib/omnistreams-js/index.js';
import { Server as HttpServer, directoryTreeHandler } from './lib/http-js/index.js';
import { openDirectory } from './lib/fs-js/index.js';
//import { getToken } from './lib/oauth2-js/index.js';

const MESSAGE_TYPE_TUNNEL_CONFIG = 0;
const MESSAGE_TYPE_SUCCESS = 1;
const MESSAGE_TYPE_ERROR = 2;
const MESSAGE_TYPE_STREAM = 3;

let serverUri = `https://waygate.io`;

function setServerUri(uri) {
  serverUri = uri;
}

function wrapWebTransportStream(stream, firstMessage) {

  const { readable, writable } = new TransformStream();

  const writer = writable.getWriter();

  // TODO: this feels like a race condition
  (async () => {
    await writer.write(firstMessage);
    writer.releaseLock();
  })();

  return {
    readable,
    writable: stream.writable,
  }
}

async function wrapWebTransport(wtConn) {

  await wtConn.ready;

  const { readable, writable } = new TransformStream();

  //const streamReader = readable.getReader();
  const streamWriter = writable.getWriter();

  const incomingStreamsReader = wtConn.incomingBidirectionalStreams.getReader();

  let onTunConfig;
  const tunConfigPromise = new Promise((resolve, reject) => {
    onTunConfig = resolve;
  });

  (async () => {
    //for await (const stream of wtConn.incomingBidirectionalStreams) {
    while (true) {
      const incomingStream = await incomingStreamsReader.read();
      const stream = incomingStream.value;

      const reader = stream.readable.getReader();

      const { value, done } = await reader.read();
      reader.releaseLock();

      const msg = value;

      const msgType = msg[0];

      switch (msgType) {
        case MESSAGE_TYPE_TUNNEL_CONFIG: {

          const tunConfig = JSON.parse(new TextDecoder().decode(msg.slice(1)));

          onTunConfig(tunConfig);

          const writer = stream.writable.getWriter();
          await writer.write(new Uint8Array([MESSAGE_TYPE_SUCCESS]));

          // TODO: this is a hack. When using WebTransport, it was closing the
          // stream before the reponse code got received by the server. Need
          // to figure out a way to close while guaranteeing any previous
          // writes have been received.
          //(async() => {
          //  await sleep(1000);
          //  writer.close()
          //})();

          await writer.close()

          break;
        }
        case MESSAGE_TYPE_STREAM: {

          await streamWriter.write(wrapWebTransportStream(stream, msg.slice(1)));

          break;
        }
        default: {
          throw new Error("Unknown message type: " + msgType);
        }
      }

      if (incomingStream.done) {
        break;
      }
    }
  })();

  const tunConfig = await tunConfigPromise;

  return {
    connectionStream: readable,

    getDomain() {
      return tunConfig.domain;
    }
  };
}

async function listen(options) {

  let tunnelType = 'webtransport';
  let token = "";

  if (options) {
    if (options.tunnelType) {
      tunnelType = options.tunnelType;
      if (tunnelType !== 'webtransport' && tunnelType !== 'websocket') {
        throw new Error("Unknown tunnel type: " + tunnelType);
      }
      if (tunnelType === 'webtransport' && !webtransportSupported()) {
        throw new Error("WebTransport not supported by your JavaScript runtime");
      }
    }
    if (options.token) {
      token = options.token;
    }
  }

  let WebTransportType = omnistreams.WebTransport;
  if (webtransportSupported() && tunnelType !== 'websocket') {
    WebTransportType = WebTransport;
  }

  const conn = new WebTransportType(`${serverUri}/waygate?token=${token}&termination-type=server`);
  return wrapWebTransport(conn);
}

async function serve(listener, handler) {
  const httpServer = new HttpServer();
  return httpServer.serve(listener, handler);
}

function webtransportSupported() {
  return 'WebTransport' in globalThis;
}

async function startTokenFlow() {

  const clientId = window.location.origin;
  const redirectUri = window.location.href;

  const state = genRandomText(32);

  const pkceVerifier = genRandomText(32);
  const pkceChallenge = generateCodeChallengeFromVerifier(pkceVerifier);

  const authUri = `${serverUri}/oauth2/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&state=${state}&response_type=code&scope=waygate&code_challenge_method=S256&code_challenge=${pkceChallenge}`;

  const authRequest = {
    serverUri,
    clientId,
    redirectUri,
    pkceVerifier,
  };

  localStorage.setItem(state, JSON.stringify(authRequest));
  window.location.href = authUri;
}

async function checkTokenFlow() {
  const params = new URLSearchParams(window.location.search);
  const code = params.get('code');
  const state = params.get('state');

  if (!code || !state) {
    return;
  }

  const authRequestJson = localStorage.getItem(state);

  if (!authRequestJson) {
    throw new Error("No such auth request");
  }

  const authRequest = JSON.parse(authRequestJson);

  const res = await fetch(authRequest.serverUri + "/oauth2/token", {
    method: 'POST',
    headers:{
      'Content-Type': 'application/x-www-form-urlencoded'
    },    
    body: new URLSearchParams({
      code,
      client_id: authRequest.clientId,
      redirect_uri: authRequest.redirectUri,
      grant_type: 'authorization_code',
    }),
  });

  const json = await res.json();
  localStorage.setItem('waygate_token', json.access_token);
  localStorage.removeItem(state);
  window.history.pushState({}, '', authRequest.redirectUri);
}

async function getToken() {

  await checkTokenFlow();

  const token = localStorage.getItem('waygate_token');
  if (!token) {
    await startTokenFlow();
  }

  return token;
}

function genRandomText(len) {
  const possible = "0123456789abcdefghijkmnpqrstuvwxyz";

  let text = "";
  for (let i = 0; i < len; i++) {
    const randIndex = Math.floor(Math.random() * possible.length);
    text += possible[randIndex];
  }

  return text;
}

// Taken from https://stackoverflow.com/a/63336562/943814
function sha256(plain) {
  // returns promise ArrayBuffer
  const encoder = new TextEncoder();
  const data = encoder.encode(plain);
  return window.crypto.subtle.digest("SHA-256", data);
}
function base64urlencode(a) {
  var str = "";
  var bytes = new Uint8Array(a);
  var len = bytes.byteLength;
  for (var i = 0; i < len; i++) {
    str += String.fromCharCode(bytes[i]);
  }
  return btoa(str)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}
async function generateCodeChallengeFromVerifier(v) {
  var hashed = await sha256(v);
  var base64encoded = base64urlencode(hashed);
  return base64encoded;
}

async function sleep(ms) {
  return new Promise((resolve, reject) => {
    setTimeout(resolve, ms);
  });
}

export {
  setServerUri,
  getToken,
  checkTokenFlow,
  startTokenFlow,
  listen,
  serve,
  HttpServer,
  openDirectory,
  directoryTreeHandler,
};
