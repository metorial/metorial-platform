import { beforeEach, describe, expect, it, vi } from 'vitest';

let mocks = vi.hoisted(() => ({
  findManySkillTemplates: vi.fn(),
  findUniqueSkill: vi.fn(),
  findUniqueSkillTemplate: vi.fn(),
  ensureForInstance: vi.fn(),
  subspaceFindUniqueSkill: vi.fn(),
  subspaceFindUniqueSkillTemplate: vi.fn(),
  subspaceUpsertSkillTemplate: vi.fn(),
  createSkillEntity: vi.fn(),
  updateSkillEntity: vi.fn(),
  upsertSkill: vi.fn()
}));

vi.mock('@metorial/db', () => ({
  db: {
    skillTemplate: {
      findMany: mocks.findManySkillTemplates,
      findUnique: mocks.findUniqueSkillTemplate
    },
    skill: {
      findUnique: mocks.findUniqueSkill
    }
  }
}));

vi.mock('@metorial-subspace/db', () => ({
  db: {
    skill: { findUnique: mocks.subspaceFindUniqueSkill },
    skillTemplate: {
      findUnique: mocks.subspaceFindUniqueSkillTemplate,
      upsert: mocks.subspaceUpsertSkillTemplate
    }
  },
  getId: vi.fn(() => ({})),
  withTransaction: vi.fn(async (cb: any) =>
    cb({
      skillEntity: { create: mocks.createSkillEntity, update: mocks.updateSkillEntity },
      skill: { upsert: mocks.upsertSkill }
    })
  )
}));

vi.mock('@metorial-subspace/module-tenant', () => ({
  subspaceScopeService: {
    ensureForInstance: mocks.ensureForInstance
  }
}));

vi.mock('../queues/reconcileSkillProviderLinks', () => ({
  reconcileSkillProviderLinksQueue: {
    add: vi.fn()
  }
}));

import { skillResourceService } from './resource';

beforeEach(() => {
  vi.clearAllMocks();
  mocks.findManySkillTemplates.mockResolvedValue([
    {
      id: 'skt_plain',
      storeId: 'str_legacy',
      storeTemplate: {
        id: 'stt_plain'
      },
      instance: null
    }
  ]);

  mocks.ensureForInstance.mockResolvedValue({
    tenant: { oid: 10n, projectOid: 11n },
    environment: { oid: 20n, instanceOid: 21n },
    solution: { oid: 30n }
  });
  mocks.subspaceFindUniqueSkill.mockResolvedValue(null);
  mocks.createSkillEntity.mockResolvedValue({ oid: 40n, ownerSkillOid: 50n });
  mocks.upsertSkill.mockResolvedValue({ oid: 50n });
});

describe('skillResourceService.hydrateSkillTemplates', () => {
  it('preserves the scoped backing store ID selected by the template service', async () => {
    let [template] = await skillResourceService.hydrateSkillTemplates([
      {
        id: 'skt_plain',
        storeTemplate: {
          storeId: 'str_scoped'
        }
      }
    ]);

    expect(template.storeId).toBe('str_scoped');
    expect(template.localSkillTemplate.storeId).toBe('str_scoped');
  });

  it('does not fall back to a legacy store when the scoped backing is unavailable', async () => {
    let [template] = await skillResourceService.hydrateSkillTemplates([
      {
        id: 'skt_plain',
        storeTemplate: {
          storeId: undefined
        }
      }
    ]);

    expect(template.storeId).toBeNull();
    expect(template.localSkillTemplate.storeId).toBeNull();
  });

  it('keeps the stored ID for unscoped hydration callers', async () => {
    let [template] = await skillResourceService.hydrateSkillTemplates([
      {
        id: 'skt_plain'
      }
    ]);

    expect(template.storeId).toBe('str_legacy');
  });
});

describe('skillResourceService.ensureDelegatedSkill', () => {
  beforeEach(() => {
    mocks.findUniqueSkill.mockResolvedValue({
      id: 'skl_delegated',
      instance: { id: 'ins_1' },
      parentSkill: null,
      parentSkillTemplate: null
    });
  });

  it('mirrors the project and instance references onto the skill entity', async () => {
    await skillResourceService.ensureDelegatedSkill({ id: 'skl_delegated' });

    expect(mocks.createSkillEntity).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tenantOid: 10n,
          projectOid: 11n,
          environmentOid: 20n,
          instanceOid: 21n
        })
      })
    );
  });

  it('mirrors the project and instance references onto the skill', async () => {
    await skillResourceService.ensureDelegatedSkill({ id: 'skl_delegated' });

    expect(mocks.upsertSkill).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          tenantOid: 10n,
          projectOid: 11n,
          environmentOid: 20n,
          instanceOid: 21n
        })
      })
    );
  });

  it('leaves the mirrored references null while the scope is unlinked', async () => {
    mocks.ensureForInstance.mockResolvedValue({
      tenant: { oid: 10n, projectOid: null },
      environment: { oid: 20n, instanceOid: null },
      solution: { oid: 30n }
    });

    await skillResourceService.ensureDelegatedSkill({ id: 'skl_delegated' });

    let entityData = mocks.createSkillEntity.mock.calls[0]![0].data;
    expect(entityData.projectOid).toBeNull();
    expect(entityData.instanceOid).toBeNull();
    expect(entityData.tenantOid).toBe(10n);

    let skillData = mocks.upsertSkill.mock.calls[0]![0].create;
    expect(skillData.projectOid).toBeNull();
    expect(skillData.instanceOid).toBeNull();
  });

  it('keeps the skill upsert keyed on the legacy identifier', async () => {
    await skillResourceService.ensureDelegatedSkill({ id: 'skl_delegated' });

    expect(mocks.upsertSkill.mock.calls[0]![0].where).toEqual({ id: 'skl_delegated' });
  });
});

describe('skillResourceService.ensureDelegatedSkillTemplate', () => {
  it('mirrors the references for tenant-owned templates', async () => {
    mocks.findUniqueSkillTemplate.mockResolvedValue({
      id: 'skt_owned',
      owner: 'tenant',
      instance: { id: 'ins_1' },
      storeTemplate: null
    });

    await skillResourceService.ensureDelegatedSkillTemplate({ id: 'skt_owned' });

    expect(mocks.subspaceUpsertSkillTemplate).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          tenantOid: 10n,
          projectOid: 11n,
          environmentOid: 20n,
          instanceOid: 21n
        })
      })
    );
  });

  it('mirrors the owner condition instead of scoping system templates', async () => {
    mocks.findUniqueSkillTemplate.mockResolvedValue({
      id: 'skt_system',
      owner: 'system',
      instance: { id: 'ins_1' },
      storeTemplate: null
    });

    await skillResourceService.ensureDelegatedSkillTemplate({ id: 'skt_system' });

    let data = mocks.subspaceUpsertSkillTemplate.mock.calls[0]![0].create;
    expect(data.tenantOid).toBeNull();
    expect(data.projectOid).toBeNull();
    expect(data.environmentOid).toBeNull();
    expect(data.instanceOid).toBeNull();
  });
});
