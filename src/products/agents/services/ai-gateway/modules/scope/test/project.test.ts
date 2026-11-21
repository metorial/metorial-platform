import { beforeEach, describe, expect, it, vi } from 'vitest';

let { db, fire } = vi.hoisted(() => ({
  db: {
    project: { update: vi.fn(), findUnique: vi.fn(), upsert: vi.fn() },
    instance: { findMany: vi.fn() }
  },
  fire: vi.fn()
}));

vi.mock('@mtsrc/ai-gateway-db', () => ({ db, snowflake: { nextId: () => 99n } }));
vi.mock('@mtsrc/ai-gateway-events', () => ({ Events: { fire } }));

let { projectService } = await import('../src/services/project');

let restrictedSince = new Date('2026-11-01T00:00:00Z');

let project = (overrides: Record<string, unknown> = {}) =>
  ({
    oid: 7n,
    id: 'agpr_1',
    ref: 'prj_1',
    organizationOid: 1n,
    organization: { oid: 1n, id: 'agor_1', ref: 'org_1' },
    platformLimits: [],
    platformLimitsSyncedAt: null,
    disabledAt: null,
    disabledReason: null,
    billingRestrictedAt: null,
    billingRestrictionReason: null,
    ...overrides
  }) as any;

let updateData = () => db.project.update.mock.calls[0]![0].data;
let changes = () => fire.mock.calls.map(call => call[1].change);

beforeEach(() => {
  vi.clearAllMocks();
  db.project.update.mockImplementation(async ({ data }: { data: Record<string, unknown> }) =>
    project(data)
  );
  db.instance.findMany.mockResolvedValue([{ id: 'agin_1' }]);
});

describe('upsertProject', () => {
  it('gives a new project its ref as id', async () => {
    db.project.findUnique.mockResolvedValue(null);
    db.project.upsert.mockImplementation(
      async ({ create }: { create: Record<string, unknown> }) => project(create)
    );

    await projectService.upsertProject({
      organization: project().organization,
      input: { ref: 'prj_core', name: 'Production' }
    });

    expect(db.project.upsert.mock.calls[0]![0].create).toEqual({
      oid: 99n,
      id: 'prj_core',
      ref: 'prj_core',
      name: 'Production',
      organizationOid: 1n
    });
  });
});

describe('setBillingRestriction', () => {
  it('restricts a project and tells listeners', async () => {
    await projectService.setBillingRestriction({
      project: project(),
      restriction: { reason: 'Out of credits.' }
    });

    expect(updateData()).toEqual({
      billingRestrictedAt: expect.any(Date),
      billingRestrictionReason: 'Out of credits.'
    });
    expect(fire).toHaveBeenCalledWith('scope.project.changed:after', {
      organizationId: 'agor_1',
      projectId: 'agpr_1',
      instanceIds: ['agin_1'],
      change: 'restrictions_changed'
    });
  });

  it('keeps the original restriction time when the restriction is pushed again', async () => {
    await projectService.setBillingRestriction({
      project: project({
        billingRestrictedAt: restrictedSince,
        billingRestrictionReason: 'Out of credits.'
      }),
      restriction: { reason: 'Out of credits.' }
    });

    expect(updateData().billingRestrictedAt).toBe(restrictedSince);
    expect(fire).not.toHaveBeenCalled();
  });

  it('tells listeners when only the reason changed', async () => {
    await projectService.setBillingRestriction({
      project: project({
        billingRestrictedAt: restrictedSince,
        billingRestrictionReason: 'A'
      }),
      restriction: { reason: 'B' }
    });

    expect(updateData()).toEqual({
      billingRestrictedAt: restrictedSince,
      billingRestrictionReason: 'B'
    });
    expect(changes()).toEqual(['restrictions_changed']);
  });

  it('lifts a restriction', async () => {
    await projectService.setBillingRestriction({
      project: project({
        billingRestrictedAt: restrictedSince,
        billingRestrictionReason: 'A'
      }),
      restriction: null
    });

    expect(updateData()).toEqual({
      billingRestrictedAt: null,
      billingRestrictionReason: null
    });
    expect(changes()).toEqual(['restrictions_changed']);
  });

  it('does nothing visible when an unrestricted project is lifted', async () => {
    await projectService.setBillingRestriction({ project: project(), restriction: null });

    expect(fire).not.toHaveBeenCalled();
  });
});

describe('syncPlatformLimits', () => {
  let limits = [{ metric: 'requests' as const, amount: 60, intervalSeconds: 60 }];

  it('leaves the disabled state alone when the sync does not carry it', async () => {
    await projectService.syncPlatformLimits({
      project: project({ disabledAt: restrictedSince }),
      limits
    });

    expect(updateData()).not.toHaveProperty('disabledAt');
    expect(changes()).toEqual(['limits_changed']);
  });

  it('disables a project and reports both changes', async () => {
    await projectService.syncPlatformLimits({
      project: project(),
      limits,
      disabled: { reason: 'Not on your plan.' }
    });

    expect(updateData()).toMatchObject({
      platformLimits: limits,
      disabledAt: expect.any(Date),
      disabledReason: 'Not on your plan.'
    });
    expect(changes()).toEqual(['limits_changed', 'restrictions_changed']);
  });

  it('re-enables a project', async () => {
    await projectService.syncPlatformLimits({
      project: project({ disabledAt: restrictedSince, disabledReason: 'Not on your plan.' }),
      limits: [],
      disabled: null
    });

    expect(updateData()).toMatchObject({ disabledAt: null, disabledReason: null });
    expect(changes()).toEqual(['restrictions_changed']);
  });

  it('only stamps the sync time when nothing changed', async () => {
    await projectService.syncPlatformLimits({
      project: project({ platformLimits: limits }),
      limits,
      disabled: null
    });

    expect(updateData().platformLimitsSyncedAt).toBeInstanceOf(Date);
    expect(fire).not.toHaveBeenCalled();
  });
});
