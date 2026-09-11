import { describe, expect, it } from 'vitest';

import { ImageTooLargeError, readBoundedResponse } from './boundedFetch';

let responseOf = (body: Uint8Array, headers: Record<string, string> = {}) =>
  new Response(body, { headers });

describe('readBoundedResponse', () => {
  it('reads a body within the limit', async () => {
    let body = new Uint8Array([1, 2, 3]);

    let result = await readBoundedResponse(responseOf(body), 100);

    expect(Buffer.from(result)).toEqual(Buffer.from(body));
  });

  it('rejects a declared length over the limit before reading', async () => {
    let response = responseOf(new Uint8Array(10), { 'content-length': '999999' });

    await expect(readBoundedResponse(response, 100)).rejects.toBeInstanceOf(
      ImageTooLargeError
    );
  });

  it('rejects a body that exceeds the limit despite a missing length', async () => {
    // A wrong or absent Content-Length must not become an unbounded read.
    let response = new Response(new Uint8Array(500));
    response.headers.delete('content-length');

    await expect(readBoundedResponse(response, 100)).rejects.toBeInstanceOf(
      ImageTooLargeError
    );
  });

  it('accepts a body exactly at the limit', async () => {
    let result = await readBoundedResponse(responseOf(new Uint8Array(100)), 100);

    expect(result.byteLength).toBe(100);
  });

  it('handles an empty body', async () => {
    let result = await readBoundedResponse(responseOf(new Uint8Array(0)), 100);

    expect(result.byteLength).toBe(0);
  });

  it('reports the limit in the error message', async () => {
    let response = responseOf(new Uint8Array(10), { 'content-length': '999' });

    await expect(readBoundedResponse(response, 100)).rejects.toThrow(
      'exceeds the 100 byte limit'
    );
  });
});
