import { Client } from './lib/muxado-js/index.js';
import { Server, parseRangeHeader } from './lib/http-js/index.js';

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

console.log("serve");
httpServer.serve(session, async (r) => {
  console.log(r);
  return new Response("Hi there", {
  });
});
