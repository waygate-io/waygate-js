import { connect, HttpServer, openDirectory, directoryTreeHandler, checkTokenFlow } from './lib/waygate-js/index.js';
import { argv } from './lib/waygate-js/utils.js';

const SERVER_DOMAIN = "anderspitman.net";

const rootDir = argv[2];

(async () => {

  const muxSession = await connect({
    serverDomain: SERVER_DOMAIN,
    token: "yolo",
  });

  const listener = muxSession;

  const server = new HttpServer({
    domain: muxSession.domain,
  });

  const dir = await openDirectory(rootDir);
  const handler = directoryTreeHandler(dir)

  console.log("Running");
  server.serve(listener, handler);
})();
