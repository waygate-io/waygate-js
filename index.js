import { connect as muxadoConnect } from './lib/muxado-js/index.js';
import { Server as HttpServer, directoryTreeHandler } from './lib/http-js/index.js';
import { openDirectory } from './lib/fs-js/index.js';

async function connect({ serverDomain, tunnelDomain, token }) {

  const muxSession = await muxadoConnect({
    serverDomain,
    token,
  });

  return muxSession;
}

export {
  connect,
  HttpServer,
  openDirectory,
  directoryTreeHandler,
};
