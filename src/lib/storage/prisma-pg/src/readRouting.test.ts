import { describe, expect, it, vi } from 'vitest';
import {
  createReadRouter,
  createReplicaCircuit,
  isReplicaReadScope,
  withPrimaryReads,
  withReplicaReads
} from './readRouting';

let setup = (opts: { replicaError?: unknown } = {}) => {
  let now = 0;
  let circuit = createReplicaCircuit({ openMs: 1000, now: () => now });
  let replica = {
    user: {
      findMany: vi.fn(async () => {
        if (opts.replicaError) throw opts.replicaError;
        return 'replica';
      })
    }
  };
  let router = createReadRouter({ name: 'test', replica, circuit });
  let query = vi.fn(async () => 'primary');

  let run = (operation: string, internal: Record<string, unknown> = {}) =>
    router.query.$allOperations({
      args: { where: { id: 1 } },
      model: 'User',
      operation,
      query,
      __internalParams: { jsModelName: 'user', ...internal }
    });

  return { run, replica, query, advance: (ms: number) => (now += ms) };
};

describe('read routing', () => {
  it('reads from the primary by default', async () => {
    let { run, replica } = setup();

    expect(await run('findMany')).toBe('primary');
    expect(replica.user.findMany).not.toHaveBeenCalled();
  });

  it('reads from the replica inside withReplicaReads', async () => {
    let { run, replica } = setup();

    expect(await withReplicaReads(() => run('findMany'))).toBe('replica');
    expect(replica.user.findMany).toHaveBeenCalledWith({ where: { id: 1 } });
  });

  it('runs lazy thenables inside the scope', async () => {
    let { run } = setup();
    let lazy = { then: (resolve: (value: unknown) => void) => resolve(run('findMany')) };

    expect(await withReplicaReads(() => lazy as PromiseLike<unknown>)).toBe('replica');
  });

  it('keeps transaction reads on the primary', async () => {
    let { run } = setup();

    expect(await withReplicaReads(() => run('findMany', { transaction: {} }))).toBe('primary');
  });

  it('switches the rest of the scope to the primary after a write', async () => {
    let { run } = setup();

    let results = await withReplicaReads(async () => [
      await run('findMany'),
      await run('update'),
      await run('findMany'),
      isReplicaReadScope()
    ]);

    expect(results).toEqual(['replica', 'primary', 'primary', false]);
  });

  it('lets withPrimaryReads win over an outer or inner replica scope', async () => {
    let { run } = setup();

    expect(await withReplicaReads(() => withPrimaryReads(() => run('findMany')))).toBe(
      'primary'
    );
    expect(await withPrimaryReads(() => withReplicaReads(() => run('findMany')))).toBe(
      'primary'
    );
  });

  it('retries on the primary and opens the circuit when the replica fails', async () => {
    let { run, replica, advance } = setup({
      replicaError: new Error('Connection terminated')
    });

    expect(await withReplicaReads(() => run('findMany'))).toBe('primary');
    expect(await withReplicaReads(() => run('findMany'))).toBe('primary');
    expect(replica.user.findMany).toHaveBeenCalledOnce();

    advance(1001);
    await withReplicaReads(() => run('findMany'));
    expect(replica.user.findMany).toHaveBeenCalledTimes(2);
  });

  it('retries query-level errors on the primary without opening the circuit', async () => {
    let { run, replica } = setup({
      replicaError: Object.assign(new Error('not found'), { code: 'P2025' })
    });

    expect(await withReplicaReads(() => run('findMany'))).toBe('primary');
    await withReplicaReads(() => run('findMany'));
    expect(replica.user.findMany).toHaveBeenCalledTimes(2);
  });

  it('keeps raw queries on the primary', async () => {
    let { replica } = setup();
    let router = createReadRouter({ name: 'test', replica });
    let query = vi.fn(async () => 'primary');

    let result = await withReplicaReads(() =>
      router.query.$allOperations({
        args: [],
        model: undefined,
        operation: '$queryRaw',
        query
      })
    );

    expect(result).toBe('primary');
  });
});
