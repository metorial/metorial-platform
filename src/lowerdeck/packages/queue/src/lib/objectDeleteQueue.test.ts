import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createObjectDeleteQueue, OBJECT_DELETE_CHUNK_SIZE } from './objectDeleteQueue';

let handlers: ((data: { bucket: string; keys: string[] }) => Promise<void>)[] = [];

vi.mock('./createQueue', () => ({
  createQueue: () => ({
    process: (handler: (data: { bucket: string; keys: string[] }) => Promise<void>) => {
      handlers.push(handler);
      return { start: async () => {} };
    },
    add: async () => {},
    addMany: async () => {}
  })
}));

let build = (
  deleteObject: (bucket: string, key: string) => Promise<unknown>,
  extra?: { ignoreError?: (error: unknown) => boolean }
) => {
  handlers = [];
  let queue = createObjectDeleteQueue({
    name: 'test/object/delete',
    redisUrl: 'redis://localhost:6379',
    deleteObject,
    ...extra
  });

  return { queue, run: handlers[0]! };
};

describe('createObjectDeleteQueue', () => {
  beforeEach(() => {
    handlers = [];
  });

  it('deletes every key in the batch', async () => {
    let deleted: string[] = [];
    let { run } = build(async (_bucket, key) => void deleted.push(key));

    await run({ bucket: 'b', keys: ['one', 'two', 'three'] });

    expect(deleted).toEqual(['one', 'two', 'three']);
  });

  it('propagates failures so the queue retries the job', async () => {
    let { run } = build(async (_bucket, key) => {
      if (key === 'two') throw new Error('connection reset');
    });

    await expect(run({ bucket: 'b', keys: ['one', 'two'] })).rejects.toThrow(
      'connection reset'
    );
  });

  it('treats an already-deleted object as success', async () => {
    let { run } = build(async (_bucket, key) => {
      if (key === 'gone') throw Object.assign(new Error('not found'), { statusCode: 404 });
    });

    await expect(run({ bucket: 'b', keys: ['here', 'gone'] })).resolves.toBeUndefined();
  });

  it('still fails on a non-404 status so a broken bucket is not silently skipped', async () => {
    let { run } = build(async () => {
      throw Object.assign(new Error('denied'), { statusCode: 403 });
    });

    await expect(run({ bucket: 'b', keys: ['k'] })).rejects.toThrow('denied');
  });

  it('honours a caller-supplied ignoreError', async () => {
    let { run } = build(
      async () => {
        throw Object.assign(new Error('gone'), { code: 'NoSuchKey' });
      },
      { ignoreError: error => (error as { code?: string }).code === 'NoSuchKey' }
    );

    await expect(run({ bucket: 'b', keys: ['k'] })).resolves.toBeUndefined();
  });

  it('splits an enqueue into chunked jobs', async () => {
    let added: { bucket: string; keys: string[] }[] = [];
    handlers = [];
    let queue = createObjectDeleteQueue({
      name: 'test/object/delete/chunk',
      redisUrl: 'redis://localhost:6379',
      deleteObject: async () => {}
    });
    queue.queue.addMany = async (jobs: { bucket: string; keys: string[] }[]) => {
      added.push(...jobs);
    };

    await queue.enqueue(
      'b',
      Array.from({ length: OBJECT_DELETE_CHUNK_SIZE + 1 }, (_, i) => `k${i}`)
    );

    expect(added).toHaveLength(2);
    expect(added[0]!.keys).toHaveLength(OBJECT_DELETE_CHUNK_SIZE);
    expect(added[1]!.keys).toHaveLength(1);
  });

  it('does not enqueue anything for an empty key list', async () => {
    let called = false;
    handlers = [];
    let queue = createObjectDeleteQueue({
      name: 'test/object/delete/empty',
      redisUrl: 'redis://localhost:6379',
      deleteObject: async () => {}
    });
    queue.queue.addMany = async () => {
      called = true;
    };

    await queue.enqueue('b', []);

    expect(called).toBe(false);
  });
});
