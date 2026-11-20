import { beforeEach, describe, expect, it, vi } from 'vitest';

let { db, projectService } = vi.hoisted(() => ({
  db: {
    project: { findUnique: vi.fn() },
    billingWindow: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      updateMany: vi.fn(),
      create: vi.fn()
    }
  },
  projectService: {
    getProjectWithOrganization: vi.fn(),
    setBillingRestriction: vi.fn()
  }
}));

vi.mock('@mtsrc/ai-gateway-db', () => ({
  db,
  getId: (model: string) => ({ oid: 1n, id: `${model}_new` })
}));

vi.mock('@mtsrc/ai-gateway-module-scope', () => ({ projectService }));

let { billingService } = await import('../src/services/billing');

beforeEach(() => {
  vi.clearAllMocks();
  db.project.findUnique.mockResolvedValue({ oid: 42n });
  db.billingWindow.updateMany.mockResolvedValue({ count: 1 });
  db.billingWindow.findMany.mockResolvedValue([]);
});

describe('billingService.charge', () => {
  it('converts dollars and adds requests to the next flush', async () => {
    billingService.charge({ projectId: 'agpr_1', costUsd: 0.0021, requests: 1 });
    billingService.charge({ projectId: 'agpr_1', costUsd: 0.000018 });
    await billingService.flush();

    expect(db.billingWindow.updateMany).toHaveBeenCalledOnce();
    expect(db.billingWindow.updateMany.mock.calls[0]![0].data).toEqual({
      costNanoUsd: { increment: 2_118_000n },
      requestCount: { increment: 1 },
      revision: { increment: 1 }
    });
  });
});

describe('billingService.listWindows', () => {
  let from = new Date('2026-11-20T15:00:00Z');
  let to = new Date('2026-11-20T15:30:00Z');

  it('lists windows that start in the range in a stable order', async () => {
    await billingService.listWindows({ from, to, statuses: ['complete'] });

    expect(db.billingWindow.findMany).toHaveBeenCalledWith({
      where: { windowStart: { gte: from, lt: to }, status: { in: ['complete'] } },
      orderBy: [{ windowStart: 'asc' }, { id: 'asc' }],
      take: 101,
      include: { project: { include: { organization: true } } }
    });
  });

  it('continues after the cursor window', async () => {
    let cursorStart = new Date('2026-11-20T15:05:00Z');
    db.billingWindow.findUnique.mockResolvedValue({ id: 'agbw_5', windowStart: cursorStart });

    await billingService.listWindows({ from, to, after: 'agbw_5' });

    expect(db.billingWindow.findMany.mock.calls[0]![0].where).toEqual({
      windowStart: { gte: from, lt: to },
      status: undefined,
      OR: [
        { windowStart: { gt: cursorStart } },
        { windowStart: cursorStart, id: { gt: 'agbw_5' } }
      ]
    });
  });

  it('reports whether another page exists', async () => {
    db.billingWindow.findMany.mockResolvedValue([{ id: 'a' }, { id: 'b' }, { id: 'c' }]);

    let page = await billingService.listWindows({ from, to, limit: 2 });

    expect(page.items.map(item => item.id)).toEqual(['a', 'b']);
    expect(page.hasMore).toBe(true);
    expect(db.billingWindow.findMany.mock.calls[0]![0].take).toBe(3);
  });

  it('caps the page size', async () => {
    await billingService.listWindows({ from, to, limit: 10_000 });

    expect(db.billingWindow.findMany.mock.calls[0]![0].take).toBe(501);
  });
});

describe('billingService.sealWindows', () => {
  it('completes open windows once their grace period is over', async () => {
    db.billingWindow.updateMany.mockResolvedValue({ count: 3 });

    let result = await billingService.sealWindows({ now: new Date('2026-11-20T15:11:00Z') });

    expect(result).toEqual({ sealed: 3 });
    expect(db.billingWindow.updateMany).toHaveBeenCalledWith({
      where: { status: 'open', windowEnd: { lte: new Date('2026-11-20T15:10:00Z') } },
      data: { status: 'complete' }
    });
  });
});

describe('billingService.setRestriction', () => {
  it('sets the restriction on the project', async () => {
    let project = { id: 'agpr_1' };
    projectService.getProjectWithOrganization.mockResolvedValue(project);
    projectService.setBillingRestriction.mockResolvedValue(project);

    await billingService.setRestriction({
      projectId: 'agpr_1',
      restriction: { reason: 'Out of credits.' }
    });

    expect(projectService.setBillingRestriction).toHaveBeenCalledWith({
      project,
      restriction: { reason: 'Out of credits.' }
    });
  });
});
