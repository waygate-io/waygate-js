import { Client } from './lib/muxado-js/index.js';
import { Server, parseRangeHeader } from './lib/http-js/index.js';
import { openFile } from './lib/fs-js/index.js';

const f = await openFile("./package.json");

const dec = new TextDecoder('utf-8');

for await (const chunk of f.readable) {
  console.log(dec.decode(chunk));
}

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

  const f = await openFile("./package.json");

  return new Response(f.readable, {
  });
});
