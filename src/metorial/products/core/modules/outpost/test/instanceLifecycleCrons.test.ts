import { beforeEach, describe, expect, it, vi } from 'vitest';

// @ts-ignore
const { db } = await import('@metorial/db');

vi.mock('@metorial/db', () => ({
  db: {
    outpostInstance: { findMany: vi.fn(), findUnique: vi.fn() },
    outpostInstanceEvent: { findMany: vi.fn(), deleteMany: vi.fn() },
    outpostInstanceKeyRotation: { findMany: vi.fn(), deleteMany: vi.fn() }
  }
}));

let crons = new Map<string, () => Promise<void>>();
vi.mock('@metorial/cron', () => ({
  createCron: (opts: { name: string }, handler: any) => {
    crons.set(opts.name, handler);
    return { name: opts.name };
  }
}));

let queues = new Map<string, { added: any[]; process?: (data: any) => Promise<void> }>();
vi.mock('@metorial/queue', () => {
  class QueueRetryError extends Error {}

  return {
    QueueRetryError,
    combineQueueProcessors: (processors: any[]) => processors,
    createQueue: (opts: { name: string }) => {
      let queue = { added: [] as any[] } as any;
      queues.set(opts.name, queue);

      return {
        addMany: async (items: any[]) => queue.added.push(...items),
        add: async (item: any) => queue.added.push(item),
        process: (handler: any) => {
          queue.process = handler;
          return { name: opts.name };
        }
      };
    }
  };
});

vi.mock('@metorial/fabric', () => ({ Fabric: { fire: vi.fn() } }));
vi.mock('@metorial/audit-scope', () => ({ createSystemAuditScope: () => ({ scope: true }) }));

let deactivateInstance = vi.fn();
let deleteInstance = vi.fn();
vi.mock('../src/services/outpostInstance', () => ({
  outpostInstanceService: {
    deactivateInstance: (...args: any[]) => deactivateInstance(...args),
    deleteInstance: (...args: any[]) => deleteInstance(...args)
  }
}));

await import('../src/cron/deactivateInstances');
await import('../src/cron/cleanupInstances');
await import('../src/cron/cleanupInstanceLogs');

const { Fabric } = await import('@metorial/fabric');
const { OUTPOST_INSTANCE_RETENTION_MS, OUTPOST_INSTANCE_LOG_RETENTION_MS } =
  await import('../src/lib/constants');

let queue = (name: string) => queues.get(name)!;
let outpost = { id: 'otp_1', organization: { id: 'org_1' } };

describe('instance deactivation cron', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    queue('outp/instance/deactivateSingle').added = [];
  });

  it('fans out the instances whose token has lapsed', async () => {
    (db.outpostInstance.findMany as any).mockResolvedValue([{ id: 'otn_1' }, { id: 'otn_2' }]);

    await crons.get('outp/instance/deactivate')!();

    expect((db.outpostInstance.findMany as any).mock.calls[0][0].where).toMatchObject({
      status: 'active',
      expiresAt: { lte: expect.any(Date) }
    });
    expect(queue('outp/instance/deactivateSingle').added).toEqual([
      { outpostInstanceId: 'otn_1' },
      { outpostInstanceId: 'otn_2' }
    ]);
  });

  it('enqueues nothing when every instance is still live', async () => {
    (db.outpostInstance.findMany as any).mockResolvedValue([]);

    await crons.get('outp/instance/deactivate')!();

    expect(queue('outp/instance/deactivateSingle').added).toEqual([]);
  });

  it('deactivates an instance whose token has lapsed', async () => {
    (db.outpostInstance.findUnique as any).mockResolvedValue({
      id: 'otn_1',
      status: 'active',
      expiresAt: new Date(Date.now() - 1_000),
      outpost
    });

    await queue('outp/instance/deactivateSingle').process!({ outpostInstanceId: 'otn_1' });

    expect(deactivateInstance).toHaveBeenCalledWith(
      expect.objectContaining({ outpost, organization: outpost.organization })
    );
  });

  it('leaves an instance that re-registered between the sweep and the job', async () => {
    (db.outpostInstance.findUnique as any).mockResolvedValue({
      id: 'otn_1',
      status: 'active',
      expiresAt: new Date(Date.now() + 60_000),
      outpost
    });

    await queue('outp/instance/deactivateSingle').process!({ outpostInstanceId: 'otn_1' });

    expect(deactivateInstance).not.toHaveBeenCalled();
  });
});

describe('instance retention cron', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    queue('outp/instance/cleanupSingle').added = [];
  });

  it('sweeps instances that have been inactive past the retention window', async () => {
    (db.outpostInstance.findMany as any).mockResolvedValue([{ id: 'otn_1' }]);

    await crons.get('outp/instance/cleanup')!();

    let where = (db.outpostInstance.findMany as any).mock.calls[0][0].where;
    expect(where.status).toBe('inactive');
    expect(Date.now() - where.OR[0].expiresAt.lte.getTime()).toBeGreaterThanOrEqual(
      OUTPOST_INSTANCE_RETENTION_MS - 1_000
    );
    // Instances that never got a token still have to age out, via updatedAt.
    expect(where.OR[1]).toMatchObject({ expiresAt: null });

    expect(queue('outp/instance/cleanupSingle').added).toEqual([
      { outpostInstanceId: 'otn_1' }
    ]);
  });

  it('deletes an instance that is still past its retention window', async () => {
    let instance = {
      id: 'otn_1',
      status: 'inactive',
      expiresAt: new Date(Date.now() - OUTPOST_INSTANCE_RETENTION_MS - 60_000),
      updatedAt: new Date(),
      outpost
    };
    (db.outpostInstance.findUnique as any).mockResolvedValue(instance);

    await queue('outp/instance/cleanupSingle').process!({ outpostInstanceId: 'otn_1' });

    expect(deleteInstance).toHaveBeenCalledWith({
      instance,
      outpost,
      organization: outpost.organization
    });
  });

  /** An outpost coming back under the same identifier reactivates the row we were about to drop. */
  it('leaves an instance that came back before the job ran', async () => {
    (db.outpostInstance.findUnique as any).mockResolvedValue({
      id: 'otn_1',
      status: 'active',
      expiresAt: new Date(Date.now() + 60_000),
      updatedAt: new Date(),
      outpost
    });

    await queue('outp/instance/cleanupSingle').process!({ outpostInstanceId: 'otn_1' });

    expect(deleteInstance).not.toHaveBeenCalled();
  });
});

describe('instance log retention cron', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    queue('outp/instance/cleanupLogsSingle').added = [];
  });

  it('fans out once per instance with expired events or key rotations', async () => {
    (db.outpostInstanceEvent.findMany as any).mockResolvedValue([{ instanceOid: 700n }]);
    (db.outpostInstanceKeyRotation.findMany as any).mockResolvedValue([
      { instanceOid: 700n },
      { instanceOid: 701n }
    ]);
    (db.outpostInstance.findMany as any).mockResolvedValue([{ id: 'otn_1' }, { id: 'otn_2' }]);

    await crons.get('outp/instance/cleanupLogs')!();

    expect(queue('outp/instance/cleanupLogsSingle').added).toEqual([
      { outpostInstanceId: 'otn_1' },
      { outpostInstanceId: 'otn_2' }
    ]);
    expect((db.outpostInstance.findMany as any).mock.calls[0][0].where.oid.in).toEqual([
      700n,
      701n
    ]);
  });

  it('deletes expired events and key rotations, auditing the sweep once with counts', async () => {
    (db.outpostInstance.findUnique as any).mockResolvedValue({
      oid: 700n,
      id: 'otn_1',
      identifier: 'oti_789',
      outpost
    });
    (db.outpostInstanceEvent.deleteMany as any).mockResolvedValue({ count: 4 });
    (db.outpostInstanceKeyRotation.deleteMany as any).mockResolvedValue({ count: 2 });

    await queue('outp/instance/cleanupLogsSingle').process!({ outpostInstanceId: 'otn_1' });

    let cutoff = (db.outpostInstanceEvent.deleteMany as any).mock.calls[0][0].where.createdAt
      .lte;
    expect(Date.now() - cutoff.getTime()).toBeGreaterThanOrEqual(
      OUTPOST_INSTANCE_LOG_RETENTION_MS - 1_000
    );

    expect(Fabric.fire).toHaveBeenCalledTimes(1);
    expect(Fabric.fire).toHaveBeenCalledWith(
      'outpost_instance.pruned:after',
      expect.objectContaining({ deleted: { events: 4, keyRotations: 2 } })
    );
  });

  it('does not audit a sweep that deleted nothing', async () => {
    (db.outpostInstance.findUnique as any).mockResolvedValue({
      oid: 700n,
      id: 'otn_1',
      identifier: 'oti_789',
      outpost
    });
    (db.outpostInstanceEvent.deleteMany as any).mockResolvedValue({ count: 0 });
    (db.outpostInstanceKeyRotation.deleteMany as any).mockResolvedValue({ count: 0 });

    await queue('outp/instance/cleanupLogsSingle').process!({ outpostInstanceId: 'otn_1' });

    expect(Fabric.fire).not.toHaveBeenCalled();
  });
});
