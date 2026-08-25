/**
 * Ceiling on a downloaded logo.
 *
 * Logos are kilobytes in practice, but the URL can point at an arbitrary
 * uploaded file, and a sync that embeds one holds it in memory. The cap is
 * generous enough that no real logo hits it.
 */
export let maxDownloadedImageBytes = 8 * 1024 * 1024;

export class ImageTooLargeError extends Error {
  constructor(size: number, maxBytes: number) {
    super(`Image is ${size} bytes, which exceeds the ${maxBytes} byte limit`);
    this.name = 'ImageTooLargeError';
  }
}

/**
 * Reads a response body, refusing to buffer more than `maxBytes`.
 *
 * The declared length is only a hint, so the body is also measured as it
 * arrives: a wrong or absent Content-Length must not become an unbounded read.
 */
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
