import { beforeEach, describe, expect, it, vi } from 'vitest';

let mocks = vi.hoisted(() => ({ guardedFetch: vi.fn() }));

vi.mock('../src/lib/fetch', async importOriginal => ({
  ...(await importOriginal<typeof import('../src/lib/fetch')>()),
  guardedFetch: mocks.guardedFetch
}));

import { createFetchBudget } from '../src/lib/fetch';
import { ImageRejectedError, probeImage, sniffImageFormat } from '../src/lib/imageProbe';

let pngBytes = (width: number, height: number) => {
  let bytes = new Uint8Array(33);
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  bytes.set([0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52], 8);

  let view = new DataView(bytes.buffer);
  view.setUint32(16, width);
  view.setUint32(20, height);

  return bytes;
};

let text = (value: string) => new TextEncoder().encode(value);

describe('sniffImageFormat', () => {
  it('detects formats from magic bytes', () => {
    expect(sniffImageFormat(pngBytes(1, 1))).toBe('png');
    expect(sniffImageFormat(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))).toBe('jpeg');
    expect(sniffImageFormat(text('GIF89a'))).toBe('gif');
    expect(sniffImageFormat(new Uint8Array([0, 0, 1, 0, 1, 0]))).toBe('ico');
    expect(sniffImageFormat(text('<?xml version="1.0"?><svg xmlns="x"></svg>'))).toBe('svg');
  });

  it('does not trust html or arbitrary content', () => {
    expect(
      sniffImageFormat(text('<!doctype html><html><body><svg></svg></body></html>'))
    ).toBe(null);
    expect(sniffImageFormat(text('{"not":"an image"}'))).toBeNull();
  });
});

describe('probeImage', () => {
  beforeEach(() => {
    mocks.guardedFetch.mockReset();
  });

  let budget = () => createFetchBudget(60_000);

  it('reads png dimensions', async () => {
    mocks.guardedFetch.mockResolvedValue({ bytes: pngBytes(180, 180) });

    expect(await probeImage('https://a.com/i.png', budget())).toEqual({
      format: 'png',
      width: 180,
      height: 180,
      bytes: 33
    });
  });

  it('accepts svg with a viewBox', async () => {
    mocks.guardedFetch.mockResolvedValue({
      bytes: text('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"></svg>')
    });

    expect(await probeImage('https://a.com/i.svg', budget())).toMatchObject({
      format: 'svg',
      width: 24,
      height: 24
    });
  });

  it('rejects content that is not an image regardless of content type', async () => {
    mocks.guardedFetch.mockResolvedValue({
      bytes: text('<html>soft 404</html>'),
      contentType: 'image/png'
    });

    await expect(probeImage('https://a.com/i.png', budget())).rejects.toMatchObject({
      reason: 'not_an_image'
    });
  });

  it('rejects oversized svgs', async () => {
    mocks.guardedFetch.mockResolvedValue({
      bytes: text(`<svg xmlns="x">${' '.repeat(300_000)}</svg>`)
    });

    await expect(probeImage('https://a.com/i.svg', budget())).rejects.toBeInstanceOf(
      ImageRejectedError
    );
  });

  it('rejects corrupt raster images', async () => {
    mocks.guardedFetch.mockResolvedValue({
      bytes: new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2])
    });

    await expect(probeImage('https://a.com/i.png', budget())).rejects.toMatchObject({
      reason: 'invalid_dimensions'
    });
  });
});
