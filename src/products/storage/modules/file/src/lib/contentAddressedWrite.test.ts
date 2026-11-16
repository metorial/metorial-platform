import { hashBytes } from '@lowerdeck/hash/content';
import { createHash } from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';

type Row = { oid: bigint; storeId: string; status: 'active' | 'deleted' };
type Hook = (key: string) => Promise<void> | void;

let sim = vi.hoisted(() => ({
  objects: new Map<string, Uint8Array>(),
  rows: [] as Row[],
  locks: new Map<string, Promise<void>>(),
  putCalls: [] as { key: string; content: Uint8Array; contentType?: string }[],
  enqueued: [] as string[],
  delayed: [] as { keys: string[]; delay?: number }[],
  nextOid: 1n,
  hooks: {
    afterPut: null as Hook | null,
    beforeCommit: null as Hook | null,
    yield: null as (() => Promise<void>) | null
  }
}));

vi.mock('@metorial/db', async () => {
  let { AsyncLocalStorage } = await import('node:async_hooks');

  type Tx = { pendingRows: Row[]; held: Set<string>; releases: (() => void)[] };
  let als = new AsyncLocalStorage<Tx>();

  let pause = async () => {
    if (sim.hooks.yield) await sim.hooks.yield();
  };

  let acquire = async (tx: Tx, name: string) => {
    if (tx.held.has(name)) return;

    while (sim.locks.has(name)) await sim.locks.get(name);

    let release!: () => void;
    sim.locks.set(name, new Promise<void>(resolve => (release = resolve)));
    tx.held.add(name);
    tx.releases.push(() => {
      sim.locks.delete(name);
      release();
    });
  };

  let visibleRows = () => [...sim.rows, ...(als.getStore()?.pendingRows ?? [])];

  let db = {
    $executeRaw: async (_strings: TemplateStringsArray, ...values: unknown[]) => {
      let tx = als.getStore();
      if (!tx) throw new Error('advisory xact lock outside of a transaction');

      await acquire(tx, String(values[0]));
      return 1;
    },
    file: {
      findFirst: async (args: { where: { storeId: string; status: string } }) => {
        await pause();
        let row = visibleRows().find(
          row => row.storeId === args.where.storeId && row.status === args.where.status
        );
        return row ? { oid: row.oid } : null;
      },
      create: async (args: { data: { storeId: string } }) => {
        await pause();
        let row: Row = { oid: sim.nextOid++, storeId: args.data.storeId, status: 'active' };
        let tx = als.getStore();
        if (tx) tx.pendingRows.push(row);
        else sim.rows.push(row);
        return row;
      }
    }
  };

  let withTransaction = async <T>(cb: (tdb: typeof db) => Promise<T>) => {
    let current = als.getStore();
    if (current) return await cb(db);

    let tx: Tx = { pendingRows: [], held: new Set(), releases: [] };
    try {
      let result = await als.run(tx, async () => {
        let result = await cb(db);
        if (sim.hooks.beforeCommit) {
          for (let row of tx.pendingRows) await sim.hooks.beforeCommit(row.storeId);
        }
        return result;
      });
      sim.rows.push(...tx.pendingRows);
      return result;
    } finally {
      for (let release of tx.releases) release();
    }
  };

  return { db, withTransaction, isInTransaction: () => als.getStore() != null };
});

vi.mock('../storage', async () => {
  let { ObjectStorageError } = await import('object-storage-client');

  let pause = async () => {
    if (sim.hooks.yield) await sim.hooks.yield();
  };

  let storage = {
    putObject: async (
      _bucket: string,
      key: string,
      content: Uint8Array,
      contentType?: string
    ) => {
      sim.putCalls.push({ key, content, contentType });
      await pause();
      sim.objects.set(key, content);
      if (sim.hooks.afterPut) await sim.hooks.afterPut(key);
      return { key };
    },
    headObject: async (_bucket: string, key: string) => {
      await pause();
      let object = sim.objects.get(key);
      if (!object) throw new ObjectStorageError(404, 'Object not found');
      return { key, size: object.byteLength };
    },
    deleteObject: async (_bucket: string, key: string) => {
      await pause();
      if (!sim.objects.delete(key)) throw new ObjectStorageError(404, 'Object not found');
    }
  };

  return {
    getCargoFilesBucketName: () => 'cargo-files',
    getStorage: () => storage
  };
});

vi.mock('../queues/objectDelete', () => ({
  cargoObjectDelete: {
    enqueue: async (_bucket: string, keys: string[]) => {
      sim.enqueued.push(...keys);
    },
    queue: {
      add: async (data: { keys: string[] }, opts?: { delay?: number }) => {
        sim.delayed.push({ keys: data.keys, delay: opts?.delay });
        return {};
      }
    }
  }
}));

let { db, withTransaction } = await import('@metorial/db');
let {
  deleteCargoObjectIfUnreferenced,
  getContentAddressedKey,
  lockCargoObject,
  putCargoObject
} = await import('./cargoObjects');
let { writeContentAddressedFile } = await import('./contentAddressedWrite');

let content = new TextEncoder().encode('shared skill file\n');
let key = getContentAddressedKey(hashBytes(content).sha256);

let createFileRow =
  (opts: { fail?: boolean } = {}) =>
  async ({ storeId }: { storeId: string }) =>
    await withTransaction(async () => {
      await lockCargoObject(storeId);
      let row = await (db.file.create as any)({ data: { storeId } });
      if (opts.fail) throw new Error('createFile failed');
      return row as Row;
    });

let upload = (opts: { fail?: boolean } = {}) =>
  writeContentAddressedFile({ content, buffered: false, create: createFileRow(opts) });

let guardedDelete = () => deleteCargoObjectIfUnreferenced({ bucket: 'cargo-files', key });

let seedRow = (status: Row['status']) => {
  let row: Row = { oid: sim.nextOid++, storeId: key, status };
  sim.rows.push(row);
  return row;
};

let activeRows = () => sim.rows.filter(row => row.storeId === key && row.status === 'active');

let ticks = async (count: number) => {
  for (let i = 0; i < count; i++) await new Promise<void>(resolve => setImmediate(resolve));
};

let expectObjectPresentIffReferenced = () => {
  expect(sim.objects.has(key)).toBe(activeRows().length > 0);
};

let resetSim = () => {
  sim.objects.clear();
  sim.rows.length = 0;
  sim.locks.clear();
  sim.putCalls.length = 0;
  sim.enqueued.length = 0;
  sim.delayed.length = 0;
  sim.hooks.afterPut = null;
  sim.hooks.beforeCommit = null;
  sim.hooks.yield = null;
};

describe('content-addressed writes and guarded deletes', () => {
  beforeEach(resetSim);

  it('keeps the object when the write completes before the delete runs', async () => {
    sim.objects.set(key, content);
    seedRow('deleted');

    let row = await upload();
    expect(row.storeId).toBe(key);

    expect(await guardedDelete()).toBe(false);
    expectObjectPresentIffReferenced();
    expect(sim.objects.has(key)).toBe(true);
  });

  it('rewrites the object when the delete completes before the write starts', async () => {
    sim.objects.set(key, content);
    seedRow('deleted');

    expect(await guardedDelete()).toBe(true);
    expect(sim.objects.has(key)).toBe(false);

    await upload();
    expectObjectPresentIffReferenced();
    expect(sim.objects.has(key)).toBe(true);
  });

  it('re-puts the object when a delete runs between the PUT and the row commit', async () => {
    seedRow('deleted');

    let deleteResult: boolean | undefined;
    sim.hooks.afterPut = async () => {
      sim.hooks.afterPut = null;
      deleteResult = await guardedDelete();
    };

    await upload();

    expect(deleteResult).toBe(true);
    expect(sim.putCalls.map(call => call.key)).toEqual([key, key]);
    expectObjectPresentIffReferenced();
    expect(sim.objects.has(key)).toBe(true);
  });

  it('blocks a delete on the lock until the row commits, then keeps the object', async () => {
    let reachedCommit!: () => void;
    let releaseCommit!: () => void;
    let reached = new Promise<void>(resolve => (reachedCommit = resolve));
    let gate = new Promise<void>(resolve => (releaseCommit = resolve));

    sim.hooks.beforeCommit = async () => {
      sim.hooks.beforeCommit = null;
      reachedCommit();
      await gate;
    };

    let uploading = upload();
    await reached;

    let deleteSettled = false;
    let pendingDelete = guardedDelete().finally(() => (deleteSettled = true));
    await ticks(10);
    expect(deleteSettled).toBe(false);

    releaseCommit();
    await uploading;

    expect(await pendingDelete).toBe(false);
    expect(sim.putCalls).toHaveLength(1);
    expectObjectPresentIffReferenced();
  });

  it('queues a guarded delete when the row write fails after the PUT', async () => {
    await expect(upload({ fail: true })).rejects.toThrow('createFile failed');

    expect(sim.rows).toHaveLength(0);
    expect(sim.enqueued).toEqual([key]);

    expect(await guardedDelete()).toBe(true);
    expectObjectPresentIffReferenced();
  });

  it('schedules a delayed guarded delete that removes the object if the caller rolls back', async () => {
    await expect(
      withTransaction(async () => {
        await upload();
        throw new Error('outer rollback');
      })
    ).rejects.toThrow('outer rollback');

    expect(sim.rows).toHaveLength(0);
    expect(sim.delayed).toEqual([{ keys: [key], delay: expect.any(Number) }]);
    expect(sim.delayed[0]!.delay).toBeGreaterThan(0);

    expect(await guardedDelete()).toBe(true);
    expectObjectPresentIffReferenced();
  });

  it('keeps the object when the delayed delete runs after the caller committed', async () => {
    await withTransaction(async () => {
      await upload();
    });

    expect(sim.delayed).toHaveLength(1);
    expect(await guardedDelete()).toBe(false);
    expect(sim.objects.has(key)).toBe(true);
  });

  it('does not schedule a delayed delete outside a transaction', async () => {
    await upload();

    expect(sim.delayed).toEqual([]);
  });

  it('never removes an object another active file still references', async () => {
    seedRow('active');
    await expect(upload({ fail: true })).rejects.toThrow('createFile failed');

    expect(await guardedDelete()).toBe(false);
    expect(sim.objects.has(key)).toBe(true);
  });

  it('skips the PUT and the check for buffered content', async () => {
    let row = await writeContentAddressedFile({
      content,
      buffered: true,
      create: createFileRow()
    });

    expect(row.storeId).toBe(key);
    expect(sim.putCalls).toHaveLength(0);
    expect(sim.objects.has(key)).toBe(false);
  });

  it('treats an already missing object as deleted and ignores empty keys', async () => {
    expect(await deleteCargoObjectIfUnreferenced({ bucket: 'cargo-files', key: '' })).toBe(
      false
    );
    await expect(guardedDelete()).rejects.toMatchObject({ statusCode: 404 });
  });

  it('ends with the object present iff a row references it under random interleavings', async () => {
    for (let seed = 1; seed <= 150; seed++) {
      resetSim();

      let state = seed;
      let random = () => {
        state = (state * 1103515245 + 12345) % 2147483648;
        return state / 2147483648;
      };
      sim.hooks.yield = async () => {
        await ticks(Math.floor(random() * 4));
      };

      if (random() < 0.5) {
        sim.objects.set(key, content);
        seedRow('active');
      }

      let writers = Math.floor(random() * 4) + 1;
      let deleters = Math.floor(random() * 4) + 1;

      let operations = [
        ...Array.from({ length: writers }, () => async () => {
          await sim.hooks.yield!();
          await upload({ fail: random() < 0.2 }).catch(() => {});
        }),
        ...Array.from({ length: deleters }, () => async () => {
          await sim.hooks.yield!();
          let candidates = activeRows();
          let target = candidates[Math.floor(random() * candidates.length)];
          if (target) target.status = 'deleted';
          await guardedDelete().catch(() => false);
        })
      ];

      await Promise.all(operations.map(operation => operation()));

      for (let queued of sim.enqueued.splice(0)) {
        await deleteCargoObjectIfUnreferenced({ bucket: 'cargo-files', key: queued }).catch(
          () => false
        );
      }

      if (activeRows().length > 0) {
        expect(sim.objects.has(key), `seed ${seed}`).toBe(true);
        continue;
      }

      // A row deleted while its upload was still re-checking the object can leave it behind; the
      // daily cleanup re-runs the guard for every deleted File that still has a storeId.
      await guardedDelete().catch(() => false);
      expect(sim.objects.has(key), `seed ${seed}`).toBe(false);
    }
  });
});

describe('putCargoObject', () => {
  beforeEach(resetSim);

  let randomBytes = (seed: number) => {
    let length = (seed * 7919) % 2048;
    return Uint8Array.from({ length }, (_, index) => (seed * 31 + index * 17) % 256);
  };

  it('never writes a content-addressed key whose bytes do not match it', async () => {
    for (let seed = 0; seed < 200; seed++) {
      let bytes = randomBytes(seed);
      let other = randomBytes(seed + 1000);
      let matchingKey = getContentAddressedKey(
        createHash('sha256').update(bytes).digest('hex')
      );
      let wrongKey = getContentAddressedKey(createHash('sha256').update(other).digest('hex'));

      if (wrongKey !== matchingKey) {
        await expect(
          putCargoObject({ key: wrongKey, content: bytes, contentType: 'text/plain' })
        ).rejects.toThrow(/does not match/);
      }

      await putCargoObject({ key: matchingKey, content: bytes, contentType: 'text/plain' });
    }

    expect(sim.putCalls).toHaveLength(200);
    for (let call of sim.putCalls) {
      expect(call.key).toBe(
        getContentAddressedKey(createHash('sha256').update(call.content).digest('hex'))
      );
      expect(call.contentType).toBe('application/octet-stream');
    }
  });

  it('writes other keys unchanged with their content type', async () => {
    await putCargoObject({ key: 'random_key', content, contentType: 'text/markdown' });
    await putCargoObject({ key: 'template_abc', content, contentType: 'image/png' });

    expect(sim.putCalls.map(call => [call.key, call.contentType])).toEqual([
      ['random_key', 'text/markdown'],
      ['template_abc', 'image/png']
    ]);
  });
});
