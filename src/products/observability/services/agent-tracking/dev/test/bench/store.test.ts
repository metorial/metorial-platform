import mongoose from 'mongoose';
import { describe, expect, it } from 'vitest';
import type { SeedMarker } from '../../src/bench/seed';
import { assertBenchMarker, foreignDataFilters, insertAll } from '../../src/bench/store';

let marker = (status: SeedMarker['status']) =>
  ({
    status,
    organizations: [{ organizationId: 'ator_bench', instanceIds: ['atin_0', 'atin_1'] }],
    canary: { organizationId: 'ator_canary', instanceIds: ['atin_canary'] }
  }) as SeedMarker;

describe('bench store check', () => {
  it('needs a marker for bench, explain and cleanup, and a complete one for bench', () => {
    expect(() => assertBenchMarker(null, { requireMarker: true })).toThrow(/no bench marker/);
    expect(() => assertBenchMarker(null, { requireMarker: false })).not.toThrow();
    expect(() =>
      assertBenchMarker(marker('seeding'), { requireMarker: true, requireComplete: true })
    ).toThrow(/not completed/);
    expect(() =>
      assertBenchMarker(marker('complete'), { requireMarker: true, requireComplete: true })
    ).not.toThrow();
  });

  it('counts any document as foreign in a database without a marker', () => {
    let filters = foreignDataFilters(null);

    expect(filters.map(item => item.collection)).toEqual([
      'events',
      'measurements',
      'contentTexts',
      'sessions',
      'usageSlices',
      'sourceHealth',
      'sessionLinks'
    ]);
    expect(filters.every(item => Object.keys(item.filter).length == 0)).toBe(true);
  });

  it('counts documents of organizations and instances the marker does not list', () => {
    let filters = foreignDataFilters(marker('complete'));

    expect(filters.find(item => item.collection == 'events')?.filter).toEqual({
      organizationId: { $nin: ['ator_bench', 'ator_canary'] }
    });
    expect(filters.find(item => item.collection == 'sessionLinks')?.filter).toEqual({
      instanceId: { $nin: ['atin_0', 'atin_1', 'atin_canary'] }
    });
  });
});

describe('bench inserts', () => {
  let busy = () => new mongoose.mongo.MongoNetworkError('timed out');

  let collection = (failures: number) => {
    let calls = 0;

    return {
      calls: () => calls,
      insertMany: async (documents: { _id: string }[]) => {
        calls++;
        if (calls <= failures) throw busy();
        return { insertedCount: documents.length };
      }
    };
  };

  it('writes a busy chunk again after a pause', async () => {
    let target = collection(2);
    let documents = Array.from({ length: 1_500 }, (_, index) => ({ _id: `d${index}` }));

    expect(await insertAll(target, documents, 0)).toBe(1_500);
    expect(target.calls()).toBe(4);
  });

  it('gives up after a few attempts', async () => {
    let target = collection(10);

    await expect(insertAll(target, [{ _id: 'a' }], 0)).rejects.toMatchObject({
      data: { code: 'sink_busy' }
    });
    expect(target.calls()).toBe(4);
  });
});
