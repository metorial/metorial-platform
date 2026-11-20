import { beforeEach, describe, expect, it, vi } from 'vitest';

let { db } = vi.hoisted(() => ({
  db: {
    project: { findUnique: vi.fn() },
    billingWindow: { updateMany: vi.fn(), create: vi.fn() }
  }
}));

vi.mock('@mtsrc/ai-gateway-db', () => ({
  db,
  getId: (model: string) => ({ oid: 1n, id: `${model}_new` })
}));

let { createBillingWindowWriter } = await import('../src/lib/writer');

let uniqueViolation = Object.assign(new Error('Unique constraint failed'), { code: 'P2002' });
let charge = { projectId: 'gwpr_1', costNanoUsd: 1500n, requestCount: 1 };

let at = (iso: string) => {
  let time = new Date(iso);
  return {
    now: () => time,
    set: (next: string) => (time = new Date(next))
  };
};

beforeEach(() => {
  vi.clearAllMocks();
  db.project.findUnique.mockImplementation(async ({ where }: { where: { id: string } }) =>
    where.id.startsWith('gwpr_') ? { oid: 42n } : null
  );
  db.billingWindow.updateMany.mockResolvedValue({ count: 0 });
  db.billingWindow.create.mockResolvedValue({});
});

describe('createBillingWindowWriter', () => {
  it('increments the open window of the project and bumps its revision', async () => {
    db.billingWindow.updateMany.mockResolvedValue({ count: 1 });
    let clock = at('2026-11-20T15:07:42Z');

    await createBillingWindowWriter(clock)(charge);

    expect(db.billingWindow.updateMany).toHaveBeenCalledWith({
      where: {
        projectOid: 42n,
        windowStart: new Date('2026-11-20T15:05:00Z'),
        status: 'open'
      },
      data: {
        costNanoUsd: { increment: 1500n },
        requestCount: { increment: 1 },
        revision: { increment: 1 }
      }
    });
    expect(db.billingWindow.create).not.toHaveBeenCalled();
  });

  it('creates the window when it does not exist yet', async () => {
    await createBillingWindowWriter(at('2026-11-20T15:07:42Z'))(charge);

    expect(db.billingWindow.create).toHaveBeenCalledWith({
      data: {
        oid: 1n,
        id: 'billingWindow_new',
        projectOid: 42n,
        windowStart: new Date('2026-11-20T15:05:00Z'),
        windowEnd: new Date('2026-11-20T15:10:00Z'),
        costNanoUsd: 1500n,
        requestCount: 1
      }
    });
  });

  it('increments the window another replica created first', async () => {
    db.billingWindow.create.mockRejectedValueOnce(uniqueViolation);
    db.billingWindow.updateMany
      .mockResolvedValueOnce({ count: 0 })
      .mockResolvedValueOnce({ count: 1 });

    await createBillingWindowWriter(at('2026-11-20T15:07:42Z'))(charge);

    expect(db.billingWindow.updateMany).toHaveBeenCalledTimes(2);
    expect(db.billingWindow.create).toHaveBeenCalledTimes(1);
  });

  it('moves a charge on to the open window when its window was sealed meanwhile', async () => {
    let clock = at('2026-11-20T15:09:59Z');
    db.billingWindow.create.mockImplementationOnce(async () => {
      clock.set('2026-11-20T15:11:00Z');
      throw uniqueViolation;
    });

    await createBillingWindowWriter(clock)(charge);

    let starts = db.billingWindow.updateMany.mock.calls.map(call =>
      (call[0].where.windowStart as Date).toISOString()
    );
    expect(starts).toEqual(['2026-11-20T15:05:00.000Z', '2026-11-20T15:10:00.000Z']);
    expect(db.billingWindow.create).toHaveBeenLastCalledWith({
      data: expect.objectContaining({ windowStart: new Date('2026-11-20T15:10:00Z') })
    });
  });

  it('gives up after repeated conflicts so the accumulator retries later', async () => {
    db.billingWindow.create.mockRejectedValue(uniqueViolation);

    await expect(
      createBillingWindowWriter(at('2026-11-20T15:07:42Z'))(charge)
    ).rejects.toThrow(/Could not record billing usage/);
    expect(db.billingWindow.create).toHaveBeenCalledTimes(3);
  });

  it('rethrows database errors other than conflicts', async () => {
    db.billingWindow.create.mockRejectedValue(new Error('connection reset'));

    await expect(
      createBillingWindowWriter(at('2026-11-20T15:07:42Z'))(charge)
    ).rejects.toThrow('connection reset');
  });

  it('drops usage of a project the gateway does not know', async () => {
    let warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    await createBillingWindowWriter()({ ...charge, projectId: 'missing' });

    expect(db.billingWindow.updateMany).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledOnce();
    warn.mockRestore();
  });

  it('looks each project up once', async () => {
    db.billingWindow.updateMany.mockResolvedValue({ count: 1 });
    let write = createBillingWindowWriter();

    await write({ ...charge, projectId: 'gwpr_cached' });
    await write({ ...charge, projectId: 'gwpr_cached' });

    expect(
      db.project.findUnique.mock.calls.filter(call => call[0].where.id == 'gwpr_cached')
    ).toHaveLength(1);
  });
});
