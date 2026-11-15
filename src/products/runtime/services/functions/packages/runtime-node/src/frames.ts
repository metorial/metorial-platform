export let MAX_FRAME_BYTES = 64 * 1024 * 1024;

export interface FrameError {
  code: string;
  message: string;
  status?: number;
  reason?: string;
}

export interface Frame {
  type: string;
  requestId?: string;
  payload?: any;
  context?: { invocationId: string; deadlineMs: number };
  ts?: number;
  stream?: 'stdout' | 'stderr';
  line?: string;
  id?: string;
  hostname?: string;
  addresses?: string[];
  tunnelId?: string;
  host?: string;
  port?: number;
  phase?: 'boot' | 'runtime';
  message?: string;
  stack?: string;
  error?: FrameError;
}

export let encodeJson = (json: string) => {
  let body = Buffer.from(json, 'utf8');
  let header = Buffer.allocUnsafe(4);
  header.writeUInt32BE(body.length, 0);
  return Buffer.concat([header, body]);
};

export let encodeFrame = (frame: Frame) => encodeJson(JSON.stringify(frame));

export class FrameDecoder {
  #chunks: Buffer[] = [];
  #buffered = 0;

  push(chunk: Buffer, max = Infinity): Frame[] {
    this.#chunks.push(chunk);
    this.#buffered += chunk.length;

    let frames: Frame[] = [];
    while (this.#buffered >= 4 && frames.length < max) {
      let buffer = this.#flatten();
      let length = buffer.readUInt32BE(0);
      if (length > MAX_FRAME_BYTES)
        throw new Error(`frame of ${length} bytes exceeds the limit`);
      if (buffer.length < 4 + length) break;

      let frame = JSON.parse(buffer.subarray(4, 4 + length).toString('utf8'));
      if (typeof frame?.type != 'string') throw new Error('frame without a type');
      frames.push(frame);

      let rest = buffer.subarray(4 + length);
      this.#chunks = rest.length ? [rest] : [];
      this.#buffered = rest.length;
    }
    return frames;
  }

  rest() {
    let rest = this.#chunks.length ? this.#flatten() : Buffer.alloc(0);
    this.#chunks = [];
    this.#buffered = 0;
    return rest;
  }

  #flatten() {
    if (this.#chunks.length > 1) this.#chunks = [Buffer.concat(this.#chunks)];
    return this.#chunks[0]!;
  }
}
