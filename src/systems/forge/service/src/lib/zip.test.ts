import { describe, expect, it } from 'vitest';
import JSZip from 'jszip';
import { createZipFromFiles } from './zip';

describe('createZipFromFiles', () => {
  it('creates a zip with utf-8 and base64 entries', async () => {
    let blob = await createZipFromFiles([
      { filename: 'hello.txt', content: 'hello world' },
      { filename: 'data.bin', content: 'aGVsbG8=', encoding: 'base64' }
    ]);

    let zip = await JSZip.loadAsync(await blob.arrayBuffer());
    expect(await zip.file('hello.txt')?.async('string')).toBe('hello world');
    expect(await zip.file('data.bin')?.async('string')).toBe('hello');
  });
});
