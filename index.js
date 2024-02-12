import { connect as muxadoConnect } from './lib/muxado-js/index.js';
import { Server as HttpServer, directoryTreeHandler } from './lib/http-js/index.js';
import { openDirectory } from './lib/fs-js/index.js';
//import { getToken } from './lib/oauth2-js/index.js';

async function connect({ serverDomain, tunnelDomain, token }) {

  const muxSession = await muxadoConnect({
    serverDomain,
    token,
  });

  return muxSession;
}

async function startTokenFlow(waygateUri) {
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

export {
  getToken,
  checkTokenFlow,
  startTokenFlow,
  connect,
  HttpServer,
  openDirectory,
  directoryTreeHandler,
};
