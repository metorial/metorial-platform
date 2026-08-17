import { beforeEach, describe, expect, it, vi } from 'vitest';

let mocks = vi.hoisted(() => ({
  findManySkillTemplates: vi.fn(),
  findUniqueSkill: vi.fn(),
  findManySkills: vi.fn(),
  findManyInstances: vi.fn(),
  findUniqueSkillTemplate: vi.fn(),
  ensureForInstance: vi.fn(),
  subspaceFindUniqueSkill: vi.fn(),
  subspaceFindManySkills: vi.fn(),
  subspaceFindManySkillIntegrations: vi.fn(),
  subspaceFindManySkillProviderLinks: vi.fn(),
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
      findUnique: mocks.findUniqueSkill,
      findMany: mocks.findManySkills
    },
    instance: {
      findMany: mocks.findManyInstances
    }
  }
}));

vi.mock('@metorial-subspace/db', () => ({
  db: {
    skill: {
      findUnique: mocks.subspaceFindUniqueSkill,
      findMany: mocks.subspaceFindManySkills
    },
    skillIntegration: {
      findMany: mocks.subspaceFindManySkillIntegrations
    },
    skillProviderLink: {
      findMany: mocks.subspaceFindManySkillProviderLinks
    },
    skillTemplate: {
      findUnique: mocks.subspaceFindUniqueSkillTemplate,
      upsert: mocks.subspaceUpsertSkillTemplate
    }
  },
  ID: {
    generateId: vi.fn(() => Promise.resolve('generated'))
  },
  snowflake: {
    nextId: vi.fn(() => 99n)
  },
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
  mocks.subspaceFindManySkills.mockResolvedValue([]);
  mocks.subspaceFindManySkillIntegrations.mockResolvedValue([]);
  mocks.subspaceFindManySkillProviderLinks.mockResolvedValue([]);
  mocks.findManySkills.mockResolvedValue([]);
  mocks.findManyInstances.mockResolvedValue([]);
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

let instance = { id: 'ins_1', oid: 21n } as any;

describe('skillResourceService.hydrateDelegatedSkillResources', () => {
  it('loads preview integrations and providers without listings or skill items', async () => {
    mocks.subspaceFindManySkills.mockResolvedValue([
      {
        id: 'skl_1',
        skillIntegrations: [
          {
            integration: { id: 'int_1', oid: 1n, name: 'GitHub' }
          }
        ],
        skillProviderLinks: [
          {
            provider: { id: 'prv_1', oid: 2n, name: 'GitHub', slug: 'github' }
          }
        ]
      }
    ]);

    let [resource] = await skillResourceService.hydrateDelegatedSkillResources({
      instance,
      skillIds: ['skl_1']
    });

    expect(resource.items).toEqual([]);
    expect(resource.integrations).toEqual([
      { id: 'int_1', oid: 1n, name: 'GitHub' }
    ]);
    expect(resource.providers).toEqual([
      { id: 'prv_1', oid: 2n, name: 'GitHub', slug: 'github' }
    ]);

    let query = mocks.subspaceFindManySkills.mock.calls[0]![0];
    expect(query.include).not.toHaveProperty('skillItems');
    expect(JSON.stringify(query.include)).not.toContain('listing');
  });

  it('loads skill items without listings when copy hydration is requested', async () => {
    mocks.subspaceFindManySkills.mockResolvedValue([
      {
        id: 'skl_1',
        skillIntegrations: [],
        skillProviderLinks: [],
        skillItems: [
          {
            skill: { id: 'skl_1' },
            integration: {
              integration: { id: 'int_1', oid: 1n }
            },
            provider: null
          }
        ]
      }
    ]);

    let [resource] = await skillResourceService.hydrateDelegatedSkillResources({
      instance,
      skillIds: ['skl_1'],
      includeItems: true
    });

    expect(resource.items).toHaveLength(1);
    expect(resource.items[0]!.skillId).toBe('skl_1');
    expect(resource.items[0]!.integration).toEqual({ id: 'int_1', oid: 1n });

    let query = mocks.subspaceFindManySkills.mock.calls[0]![0];
    expect(query.include).toHaveProperty('skillItems');
    expect(JSON.stringify(query.include)).not.toContain('listing');
  });
});

describe('skillResourceService.hydrateSkills', () => {
  it('uses the provided instance and the preview subspace hydrate', async () => {
    let now = new Date();
    mocks.findManySkills.mockImplementation(async (args: { include?: unknown }) => {
      if (args.include) {
        return [
          {
            id: 'skl_1',
            skillEntityId: 'skl_1',
            instanceOid: 21n,
            name: 'Skill',
            slug: 'skill',
            description: null,
            parentSkill: null,
            parentSkillTemplate: null,
            forkedFromSkillVersion: null,
            createdByResourceActor: null,
            store: { oid: 9n, id: 'str_1' },
            createdAt: now,
            updatedAt: now
          }
        ];
      }

      return [
        {
          id: 'skl_1',
          name: 'Skill',
          slug: 'skill',
          description: null,
          parentSkill: null,
          createdAt: now,
          updatedAt: now
        }
      ];
    });
    mocks.subspaceFindManySkills.mockResolvedValue([
      {
        id: 'skl_1',
        skillIntegrations: [],
        skillProviderLinks: [
          { provider: { id: 'prv_1', name: 'GitHub', slug: 'github' } }
        ]
      }
    ]);

    let [skill] = await skillResourceService.hydrateSkills([{ id: 'skl_1' }], {
      instance
    });

    expect(skill.providers).toEqual([{ id: 'prv_1', name: 'GitHub', slug: 'github' }]);
    expect(skill.localSkill.store).toEqual({ oid: 9n, id: 'str_1' });
    expect(mocks.findManyInstances).not.toHaveBeenCalled();
    expect(JSON.stringify(mocks.subspaceFindManySkills.mock.calls[0]![0].include)).not.toContain(
      'listing'
    );
    expect(mocks.subspaceFindManySkills.mock.calls[0]![0].include).not.toHaveProperty(
      'skillItems'
    );
  });
});

describe('skillResourceService.listDelegatedSkillIdsByResources', () => {
  it('finds skills through provider links instead of hydrating every skill', async () => {
    mocks.subspaceFindManySkillProviderLinks.mockResolvedValue([
      { skill: { id: 'skl_a' } },
      { skill: { id: 'skl_b' } }
    ]);

    let ids = await skillResourceService.listDelegatedSkillIdsByResources({
      instance,
      providerIds: ['prv_1']
    });

    expect(ids).toEqual(['skl_a', 'skl_b']);
    expect(mocks.subspaceFindManySkills).not.toHaveBeenCalled();
    expect(mocks.subspaceFindManySkillProviderLinks).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          provider: { id: { in: ['prv_1'] } },
          skill: {
            tenantOid: 10n,
            solutionOid: 30n,
            environmentOid: 20n
          }
        })
      })
    );
  });

  it('intersects integration and provider matches', async () => {
    mocks.subspaceFindManySkillIntegrations.mockResolvedValue([
      { skill: { id: 'skl_a' } },
      { skill: { id: 'skl_b' } }
    ]);
    mocks.subspaceFindManySkillProviderLinks.mockResolvedValue([
      { skill: { id: 'skl_b' } },
      { skill: { id: 'skl_c' } }
    ]);

    let ids = await skillResourceService.listDelegatedSkillIdsByResources({
      instance,
      integrationIds: ['int_1'],
      providerIds: ['prv_1']
    });

    expect(ids).toEqual(['skl_b']);
    expect(mocks.subspaceFindManySkills).not.toHaveBeenCalled();
  });
});
