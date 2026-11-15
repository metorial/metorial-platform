export let maxDownloadedImageBytes = 8 * 1024 * 1024;

export class ImageTooLargeError extends Error {
  constructor(size: number, maxBytes: number) {
    super(`Image is ${size} bytes, which exceeds the ${maxBytes} byte limit`);
    this.name = 'ImageTooLargeError';
  }
}

export let readBoundedResponse = async (
  response: Response,
  maxBytes: number
): Promise<Buffer> => {
  let declared = Number(response.headers.get('content-length'));
  if (Number.isFinite(declared) && declared > maxBytes) {
    throw new ImageTooLargeError(declared, maxBytes);
  }

  if (!response.body) return Buffer.alloc(0);

  let chunks: Uint8Array[] = [];
  let total = 0;

  for await (let chunk of response.body as any as AsyncIterable<Uint8Array>) {
    total += chunk.byteLength;
    if (total > maxBytes) throw new ImageTooLargeError(total, maxBytes);

    chunks.push(chunk);
  }

  return Buffer.concat(chunks);
};
