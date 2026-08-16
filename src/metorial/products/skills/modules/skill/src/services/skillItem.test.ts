import { beforeEach, describe, expect, it, vi } from 'vitest';

let { db, mocks } = vi.hoisted(() => {
  let mocks = {
    addAfterTransactionHook: vi.fn(),
    ensureDelegatedSkill: vi.fn(),
    enqueueReconcile: vi.fn(),
    findSkill: vi.fn(),
    findIntegration: vi.fn(),
    findSkillIntegration: vi.fn(),
    findSkillItem: vi.fn(),
    findSkillItemOrThrow: vi.fn(),
    updateSkillItem: vi.fn(),
    updateSkillIntegration: vi.fn()
  };
  let db = {
    skill: { findFirst: mocks.findSkill },
    integration: { findFirst: mocks.findIntegration },
    skillIntegration: {
      findFirst: mocks.findSkillIntegration,
      update: mocks.updateSkillIntegration
    },
    skillItem: {
      findFirst: mocks.findSkillItem,
      findFirstOrThrow: mocks.findSkillItemOrThrow,
      update: mocks.updateSkillItem
    }
  };
  return { db, mocks };
});

vi.mock('@metorial-subspace/db', () => ({
  db,
  getId: vi.fn(() => ({ oid: 100n, id: 'generated' })),
  withTransaction: vi.fn(async (callback: (tx: typeof db) => unknown) => await callback(db)),
  addAfterTransactionHook: mocks.addAfterTransactionHook
}));

vi.mock('@metorial-subspace/list-utils', () => ({
  checkDeletedEdit: vi.fn(),
  checkDeletedRelation: vi.fn(),
  normalizeDateFilter: vi.fn(),
  normalizeStatusForGet: vi.fn(() => ({ noParent: {} })),
  normalizeStatusForList: vi.fn(() => ({ noParent: {} }))
}));

vi.mock('@metorial-subspace/module-tenant', () => ({
  subspaceScopeService: {
    ensureForInstance: vi.fn(async () => ({
      tenant: { oid: 1n, onlyAllowTrustedProviders: false },
      solution: { oid: 2 },
      environment: { oid: 3n }
    }))
  }
}));

vi.mock('../queues/reconcileSkillProviderLinks', () => ({
  reconcileSkillProviderLinksQueue: {
    add: mocks.enqueueReconcile
  }
}));

vi.mock('./resource', () => ({
  skillResourceService: {
    ensureDelegatedSkill: mocks.ensureDelegatedSkill
  }
}));

import { skillItemService } from './skillItem';

let skill = { oid: 10n, id: 'skl_1', status: 'active' as const };
let integration = { oid: 20n, id: 'int_1', status: 'active' as const };
let archivedItem = {
  oid: 30n,
  id: 'ski_1',
  status: 'archived' as const,
  type: 'integration' as const,
  createdAt: new Date(),
  skill,
  integration: {
    oid: 40n,
    status: 'archived' as const,
    integration
  },
  provider: null
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.addAfterTransactionHook.mockImplementation(async callback => await callback());
  mocks.findSkill.mockResolvedValue(skill);
  mocks.findIntegration.mockResolvedValue(integration);
});

describe('skillItemService', () => {
  it('reactivates an archived integration item and reconciles providers', async () => {
    mocks.findSkillIntegration.mockResolvedValue({
      oid: 40n,
      status: 'archived',
      itemOid: archivedItem.oid,
      item: archivedItem
    });
    mocks.findSkillItemOrThrow.mockResolvedValue({
      ...archivedItem,
      status: 'active',
      integration: { ...archivedItem.integration, status: 'active' }
    });

    let result = await skillItemService.createSkillItem({
      instance: {} as any,
      input: {
        skillId: skill.id,
        type: 'integration',
        integrationId: integration.id
      }
    });

    expect(mocks.updateSkillItem).toHaveBeenCalledWith({
      where: { oid: archivedItem.oid },
      data: { status: 'active' }
    });
    expect(mocks.updateSkillIntegration).toHaveBeenCalledWith({
      where: { oid: 40n },
      data: { status: 'active' }
    });
    expect(mocks.enqueueReconcile).toHaveBeenCalledWith({ skillId: skill.id });
    expect(result.integration?.id).toBe(integration.id);
  });

  it('archives an item and its integration link', async () => {
    mocks.findSkillItem.mockResolvedValue(archivedItem);
    mocks.updateSkillItem.mockResolvedValue({
      ...archivedItem,
      status: 'archived'
    });

    await skillItemService.archiveSkillItem({
      instance: {} as any,
      skillItem: archivedItem
    });

    expect(mocks.updateSkillIntegration).toHaveBeenCalledWith({
      where: { oid: archivedItem.integration.oid },
      data: { status: 'archived' }
    });
    expect(mocks.enqueueReconcile).toHaveBeenCalledWith({ skillId: skill.id });
  });
});
