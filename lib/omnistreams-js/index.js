const DEFAULT_WINDOW_SIZE = 256*1024;

const FRAME_TYPE_DATA = 0x01;

async function connect() {

  const ws = new WebSocket(`ws://localhost:3000`);
  ws.binaryType = 'arraybuffer';

  await new Promise((resolve, reject) => {
    ws.onopen = (evt) => {
      resolve();
    };

    ws.onmessage = (evt) => {

      console.log(evt);

      const frameArray = new Uint8Array(evt.data);

      console.log(frameArray);

      const frame = unpackFrame(frameArray);

      console.log(frame);

      switch (frame.type) {
        case FRAME_TYPE_DATA: {
          console.log("FRAME_TYPE_DATA", frame);
          break;
        }
      }
    };

    ws.onclose = (evt) => {
      console.log(evt);
    };

    ws.onerror = (evt) => {
      console.error(evt);
    };
  });

  return new Connection(ws);
}

class Connection {
  constructor(ws) {
    this._ws = ws;
    this._nextStreamId = 0;
  }

  openStream() {

    const writeCallback = (streamId, data) => {

      const packedFrame = packFrame({
        type: FRAME_TYPE_DATA,
        fin: false,
        streamId: streamId,
        data: data,
      });

      this._ws.send(packedFrame);
    };

    const streamId = this._nextStreamId;
    this._nextStreamId += 2;

    return new Stream(streamId, writeCallback);
  }
}

class Stream {

  constructor(streamId, writeCallback) {

    this._streamId = streamId;
    this._writeCallback = writeCallback;
    this._windowSize = DEFAULT_WINDOW_SIZE;

    const stream = this;

    this.readable = new ReadableStream({
      start(controller) {
        stream._readableController = controller;
        stream._enqueue = (data) => {
          controller.enqueue(data);
        };
      },

      cancel() {
        // TODO: should probably be doing something here...
        //console.log("reader cancel signal");
      }
    });

    this.writable = new WritableStream({

      start(controller) {
      },

      write(chunk, controller) {
        return stream._attemptSend(chunk);
      },

      close() {
        //console.log("writer close signal");
        stream._closeCallback(stream._streamId);
      }
    });
  }

  async _attemptSend(data) {
    if (this._done) {
      return;
    }

    if (data.length < this._windowSize) {
      this._writeCallback(this._streamId, data);
      this._windowSize -= data.length;
      this._windowResolve = null;
    }
    else {
      await new Promise((resolve, reject) => {
        this._windowResolve = resolve;
        this._writeReject = reject;
      });

      return this._attemptSend(data);
    }
  }
}

const HEADER_SIZE = 6;

function packFrame(frame) {

  let length = 0;

  if (frame.data !== undefined) {
    length = frame.data.length;
  }

  const fin = frame.fin === true ? 1 : 0;

  const buf = new Uint8Array(HEADER_SIZE + length);
  buf[0] = frame.type;
  buf[1] = fin;
  buf[2] = frame.streamId >> 24;
  buf[3] = frame.streamId >> 16;
  buf[4] = frame.streamId >> 8;
  buf[5] = frame.streamId;

  if (frame.data !== undefined) {
    buf.set(frame.data, HEADER_SIZE);
  }

  return buf;
}

function unpackFrame(frameArray) {
  const fa = frameArray;
  const type = fa[0];
  const fin = fa[1] === 1;
  const streamId = (fa[2] << 24) | (fa[3] << 16) | (fa[4] << 8) | fa[5];

  const frame = {
    type,
    fin,
    streamId,
  };

  const data = frameArray.slice(HEADER_SIZE);
  frame.data = new Uint8Array(data.length);
  frame.data.set(data, 0);
  //frame.bytesReceived = data.length;

  //switch (frame.type) {
  //  case FRAME_TYPE_WNDINC:
  //    frame.windowIncrease = (data[0] << 24) | (data[1] << 16) | (data[2] << 8) | data[3];
  //    break;
  //  case FRAME_TYPE_RST:
  //    frame.errorCode = unpackUint32(data);
  //    break;
  //}

  return frame;
}

export {
  connect,
};
