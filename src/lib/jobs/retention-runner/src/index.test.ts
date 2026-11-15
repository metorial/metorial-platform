import { describe, expect, it, vi } from 'vitest';
import { retentionPhaseBatch } from './index';

let rows = (ids: number[]) => ids.map(id => ({ id: String(id).padStart(4, '0') }));

describe('retentionPhaseBatch', () => {
  it('deletes a full page and reports more without a cursor', async () => {
    let deleteMany = vi.fn(async () => {});

    let result = await retentionPhaseBatch({
      batchSize: 3,
      findMany: async () => rows([1, 2, 3]),
      deleteMany
    });

    expect(deleteMany).toHaveBeenCalledWith(rows([1, 2, 3]));
    expect(result).toEqual({ deleted: 3, hasMore: true });
  });

  it('stops on a partial page', async () => {
    let result = await retentionPhaseBatch({
      batchSize: 3,
      findMany: async () => rows([1, 2]),
      deleteMany: async () => {}
    });

    expect(result).toEqual({ deleted: 2, hasMore: false });
  });

  it('stops on an empty page without deleting', async () => {
    let deleteMany = vi.fn(async () => {});

    let result = await retentionPhaseBatch({
      findMany: async () => [],
      deleteMany
    });

    expect(deleteMany).not.toHaveBeenCalled();
    expect(result).toEqual({ deleted: 0, hasMore: false });
  });

  it('passes the cursor to findMany and advances past rows the filter skipped', async () => {
    let findMany = vi.fn(async (_cursor?: string) => rows([4, 5, 6]));
    let deleteMany = vi.fn(async () => {});
    let beforeDelete = vi.fn(async () => {});

    let result = await retentionPhaseBatch({
      batchSize: 3,
      cursor: '0003',
      findMany,
      getCursor: record => record.id,
      filter: records => records.filter(record => record.id !== '0006'),
      beforeDelete,
      deleteMany
    });

    expect(findMany).toHaveBeenCalledWith('0003');
    expect(beforeDelete).toHaveBeenCalledWith(rows([4, 5]));
    expect(deleteMany).toHaveBeenCalledWith(rows([4, 5]));
    expect(result).toEqual({ deleted: 2, hasMore: true, cursor: '0006' });
  });

  it('keeps paging with a cursor when the filter skips the whole page', async () => {
    let deleteMany = vi.fn(async () => {});

    let result = await retentionPhaseBatch({
      batchSize: 3,
      findMany: async () => rows([1, 2, 3]),
      getCursor: record => record.id,
      filter: () => [],
      deleteMany
    });

    expect(deleteMany).not.toHaveBeenCalled();
    expect(result).toEqual({ deleted: 0, hasMore: true, cursor: '0003' });
  });

  it('stops without a cursor when the filter skips the whole page', async () => {
    let result = await retentionPhaseBatch({
      batchSize: 3,
      findMany: async () => rows([1, 2, 3]),
      filter: () => [],
      deleteMany: async () => {}
    });

    expect(result).toEqual({ deleted: 0, hasMore: false });
  });
});
