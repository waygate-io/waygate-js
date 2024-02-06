import { Client } from './lib/muxado-js/index.js';
import { Server, directoryTreeHandler, parseRangeHeader } from './lib/http-js/index.js';
import { openFile, openDirectory } from './lib/fs-js/index.js';

const SERVER_DOMAIN = "anderspitman.net";
const TUNNEL_DOMAIN = "test.anderspitman.net";

const session = new Client({
  serverDomain: SERVER_DOMAIN,
  tunnelDomain: TUNNEL_DOMAIN,
  token: "yolo",
});

const httpServer = new Server({
  domain: TUNNEL_DOMAIN,
});

const dir = await openDirectory(".");
const handler = directoryTreeHandler(dir)

console.log("serve");
httpServer.serve(session, handler);
