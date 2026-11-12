import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { NormalizedRecord } from '@metorial/groundstation-spec';
import { expectServiceError } from '../../test/helpers';
import { createNdjsonSink } from '../ndjson';
import { defaultStoragePolicy } from '../types';

let directory: string;

beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), 'groundstation-ndjson-'));
});

afterEach(async () => {
  await rm(directory, { recursive: true, force: true });
});

let record = (id: string, extra: Record<string, unknown> = {}) =>
  ({ id, ...extra }) as unknown as NormalizedRecord;

let lines = async (path: string) =>
  (await readFile(path, 'utf8')).split('\n').filter(line => line.length > 0);

describe('createNdjsonSink', () => {
  it('writes one JSON object per line', async () => {
    let path = join(directory, 'out.ndjson');
    let sink = createNdjsonSink(path);

    await sink.write({
      lane: 'live',
      tenantId: 't',
      storage: defaultStoragePolicy,
      records: [record('a'), record('b')]
    });
    await sink.close?.();

    let text = await readFile(path, 'utf8');

    expect(text.endsWith('\n')).toBe(true);
    expect((await lines(path)).map(line => JSON.parse(line).id)).toEqual(['a', 'b']);
  });

  it('keeps newlines inside values escaped', async () => {
    let path = join(directory, 'out.ndjson');
    let sink = createNdjsonSink(path);

    await sink.write({
      lane: 'live',
      tenantId: 't',
      storage: defaultStoragePolicy,
      records: [record('a', { text: 'line1\nline2 end' })]
    });
    await sink.close?.();

    let written = await lines(path);

    expect(written).toHaveLength(1);
    expect(JSON.parse(written[0]!).text).toBe('line1\nline2 end');
  });

  it('creates missing parent directories', async () => {
    let path = join(directory, 'a', 'b', 'out.ndjson');
    let sink = createNdjsonSink(path);

    await sink.write({
      lane: 'live',
      tenantId: 't',
      storage: defaultStoragePolicy,
      records: [record('a')]
    });
    await sink.close?.();

    expect(await lines(path)).toHaveLength(1);
  });

  it('appends across sinks and writes', async () => {
    let path = join(directory, 'out.ndjson');

    let first = createNdjsonSink(path);
    await first.write({
      lane: 'live',
      tenantId: 't',
      storage: defaultStoragePolicy,
      records: [record('a')]
    });
    await first.close?.();

    let second = createNdjsonSink(path);
    await second.write({
      lane: 'live',
      tenantId: 't',
      storage: defaultStoragePolicy,
      records: [record('b')]
    });
    await second.close?.();

    expect((await lines(path)).map(line => JSON.parse(line).id)).toEqual(['a', 'b']);
  });

  it('skips empty batches without creating a file', async () => {
    let path = join(directory, 'out.ndjson');
    let sink = createNdjsonSink(path);

    await sink.write({
      lane: 'live',
      tenantId: 't',
      storage: defaultStoragePolicy,
      records: []
    });
    await sink.close?.();

    await expect(readFile(path, 'utf8')).rejects.toMatchObject({ code: 'ENOENT' });
  });

  it('keeps every line intact under concurrent writes', async () => {
    let path = join(directory, 'out.ndjson');
    let sink = createNdjsonSink(path);

    let big = 'x'.repeat(50_000);

    let writes = Array.from({ length: 40 }, (_, w) =>
      sink.write({
        lane: 'live',
        tenantId: 't',
        storage: defaultStoragePolicy,
        records: Array.from({ length: 5 }, (_, r) => record(`w${w}r${r}`, { pad: big }))
      })
    );

    await Promise.all(writes);
    await sink.close?.();

    let written = await lines(path);
    let ids = written.map(line => JSON.parse(line).id as string);

    expect(written).toHaveLength(200);
    expect(new Set(ids).size).toBe(200);
  });

  it('keeps each batch contiguous and in submission order', async () => {
    let path = join(directory, 'out.ndjson');
    let sink = createNdjsonSink(path);

    await Promise.all(
      [0, 1, 2, 3, 4].map(w =>
        sink.write({
          lane: 'live',
          tenantId: 't',
          storage: defaultStoragePolicy,
          records: [record(`${w}-0`), record(`${w}-1`), record(`${w}-2`)]
        })
      )
    );
    await sink.close?.();

    let ids = (await lines(path)).map(line => JSON.parse(line).id);

    expect(ids).toEqual([0, 1, 2, 3, 4].flatMap(w => [`${w}-0`, `${w}-1`, `${w}-2`]));
  });

  it('rejects with sink_busy when too many bytes are pending', async () => {
    let path = join(directory, 'out.ndjson');
    let sink = createNdjsonSink(path, { maxPendingBytes: 500 });

    let first = sink.write({
      lane: 'live',
      tenantId: 't',
      storage: defaultStoragePolicy,
      records: [record('a', { pad: 'x'.repeat(300) })]
    });

    let second = sink.write({
      lane: 'live',
      tenantId: 't',
      storage: defaultStoragePolicy,
      records: [record('b', { pad: 'x'.repeat(300) })]
    });

    await expectServiceError(second, 'sink_busy');
    await first;
    await sink.close?.();

    expect((await lines(path)).map(line => JSON.parse(line).id)).toEqual(['a']);
  });

  it('accepts new writes once pending bytes drain', async () => {
    let path = join(directory, 'out.ndjson');
    let sink = createNdjsonSink(path, { maxPendingBytes: 500 });

    let payload = () => ({
      lane: 'live' as const,
      tenantId: 't',
      storage: defaultStoragePolicy,
      records: [record('x', { pad: 'x'.repeat(300) })]
    });

    await sink.write(payload());
    await sink.write(payload());
    await sink.close?.();

    expect(await lines(path)).toHaveLength(2);
  });

  it('rejects a single batch larger than the pending limit', async () => {
    let sink = createNdjsonSink(join(directory, 'out.ndjson'), { maxPendingBytes: 10 });

    await expectServiceError(
      sink.write({
        lane: 'live',
        tenantId: 't',
        storage: defaultStoragePolicy,
        records: [record('a')]
      }),
      'sink_busy'
    );
  });

  it('reports filesystem failures to the failing writer only', async () => {
    let blocker = join(directory, 'file');
    let sink = createNdjsonSink(join(blocker, 'nested', 'out.ndjson'));

    await sink
      .write({
        lane: 'live',
        tenantId: 't',
        storage: defaultStoragePolicy,
        records: [record('a')]
      })
      .catch(() => {});

    let path = join(directory, 'out.ndjson');
    let healthy = createNdjsonSink(path);

    await healthy.write({
      lane: 'live',
      tenantId: 't',
      storage: defaultStoragePolicy,
      records: [record('b')]
    });
    await healthy.close?.();

    expect(await lines(path)).toHaveLength(1);
  });

  it('keeps writing after one write fails', async () => {
    let path = join(directory, 'out.ndjson');
    let sink = createNdjsonSink(path);

    let circular: Record<string, unknown> = {};
    circular['self'] = circular;

    await expect(
      sink.write({
        lane: 'live',
        tenantId: 't',
        storage: defaultStoragePolicy,
        records: [record('bad', circular)]
      })
    ).rejects.toThrow();

    await sink.write({
      lane: 'live',
      tenantId: 't',
      storage: defaultStoragePolicy,
      records: [record('good')]
    });
    await sink.close?.();

    expect((await lines(path)).map(line => JSON.parse(line).id)).toEqual(['good']);
  });
});
