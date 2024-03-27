import { WebTransport as WebSocketTransportOmni } from './lib/muxado-js/index.js';
import { Server as HttpServer, directoryTreeHandler } from './lib/http-js/index.js';
import { openDirectory } from './lib/fs-js/index.js';
//import { getToken } from './lib/oauth2-js/index.js';

const DEFAULT_WAYGATE_DOMAIN = "waygate.io";

const MESSAGE_TYPE_TUNNEL_CONFIG = 0;
const MESSAGE_TYPE_SUCCESS = 1;
const MESSAGE_TYPE_ERROR = 2;
const MESSAGE_TYPE_STREAM = 3;

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
          (async() => {
            await sleep(1000);
            writer.close()
          })();

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
  let serverDomain = DEFAULT_WAYGATE_DOMAIN;
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
    if (options.serverDomain) {
      serverDomain = options.serverDomain;
    }
    if (options.token) {
      token = options.token;
    }
  }

  let WebTransportType = WebSocketTransportOmni;
  if (webtransportSupported() && tunnelType !== 'websocket') {
    WebTransportType = WebTransport;
  }

  const conn = new WebTransportType(`https://${serverDomain}/waygate?token=${token}&termination-type=server`);
  return wrapWebTransport(conn);
}

async function serve(listener, handler) {
  const httpServer = new HttpServer();
  return httpServer.serve(listener, handler);
}

function webtransportSupported() {
  return 'WebTransport' in globalThis;
}

async function startTokenFlow(waygateUri) {

  if (!waygateUri) {
    waygateUri = `https://${DEFAULT_WAYGATE_DOMAIN}/oauth2`;
  }

  const clientId = window.location.origin;
  const redirectUri = clientId;

  const state = genRandomText(32);
  const authUri = `${waygateUri}/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&state=${state}&response_type=code&scope=waygate`;

  const authRequest = {
    waygateUri,
    clientId,
    redirectUri,
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

  const res = await fetch(authRequest.waygateUri + "/token", {
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
  window.history.pushState({}, '', '/');
}

function getToken() {
  return localStorage.getItem('waygate_token');
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

async function sleep(ms) {
  return new Promise((resolve, reject) => {
    setTimeout(resolve, ms);
  });
}

export {
  getToken,
  checkTokenFlow,
  startTokenFlow,
  listen,
  serve,
  HttpServer,
  openDirectory,
  directoryTreeHandler,
};
