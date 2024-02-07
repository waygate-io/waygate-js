import { connect } from './lib/muxado-js/index.js';
import { Server as HttpServer, directoryTreeHandler } from './lib/http-js/index.js';
import { openDirectory } from './lib/fs-js/index.js';

const SERVER_DOMAIN = "anderspitman.net";
const TUNNEL_DOMAIN = "test.anderspitman.net";

(async () => {

  const muxSession = await connect({
    serverDomain: SERVER_DOMAIN,
    tunnelDomain: TUNNEL_DOMAIN,
    token: "yolo",
  });

  const listener = muxSession;

  const server = new HttpServer({
    domain: TUNNEL_DOMAIN,
  });

  const dir = await openDirectory(".");
  const handler = directoryTreeHandler(dir)

  console.log("Running");
  server.serve(listener, handler);
})();
