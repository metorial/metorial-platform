import { beforeEach, describe, expect, it, vi } from 'vitest';

let { db } = vi.hoisted(() => {
  let model = () => ({ update: vi.fn(), updateMany: vi.fn(), findMany: vi.fn() });

  return {
    db: {
      integrationInstance: model(),
      integrationInstanceGroup: model(),
      magicMcpServerBacking: model(),
      sessionTemplate: model(),
      ephemeralManagedSession: model()
    }
  };
});

vi.mock('@metorial-subspace/db', () => ({ db }));

import {
  setIntegrationInstanceGroupOwnerLock,
  setIntegrationInstanceGroupOwnerOnlyVisibility,
  setIntegrationInstanceOwnerLock,
  setIntegrationInstanceOwnerOnlyVisibility
} from '../src/lib/ownerLock';

describe('owner flag cascade', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.sessionTemplate.findMany.mockResolvedValue([{ oid: 7n }]);
  });

  it('cascades owner-only visibility from an instance to backings, templates and ephemeral sessions', async () => {
    await setIntegrationInstanceOwnerOnlyVisibility({ oid: 1n }, true);

    expect(db.integrationInstance.update).toHaveBeenCalledWith({
      where: { oid: 1n },
      data: { isOwnerOnlyVisible: true }
    });
    expect(db.magicMcpServerBacking.updateMany).toHaveBeenCalledWith({
      where: { integrationInstanceOid: 1n, isOwnerOnlyVisible: false },
      data: { isOwnerOnlyVisible: true }
    });
    expect(db.sessionTemplate.updateMany).toHaveBeenCalledWith({
      where: { oid: { in: [7n] }, isOwnerOnlyVisible: false },
      data: { isOwnerOnlyVisible: true }
    });
    expect(db.ephemeralManagedSession.updateMany).toHaveBeenCalledWith({
      where: { sessionTemplateOid: { in: [7n] }, isOwnerOnlyVisible: false },
      data: { isOwnerOnlyVisible: true }
    });
  });

  it('does not touch the owner-only flag when changing the owner lock', async () => {
    await setIntegrationInstanceOwnerLock({ oid: 1n }, true);

    expect(db.integrationInstance.update).toHaveBeenCalledWith({
      where: { oid: 1n },
      data: { isOwnerLocked: true }
    });
    expect(db.sessionTemplate.updateMany).toHaveBeenCalledWith({
      where: { oid: { in: [7n] }, isOwnerLocked: false },
      data: { isOwnerLocked: true }
    });
  });

  it('skips template cascades when there are no templates', async () => {
    db.sessionTemplate.findMany.mockResolvedValue([]);

    await setIntegrationInstanceOwnerOnlyVisibility({ oid: 1n }, false);

    expect(db.sessionTemplate.updateMany).not.toHaveBeenCalled();
    expect(db.ephemeralManagedSession.updateMany).not.toHaveBeenCalled();
  });

  it('cascades owner-only visibility from a group to its templates', async () => {
    await setIntegrationInstanceGroupOwnerOnlyVisibility({ oid: 2n }, false);

    expect(db.integrationInstanceGroup.update).toHaveBeenCalledWith({
      where: { oid: 2n },
      data: { isOwnerOnlyVisible: false }
    });
    expect(db.sessionTemplate.findMany).toHaveBeenCalledWith({
      where: { integrationInstanceGroupOid: 2n },
      select: { oid: true }
    });
    expect(db.ephemeralManagedSession.updateMany).toHaveBeenCalledWith({
      where: { sessionTemplateOid: { in: [7n] }, isOwnerOnlyVisible: true },
      data: { isOwnerOnlyVisible: false }
    });
  });
});

it('cascades the group owner lock to templates and ephemeral sessions', async () => {
  db.sessionTemplate.findMany.mockResolvedValue([{ oid: 7n }]);

  await setIntegrationInstanceGroupOwnerLock({ oid: 2n }, true);

  expect(db.integrationInstanceGroup.update).toHaveBeenCalledWith({
    where: { oid: 2n },
    data: { isOwnerLocked: true }
  });
  expect(db.sessionTemplate.updateMany).toHaveBeenCalledWith({
    where: { oid: { in: [7n] }, isOwnerLocked: false },
    data: { isOwnerLocked: true }
  });
  expect(db.ephemeralManagedSession.updateMany).toHaveBeenCalledWith({
    where: { sessionTemplateOid: { in: [7n] }, isOwnerLocked: false },
    data: { isOwnerLocked: true }
  });
});
