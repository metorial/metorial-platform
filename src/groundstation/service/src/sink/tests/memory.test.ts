import { isServiceError } from '@lowerdeck/error';
import { describe, expect, it } from 'vitest';
import type { NormalizedRecord } from '@metorial/groundstation-spec';
import { expectServiceError } from '../../test/helpers';
import { createMemorySink } from '../memory';
import { type RecordBatch, defaultStoragePolicy } from '../types';

let record = (id: string) => ({ id }) as NormalizedRecord;

let batch = (
  ids: string[],
  scope: { organizationId: string; instanceId: string } = {
    organizationId: 'gor_1',
    instanceId: 'gin_1'
  },
  lane: RecordBatch['lane'] = 'live'
): RecordBatch => ({
  lane,
  ...scope,
  projectId: 'gpr_1',
  storage: defaultStoragePolicy,
  records: ids.map(record)
});

let org1 = { organizationId: 'gor_1', instanceId: 'gin_1' };
let org1Other = { organizationId: 'gor_1', instanceId: 'gin_2' };
let org2 = { organizationId: 'gor_2', instanceId: 'gin_3' };

describe('createMemorySink', () => {
  it('stores records in write order with their scope and lane', async () => {
    let sink = createMemorySink();

    await sink.write(batch(['a', 'b'], org1, 'live'));
    await sink.write(batch(['c'], org2, 'backfill'));

    expect(sink.size()).toBe(3);
    expect(sink.list().map(item => item.record.id)).toEqual(['a', 'b', 'c']);
    expect(sink.list()[2]).toMatchObject({
      organizationId: 'gor_2',
      projectId: 'gpr_1',
      instanceId: 'gin_3',
      lane: 'backfill'
    });
  });

  it('filters by organization, instance and lane', async () => {
    let sink = createMemorySink();

    await sink.write(batch(['a'], org1, 'live'));
    await sink.write(batch(['b'], org2, 'live'));
    await sink.write(batch(['c'], org1, 'backfill'));
    await sink.write(batch(['d'], org1Other, 'live'));

    let ids = (filter: Parameters<typeof sink.list>[0]) =>
      sink.list(filter).map(item => item.record.id);

    expect(ids({ organizationId: 'gor_1' })).toEqual(['a', 'c', 'd']);
    expect(ids({ instanceId: 'gin_2' })).toEqual(['d']);
    expect(ids({ organizationId: 'gor_1', instanceId: 'gin_1' })).toEqual(['a', 'c']);
    expect(ids({ lane: 'live' })).toEqual(['a', 'b', 'd']);
    expect(ids({ organizationId: 'gor_1', lane: 'backfill' })).toEqual(['c']);
    expect(ids({ organizationId: 'none' })).toEqual([]);
  });

  it('limits to the most recent matches', async () => {
    let sink = createMemorySink();

    await sink.write(batch(['a', 'b', 'c', 'd']));

    expect(sink.list({ limit: 2 }).map(i => i.record.id)).toEqual(['c', 'd']);
    expect(sink.list({ limit: 10 })).toHaveLength(4);
  });

  it('evicts the oldest records beyond the cap', async () => {
    let sink = createMemorySink({ maxRecords: 3 });

    await sink.write(batch(['a', 'b']));
    await sink.write(batch(['c', 'd', 'e']));

    expect(sink.size()).toBe(3);
    expect(sink.list().map(i => i.record.id)).toEqual(['c', 'd', 'e']);
  });

  it('keeps only the tail of a single oversized batch', async () => {
    let sink = createMemorySink({ maxRecords: 2 });

    await sink.write(batch(['a', 'b', 'c', 'd']));

    expect(sink.list().map(i => i.record.id)).toEqual(['c', 'd']);
  });

  it('erases one organization, project or instance', async () => {
    let sink = createMemorySink();

    await sink.write(batch(['a'], org1));
    await sink.write(batch(['b'], org1Other));
    await sink.write(batch(['c'], org2));
    await sink.write({ ...batch(['d'], org1), projectId: 'gpr_2' });

    let ids = () => sink.list().map(item => item.record.id);

    expect(sink.erase({ organizationId: 'gor_1', instanceId: 'gin_2' })).toBe(1);
    expect(ids()).toEqual(['a', 'c', 'd']);

    expect(sink.erase({ organizationId: 'gor_1', projectId: 'gpr_1' })).toBe(1);
    expect(ids()).toEqual(['c', 'd']);

    expect(sink.erase({ organizationId: 'gor_1' })).toBe(1);
    expect(ids()).toEqual(['c']);

    expect(sink.erase({ organizationId: 'gor_1' })).toBe(0);
  });

  it('clears', async () => {
    let sink = createMemorySink();

    await sink.write(batch(['a']));
    sink.clear();

    expect(sink.size()).toBe(0);
    expect(sink.list()).toEqual([]);
  });

  it('accepts empty batches', async () => {
    let sink = createMemorySink();

    await sink.write(batch([]));

    expect(sink.size()).toBe(0);
  });

  it('fails exactly once after failNext and stores nothing from the failed write', async () => {
    let sink = createMemorySink();
    let failure = new Error('disk gone');

    sink.failNext(failure);

    await expect(sink.write(batch(['a']))).rejects.toBe(failure);
    expect(sink.size()).toBe(0);

    await sink.write(batch(['b']));
    expect(sink.size()).toBe(1);
  });

  it('uses a default error for failNext', async () => {
    let sink = createMemorySink();

    sink.failNext();

    await expect(sink.write(batch(['a']))).rejects.toThrow('memory sink failure');
  });

  it('rejects with sink_busy while busy and recovers afterwards', async () => {
    let sink = createMemorySink();

    sink.setBusy(true);

    await expectServiceError(sink.write(batch(['a'])), 'sink_busy');
    await expectServiceError(sink.write(batch(['b'])), 'sink_busy');
    expect(sink.size()).toBe(0);

    sink.setBusy(false);
    await sink.write(batch(['c']));

    expect(sink.size()).toBe(1);
  });

  it('reports sink_busy as a 503', async () => {
    let sink = createMemorySink();
    sink.setBusy(true);

    let error = await sink.write(batch(['a'])).catch(e => e);

    expect(isServiceError(error)).toBe(true);
    expect(error.data.status).toBe(503);
  });

  it('prefers a queued failure over busy', async () => {
    let sink = createMemorySink();

    sink.setBusy(true);
    sink.failNext(new Error('boom'));

    await expect(sink.write(batch(['a']))).rejects.toThrow('boom');
    await expectServiceError(sink.write(batch(['a'])), 'sink_busy');
  });

  it('keeps independent state per sink', async () => {
    let a = createMemorySink();
    let b = createMemorySink();

    await a.write(batch(['x']));

    expect(b.size()).toBe(0);
  });
});
