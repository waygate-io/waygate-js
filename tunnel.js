async function webtransportConnect({ serverDomain, token }) {

  const encoder = new TextEncoder();
  const decoder = new TextDecoder('utf8');

  const wt = new WebTransport(`https://${serverDomain}/waygate`);

  await wt.ready;
  const setupStream = await wt.createBidirectionalStream();
  const tunReq = {
    token: token,
    termination_type: "server",
    use_proxy_protocol: false,
  };

  const tunReqJson = JSON.stringify(tunReq, null, 2);
  const tunReqBytes = encoder.encode(tunReqJson);

  const writer = setupStream.writable.getWriter();
  const reader = setupStream.readable.getReader();
  writer.write(tunReqBytes);
  await writer.close();

  const { value, done } = await reader.read();

  const tunRes = JSON.parse(decoder.decode(value));

  const incoming = wt.incomingBidirectionalStreams.getReader();

  return {
    domain: tunRes.domain,
    accept: async () => {
      const res = await incoming.read();
      return res.value;
    },
  };
}

export {
  webtransportConnect,
};
