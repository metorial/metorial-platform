import { describe, expect, it, vi } from 'vitest';
import { TEXT_CHUNK_SIZE, TEXT_FULL_READ_LIMIT } from '../lib/preview';
import { createMemoryFileSystem } from '../memory';
import type { FileEntry } from '../types';
import {
  hasChangedSince,
  loadMoreText,
  loadPreview,
  saveText,
  type TextPreview
} from './fileContent';

let encoder = new TextEncoder();

let entryFor = async (fs: ReturnType<typeof createMemoryFileSystem>, path: string) =>
  fs.stat(path);

let loadText = async (fs: ReturnType<typeof createMemoryFileSystem>, path: string) => {
  let preview = await loadPreview(fs, await entryFor(fs, path));
  if (preview.kind != 'text') throw new Error(`expected text, got ${preview.kind}`);

  return preview;
};

let bigText = (bytes: number) => 'abcdefghij'.repeat(Math.ceil(bytes / 10)).slice(0, bytes);

describe('loadPreview', () => {
  it('loads small text files completely', async () => {
    let fs = createMemoryFileSystem({ files: { '/a.ts': 'let a = 1;\n' } });
    let preview = await loadText(fs, '/a.ts');

    expect(preview).toMatchObject({
      text: 'let a = 1;\n',
      complete: true,
      lineEnding: 'lf',
      bom: false,
      size: 11,
      loadedBytes: 11
    });
  });

  it('detects CRLF line endings and byte order marks', async () => {
    let bytes = new Uint8Array([0xef, 0xbb, 0xbf, ...encoder.encode('a\r\nb\r\n')]);
    let fs = createMemoryFileSystem({ files: { '/win.txt': bytes } });
    let preview = await loadText(fs, '/win.txt');

    expect(preview.text).toBe('a\r\nb\r\n');
    expect(preview).toMatchObject({ lineEnding: 'crlf', bom: true });
  });

  it('loads an empty file as empty text', async () => {
    let fs = createMemoryFileSystem({ files: { '/empty.txt': '' } });
    let preview = await loadText(fs, '/empty.txt');

    expect(preview).toMatchObject({ text: '', complete: true });
  });

  it('reads only the first chunk of large files', async () => {
    let fs = createMemoryFileSystem({
      files: { '/big.log': bigText(TEXT_FULL_READ_LIMIT + 10) }
    });
    let read = vi.spyOn(fs, 'read');
    let preview = await loadText(fs, '/big.log');

    expect(read).toHaveBeenCalledWith(
      '/big.log',
      expect.objectContaining({ offset: 0, length: TEXT_CHUNK_SIZE })
    );
    expect(preview.complete).toBe(false);
    expect(preview.loadedBytes).toBe(TEXT_CHUNK_SIZE);
    expect(preview.size).toBe(TEXT_FULL_READ_LIMIT + 10);
  });

  it('loads images as blobs with the right type', async () => {
    let fs = createMemoryFileSystem({
      files: { '/logo.png': new Uint8Array([137, 80, 78, 71]) }
    });
    let preview = await loadPreview(fs, await entryFor(fs, '/logo.png'));

    expect(preview.kind).toBe('image');
    if (preview.kind == 'image') {
      expect(preview.mimeType).toBe('image/png');
      expect(preview.blob.size).toBe(4);
    }
  });

  it('refuses binary content even with a text extension', async () => {
    let fs = createMemoryFileSystem({ files: { '/data.txt': new Uint8Array([1, 2, 0, 3]) } });
    let preview = await loadPreview(fs, await entryFor(fs, '/data.txt'));

    expect(preview).toEqual({ kind: 'unsupported', reason: 'binary' });
  });

  it('refuses invalid utf-8', async () => {
    let fs = createMemoryFileSystem({
      files: { '/latin1.txt': new Uint8Array([0x63, 0x61, 0x66, 0xe9]) }
    });
    let preview = await loadPreview(fs, await entryFor(fs, '/latin1.txt'));

    expect(preview).toEqual({ kind: 'unsupported', reason: 'binary' });
  });

  it('does not read files it cannot preview', async () => {
    let fs = createMemoryFileSystem({ directories: ['/dir'] });
    let read = vi.spyOn(fs, 'read');
    let preview = await loadPreview(fs, await entryFor(fs, '/dir'));

    expect(preview).toEqual({ kind: 'unsupported', reason: 'not-file' });
    expect(read).not.toHaveBeenCalled();
  });

  it('forwards progress and propagates failures', async () => {
    let fs = createMemoryFileSystem({ files: { '/a.txt': bigText(200_000) } });
    let onProgress = vi.fn();

    await loadPreview(fs, await entryFor(fs, '/a.txt'), { onProgress });
    expect(onProgress).toHaveBeenLastCalledWith(200_000, 200_000);

    await expect(
      loadPreview(fs, { name: 'x', path: '/nope.txt', type: 'file', size: 1 })
    ).rejects.toMatchObject({ code: 'not_found' });
  });
});

describe('loadMoreText', () => {
  it('appends the next chunks until the file is complete', async () => {
    let content = bigText(TEXT_FULL_READ_LIMIT + 500);
    let fs = createMemoryFileSystem({ files: { '/big.log': content } });
    let first = await loadText(fs, '/big.log');

    let second = await loadMoreText(fs, '/big.log', first);
    expect(second.loadedBytes).toBe(TEXT_CHUNK_SIZE * 2);
    expect(second.complete).toBe(false);

    let third = await loadMoreText(fs, '/big.log', second);
    expect(third.complete).toBe(true);
    expect(third.loadedBytes).toBe(content.length);
    expect(third.text).toBe(content);
  });

  it('keeps multi-byte characters intact across chunk boundaries', async () => {
    let padding = 'a'.repeat(TEXT_CHUNK_SIZE - 1);
    let content = `${padding}✓${bigText(TEXT_FULL_READ_LIMIT)}`;
    let fs = createMemoryFileSystem({ files: { '/utf.log': content } });
    let first = await loadText(fs, '/utf.log');

    expect(first.text).toBe(padding);

    let second = await loadMoreText(fs, '/utf.log', first);

    expect(second.text.startsWith(`${padding}✓`)).toBe(true);
  });

  it('returns the same preview when there is nothing more to load', async () => {
    let fs = createMemoryFileSystem({ files: { '/a.txt': 'x' } });
    let preview = await loadText(fs, '/a.txt');

    expect(await loadMoreText(fs, '/a.txt', preview)).toBe(preview);
  });

  it('fails clearly when a later chunk is not valid utf-8', async () => {
    let bytes = new Uint8Array(TEXT_FULL_READ_LIMIT + 10).fill(0x61);
    bytes[TEXT_CHUNK_SIZE + 5] = 0xff;

    let fs = createMemoryFileSystem({ files: { '/odd.log': bytes } });
    let first = await loadText(fs, '/odd.log');

    await expect(loadMoreText(fs, '/odd.log', first)).rejects.toThrow(/utf-8/i);
  });
});

describe('hasChangedSince', () => {
  let modifiedAt = new Date('2026-01-01T10:00:00Z');

  it('compares size and modification time', () => {
    expect(hasChangedSince({ size: 5, modifiedAt }, { size: 5, modifiedAt })).toBe(false);
    expect(hasChangedSince({ size: 5, modifiedAt }, { size: 6, modifiedAt })).toBe(true);

    expect(
      hasChangedSince(
        { size: 5, modifiedAt },
        { size: 5, modifiedAt: new Date('2026-01-01T10:00:01Z') }
      )
    ).toBe(true);
  });

  it('only compares size when a timestamp is missing', () => {
    expect(hasChangedSince({ size: 5 }, { size: 5, modifiedAt })).toBe(false);
    expect(hasChangedSince({ size: 5, modifiedAt }, { size: 5 })).toBe(false);
  });
});

describe('saveText', () => {
  let setup = async (content: string | Uint8Array, path = '/note.txt') => {
    let tick = 0;

    let fs = createMemoryFileSystem({
      files: { [path]: content },
      now: () => new Date(2026, 0, 1, 10, 0, tick++)
    });

    let preview = await loadText(fs, path);

    return { fs, preview, entry: await fs.stat(path) };
  };

  it('writes the draft and returns the refreshed entry', async () => {
    let { fs, preview, entry } = await setup('old');

    let result = await saveText(fs, entry, preview, 'new content');

    expect(fs.readText('/note.txt')).toBe('new content');
    expect(result).toMatchObject({ status: 'saved', entry: { name: 'note.txt', size: 11 } });
  });

  it('preserves CRLF endings and the byte order mark', async () => {
    let original = new Uint8Array([0xef, 0xbb, 0xbf, ...encoder.encode('a\r\nb\r\n')]);
    let { fs, preview, entry } = await setup(original, '/win.txt');

    await saveText(fs, entry, preview, 'a\nb\nc\n');

    let saved = await fs.read('/win.txt');

    expect(Array.from(saved.data.subarray(0, 3))).toEqual([0xef, 0xbb, 0xbf]);
    expect(new TextDecoder('utf-8', { ignoreBOM: true }).decode(saved.data)).toBe(
      '﻿a\r\nb\r\nc\r\n'
    );
  });

  it('keeps the file mode', async () => {
    let { fs, preview, entry } = await setup('x');
    let write = vi.spyOn(fs, 'write');

    await saveText(fs, { ...entry, mode: 0o600 }, preview, 'y');

    expect(write).toHaveBeenCalledWith(
      '/note.txt',
      expect.any(Uint8Array),
      expect.objectContaining({ overwrite: true, mode: 0o600 })
    );
  });

  it('reports a conflict instead of overwriting a changed file', async () => {
    let { fs, preview, entry } = await setup('old');

    await fs.write('/note.txt', encoder.encode('someone else was here'), { overwrite: true });

    let result = await saveText(fs, entry, preview, 'mine');

    expect(result.status).toBe('conflict');
    expect(fs.readText('/note.txt')).toBe('someone else was here');
  });

  it('overwrites after a conflict when forced', async () => {
    let { fs, preview, entry } = await setup('old');

    await fs.write('/note.txt', encoder.encode('someone else was here'), { overwrite: true });

    let result = await saveText(fs, entry, preview, 'mine', { force: true });

    expect(result.status).toBe('saved');
    expect(fs.readText('/note.txt')).toBe('mine');
  });

  it('refuses to save a partially loaded file', async () => {
    let fs = createMemoryFileSystem({
      files: { '/big.log': bigText(TEXT_FULL_READ_LIMIT + 10) }
    });
    let preview: TextPreview = await loadText(fs, '/big.log');
    let entry: FileEntry = await fs.stat('/big.log');

    await expect(saveText(fs, entry, preview, 'truncated')).rejects.toThrow(/whole file/i);
  });
});
