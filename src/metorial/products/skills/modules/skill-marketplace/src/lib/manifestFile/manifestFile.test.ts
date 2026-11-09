import { createHash } from 'node:crypto';
import { gunzipSync, gzipSync } from 'node:zlib';
import { afterEach, describe, expect, it } from 'vitest';
import { expectedDeletes } from './expectedDeletes';
import {
  encodeManifestEntry,
  encodeManifestHeader,
  ManifestFileError,
  manifestFormatLimits,
  type ManifestEntry,
  type ManifestHeader
} from './format';
import { openManifestFile, readManifestFile } from './reader';
import { writeManifestFile, writeSortedManifestFile } from './writer';

let scope = {
  dirs: ['plugins'],
  files: ['.claude-plugin/marketplace.json', '.agents/plugins/marketplace.json'],
  globs: []
};

let entry = (path: string, size = path.length): ManifestEntry => ({
  path,
  gitBlobSha: createHash('sha1').update(path).digest('hex'),
  sha256: createHash('sha256').update(path).digest('hex'),
  size,
  crc32: 4_000_000_000,
  key: `skill-sync/blobs/sha256/${createHash('sha256').update(path).digest('hex')}`
});

let entries = [
  entry('plugins/acme/skills/qa/SKILL.md'),
  entry('.claude-plugin/marketplace.json'),
  entry('plugins/acme/.claude-plugin/plugin.json', 0),
  entry('plugins/\u{1f680}/x.md'),
  entry('plugins/\uffff/x.md'),
  entry('.agents/plugins/marketplace.json')
];

let write = (input: ManifestEntry[] = entries) =>
  writeManifestFile({
    destinationId: 'sdst_1',
    sourceBucket: 'cargo-files',
    scope,
    entries: input
  });

let header = (overrides: Partial<ManifestHeader> = {}): ManifestHeader => ({
  destinationId: 'sdst_1',
  sourceBucket: 'cargo-files',
  entryCount: 1,
  totalBytes: 1,
  scope,
  ...overrides
});

let ndjson = (lines: string[]) => Buffer.from(lines.map(line => `${line}\n`).join(''));

let sha256 = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');

let chunked = async function* (bytes: Uint8Array, size: number) {
  for (let i = 0; i < bytes.length; i += size) yield bytes.subarray(i, i + size);
};

let readError = async (promise: Promise<unknown>) => {
  let error = await promise.then(
    () => null,
    error => error
  );
  expect(error).toBeInstanceOf(ManifestFileError);
  return error as ManifestFileError;
};

let originalLimits = { ...manifestFormatLimits };

afterEach(() => {
  Object.assign(manifestFormatLimits, originalLimits);
});

describe('writeManifestFile', () => {
  it('is deterministic regardless of input order', async () => {
    let a = await write();
    let b = await write([...entries].reverse());

    expect(b.sha256).toBe(a.sha256);
    expect(gunzipSync(b.body).equals(gunzipSync(a.body))).toBe(true);
  });

  it('hashes the uncompressed bytes and reports counts', async () => {
    let written = await write();
    let plain = gunzipSync(written.body);

    expect(written.body[0]).toBe(0x1f);
    expect(written.sha256).toBe(sha256(plain));
    expect(written.byteSize).toBe(plain.byteLength);
    expect(written.entryCount).toBe(entries.length);
    expect(written.totalBytes).toBe(entries.reduce((sum, e) => sum + e.size, 0));
  });

  it('writes the documented wire format, sorted by UTF-8 bytes', async () => {
    let lines = gunzipSync((await write()).body)
      .toString('utf8')
      .split('\n');

    expect(lines.at(-1)).toBe('');
    expect(JSON.parse(lines[0]!)).toEqual({
      t: 'header',
      v: 1,
      kind: 'metorial.skill-destination-manifest',
      destinationId: 'sdst_1',
      sourceBucket: 'cargo-files',
      entryCount: 6,
      totalBytes: entries.reduce((sum, e) => sum + e.size, 0),
      scope: {
        dirs: ['plugins'],
        files: ['.agents/plugins/marketplace.json', '.claude-plugin/marketplace.json'],
        globs: []
      }
    });
    expect(Object.keys(JSON.parse(lines[1]!))).toEqual(['t', 'p', 'g', 's', 'n', 'c', 'k']);

    let paths = lines.slice(1, -1).map(line => JSON.parse(line).p as string);
    expect(paths).toEqual(
      [...paths].sort((a, b) => Buffer.compare(Buffer.from(a), Buffer.from(b)))
    );
    expect(paths.at(-1)).toBe('plugins/\u{1f680}/x.md');
  });

  it('rejects duplicate paths', async () => {
    let error = await readError(write([entry('a'), entry('a')]));
    expect(error.message).toContain('Duplicate');
  });

  it('rejects a path that is both a file and a directory', async () => {
    let error = await readError(write([entry('a'), entry('a/b')]));
    expect(error.message).toContain('both a file and a directory');
  });

  it('rejects invalid entries', async () => {
    await readError(write([entry('a/../b')]));
    await readError(write([{ ...entry('a'), gitBlobSha: 'ABC' }]));
    await readError(write([{ ...entry('a'), size: manifestFormatLimits.maxFileBytes + 1 }]));
    await readError(write([{ ...entry('a'), crc32: -1 }]));
    await readError(write([{ ...entry('a'), key: '' }]));
  });

  it('rejects more entries than the format allows', async () => {
    let many = Array.from({ length: manifestFormatLimits.maxEntries + 1 }, (_, i) =>
      entry(`f/${i}`)
    );

    let error = await readError(write(many));
    expect(error.message).toContain('entryCount');
  });

  it('rejects oversized lines', async () => {
    let error = await readError(write([{ ...entry('a'), key: 'k'.repeat(1025) }]));
    expect(error.message).toContain('key');

    manifestFormatLimits.maxLineBytes = 200;
    error = await readError(write([entry(`a/${'x'.repeat(200)}`)]));
    expect(error.message).toContain('Manifest line exceeds');
  });

  describe('writeSortedManifestFile', () => {
    let sorted = [entry('a'), entry('b/c'), entry('d')];
    let totalBytes = sorted.reduce((sum, e) => sum + e.size, 0);

    let writeSorted = (input: ManifestEntry[], counts = { entryCount: 3, totalBytes }) =>
      writeSortedManifestFile({
        destinationId: 'sdst_1',
        sourceBucket: 'cargo-files',
        scope,
        ...counts,
        entries: (async function* () {
          yield* input;
        })()
      });

    it('produces the same bytes as the buffered writer', async () => {
      let streamed = await writeSorted(sorted);
      let buffered = await write([...sorted].reverse());

      expect(streamed.sha256).toBe(buffered.sha256);
    });

    it('fails on unsorted input or wrong counts', async () => {
      expect(
        (await readError(writeSorted([sorted[1]!, sorted[0]!, sorted[2]!]))).message
      ).toContain('sorted');
      expect(
        (await readError(writeSorted(sorted, { entryCount: 4, totalBytes }))).message
      ).toContain('declares 4');
      expect(
        (await readError(writeSorted(sorted, { entryCount: 2, totalBytes }))).message
      ).toContain('More entries');
      expect(
        (await readError(writeSorted(sorted, { entryCount: 3, totalBytes: 1 }))).message
      ).toContain('bytes');
    });
  });
});

describe('readManifestFile', () => {
  it('round-trips through gzip', async () => {
    let written = await write();
    let read = await readManifestFile(written.body, { expectedSha256: written.sha256 });

    expect(read.header).toEqual({
      destinationId: 'sdst_1',
      sourceBucket: 'cargo-files',
      entryCount: 6,
      totalBytes: written.totalBytes,
      scope: { ...scope, files: [...scope.files].sort() }
    });
    expect(read.entries.map(e => e.path)).toEqual(
      gunzipSync(written.body)
        .toString('utf8')
        .trim()
        .split('\n')
        .slice(1)
        .map(line => JSON.parse(line).p)
    );
    expect(read.entries).toEqual(
      expect.arrayContaining(entries.map(e => expect.objectContaining(e)))
    );
    expect(read.sha256).toBe(written.sha256);
    expect(read.byteSize).toBe(written.byteSize);
  });

  it('streams tiny chunks and plain NDJSON', async () => {
    let written = await write();
    let plain = gunzipSync(written.body);

    let fromGzipChunks = await readManifestFile(chunked(written.body, 1), {
      expectedSha256: written.sha256
    });
    let fromPlainChunks = await readManifestFile(chunked(plain, 7), {
      expectedSha256: written.sha256
    });
    let fromWebStream = await readManifestFile(
      new Blob([new Uint8Array(written.body)]).stream(),
      {
        expectedSha256: written.sha256
      }
    );

    expect(fromGzipChunks.entries).toHaveLength(6);
    expect(fromPlainChunks.entries).toEqual(fromGzipChunks.entries);
    expect(fromWebStream.entries).toEqual(fromGzipChunks.entries);
  });

  it('yields the header before reading entries', async () => {
    let written = await write();
    let opened = await openManifestFile(written.body, { expectedSha256: written.sha256 });

    expect(opened.header.entryCount).toBe(6);

    let paths: string[] = [];
    for await (let e of opened.entries) paths.push(e.path);
    expect(paths).toHaveLength(6);
  });

  it('rejects a sha256 mismatch', async () => {
    let written = await write();
    let plain = gunzipSync(written.body);
    let corrupted = Buffer.from(plain);
    corrupted[corrupted.indexOf('"n":') + 4] = '9'.charCodeAt(0);

    let wrongSha = await readError(
      readManifestFile(written.body, { expectedSha256: '0'.repeat(64) })
    );
    expect(wrongSha.message).toContain('sha256');

    await readError(readManifestFile(gzipSync(corrupted), { expectedSha256: written.sha256 }));
  });

  it('rejects an expected entry count that differs from the header', async () => {
    let written = await write();
    let error = await readError(
      readManifestFile(written.body, { expectedSha256: written.sha256, expectedEntryCount: 5 })
    );
    expect(error.message).toContain('expected 5');
  });

  it.each([
    ['empty manifest', [], 'empty'],
    ['entry before header', [encodeManifestEntry(entry('a'))], 'header'],
    [
      'unsorted entries',
      [
        encodeManifestHeader(header({ entryCount: 2, totalBytes: 2 })),
        encodeManifestEntry(entry('b')),
        encodeManifestEntry(entry('a'))
      ],
      'sorted'
    ],
    [
      'duplicate entries',
      [
        encodeManifestHeader(header({ entryCount: 2, totalBytes: 2 })),
        encodeManifestEntry(entry('a')),
        encodeManifestEntry(entry('a'))
      ],
      'Duplicate'
    ],
    [
      'file and directory',
      [
        encodeManifestHeader(header({ entryCount: 2, totalBytes: 4 })),
        encodeManifestEntry(entry('a')),
        encodeManifestEntry(entry('a/b'))
      ],
      'both a file and a directory'
    ],
    [
      'too many entries for the header',
      [
        encodeManifestHeader(header({ entryCount: 0, totalBytes: 0 })),
        encodeManifestEntry(entry('a'))
      ],
      'More entries'
    ],
    ['too few entries for the header', [encodeManifestHeader(header())], 'declares 1'],
    [
      'wrong total bytes',
      [encodeManifestHeader(header({ totalBytes: 2 })), encodeManifestEntry(entry('a'))],
      'bytes'
    ],
    [
      'entry count above the format cap',
      [encodeManifestHeader(header({ entryCount: 250_001 }))],
      'entryCount'
    ],
    [
      'unsupported version',
      [
        encodeManifestHeader(header()).replace('"v":1', '"v":2'),
        encodeManifestEntry(entry('a'))
      ],
      'version'
    ],
    [
      'unknown field',
      [
        encodeManifestHeader(header()),
        encodeManifestEntry(entry('a')).replace('{"t"', '{"x":1,"t"')
      ],
      'Unknown field'
    ],
    [
      'surrounding whitespace',
      [encodeManifestHeader(header()), ` ${encodeManifestEntry(entry('a'))}`],
      'whitespace'
    ],
    [
      'invalid path',
      [encodeManifestHeader(header()), encodeManifestEntry({ ...entry('a'), path: '.git/x' })],
      'git_dir'
    ],
    [
      'oversized line',
      [
        encodeManifestHeader(header()),
        encodeManifestEntry({ ...entry('a'), key: 'k'.repeat(64 * 1024) })
      ],
      'Line exceeds'
    ],
    [
      'empty line',
      [encodeManifestHeader(header({ entryCount: 0, totalBytes: 0 })), ''],
      'Empty line'
    ],
    ['invalid JSON', [encodeManifestHeader(header()), '{"t":'], 'JSON']
  ])('rejects %s', async (_name, lines, message) => {
    let error = await readError(readManifestFile(ndjson(lines)));
    expect(error.message).toContain(message);
  });

  it('measures the line limit without the newline', async () => {
    let line = encodeManifestEntry({ ...entry('a'), key: 'k'.repeat(500) });
    let bytes = ndjson([encodeManifestHeader(header()), line]);

    manifestFormatLimits.maxLineBytes = Buffer.byteLength(line);
    expect((await readManifestFile(bytes)).entries).toHaveLength(1);

    manifestFormatLimits.maxLineBytes -= 1;
    expect((await readError(readManifestFile(bytes))).message).toContain('Line exceeds');
  });

  it('rejects a missing trailing newline', async () => {
    let bytes = ndjson([encodeManifestHeader(header()), encodeManifestEntry(entry('a'))]);
    let error = await readError(readManifestFile(bytes.subarray(0, -1)));
    expect(error.message).toContain('newline');
  });

  it('rejects invalid UTF-8', async () => {
    let bytes = Buffer.concat([
      ndjson([encodeManifestHeader(header())]),
      Buffer.from('{"t":"entry","p":"'),
      Buffer.from([0xff]),
      Buffer.from('"}\n')
    ]);

    let error = await readError(readManifestFile(bytes));
    expect(error.message).toContain('UTF-8');
  });

  it('caps the decompressed size', async () => {
    let many = Array.from({ length: 50 }, (_, i) => entry(`f/${String(i).padStart(3, '0')}`));
    let written = await write(many);
    manifestFormatLimits.maxObjectBytes = 1024;

    let error = await readError(readManifestFile(written.body));
    expect(error.message).toContain('uncompressed');
  });

  it('rejects corrupt gzip', async () => {
    let written = await write();
    let truncated = written.body.subarray(0, written.body.length - 10);

    let error = await readError(readManifestFile(truncated));
    expect(error.message).toMatch(/gzip|newline/);
  });
});

describe('expectedDeletes', () => {
  let paths = (list: string[]) => list.map(path => ({ path }));

  let collect = async (previous: string[], current: string[]) => {
    let result: string[] = [];
    for await (let path of expectedDeletes(paths(previous), paths(current))) result.push(path);
    return result;
  };

  it('returns paths that are only in the previous manifest', async () => {
    expect(await collect(['a', 'b', 'c', 'e'], ['b', 'd', 'e', 'f'])).toEqual(['a', 'c']);
    expect(await collect([], ['a'])).toEqual([]);
    expect(await collect(['a', 'b'], [])).toEqual(['a', 'b']);
    expect(await collect(['a', 'b'], ['a', 'b'])).toEqual([]);
  });

  it('uses byte order for astral characters', async () => {
    expect(await collect(['x/\uffff', 'x/\u{1f680}'], ['x/\uffff', 'x/\u{1f680}'])).toEqual(
      []
    );
    expect(await collect(['x/\uffff', 'x/\u{1f680}'], ['x/\u{1f680}'])).toEqual(['x/\uffff']);
  });

  it('works on manifests read back from storage bytes', async () => {
    let previous = await write([entry('a'), entry('b/c'), entry('d')]);
    let current = await write([entry('b/c'), entry('e')]);

    let deleted: string[] = [];
    for await (let path of expectedDeletes(
      (await openManifestFile(previous.body)).entries,
      (await openManifestFile(current.body)).entries
    )) {
      deleted.push(path);
    }

    expect(deleted).toEqual(['a', 'd']);
  });

  it('rejects unsorted input', async () => {
    await readError(collect(['b', 'a'], []));
  });
});
