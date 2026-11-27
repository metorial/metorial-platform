export type LineEnding = 'lf' | 'crlf';

let BOM_BYTES = [0xef, 0xbb, 0xbf];

export interface TextChunkDecoder {
  decode(chunk: Uint8Array, last: boolean): string;
}

export let hasUtf8Bom = (bytes: Uint8Array) =>
  bytes.length >= BOM_BYTES.length && BOM_BYTES.every((byte, i) => bytes[i] == byte);

export let detectLineEnding = (text: string): LineEnding => {
  let crlf = (text.match(/\r\n/g) ?? []).length;
  if (!crlf) return 'lf';

  let lf = (text.match(/\n/g) ?? []).length - crlf;

  return crlf >= lf ? 'crlf' : 'lf';
};

export let normalizeLineEndings = (text: string) => text.replace(/\r\n?/g, '\n');

export let applyLineEnding = (text: string, ending: LineEnding) => {
  let normalized = normalizeLineEndings(text);
  return ending == 'crlf' ? normalized.replace(/\n/g, '\r\n') : normalized;
};

export let createTextChunkDecoder = (): TextChunkDecoder => {
  let decoder = new TextDecoder('utf-8', { fatal: true });

  return {
    decode: (chunk, last) => decoder.decode(chunk, { stream: !last })
  };
};

export let decodeUtf8 = (bytes: Uint8Array): string | null => {
  try {
    return createTextChunkDecoder().decode(bytes, true);
  } catch {
    return null;
  }
};

export let encodeText = (text: string, opts: { lineEnding: LineEnding; bom: boolean }) => {
  let body = new TextEncoder().encode(applyLineEnding(text, opts.lineEnding));
  if (!opts.bom) return body;

  let result = new Uint8Array(BOM_BYTES.length + body.length);
  result.set(BOM_BYTES, 0);
  result.set(body, BOM_BYTES.length);

  return result;
};
