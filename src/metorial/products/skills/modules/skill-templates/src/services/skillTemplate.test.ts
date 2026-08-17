import { beforeEach, describe, expect, it, vi } from 'vitest';

let { mocks, db } = vi.hoisted(() => {
  let mocks = {
    createStoreTemplate: vi.fn(),
    updateStoreTemplate: vi.fn(),
    createStoreFromTemplate: vi.fn(),
    createSkillTemplate: vi.fn(),
    updateSkillTemplate: vi.fn(),
    findUniqueSkillTemplate: vi.fn(),
    findFirstSkillTemplate: vi.fn(),
    findSkillTemplate: vi.fn(),
    enqueueLifecycle: vi.fn()
  };
  let db = {
    skillTemplate: {
      create: mocks.createSkillTemplate,
      update: mocks.updateSkillTemplate,
      findUnique: mocks.findUniqueSkillTemplate,
      findFirst: mocks.findFirstSkillTemplate,
      findUniqueOrThrow: mocks.findSkillTemplate
    }
  };

  return { mocks, db };
});

vi.mock('@metorial/db', () => ({
  db,
  withTransaction: vi.fn(async (callback: (tx: typeof db) => unknown) => await callback(db))
}));

vi.mock('@lowerdeck/id', () => ({
  generatePlainId: vi.fn(() => 'ABCDE')
}));

vi.mock('@metorial/skills-search', () => ({
  voyager: {},
  voyagerIndex: {},
  voyagerSource: Promise.resolve({})
}));

vi.mock('@metorial/list-utils', () => ({
  normalizeDateFilter: vi.fn(),
  resolveSkillTemplates: vi.fn(),
  resolveStoreTemplates: vi.fn()
}));

vi.mock('@metorial/skills-common', () => ({
  getProjectTenantIdentifier: vi.fn(() => 'mte-pro-1')
}));

vi.mock('@metorial/module-access', () => ({
  accessTagService: {
    getAccessTagFilter: vi.fn(async () => undefined)
  },
  consumerSkillReadRoles: []
}));

vi.mock('@metorial/module-skill', () => ({
  skillResourceService: {},
  skillService: {}
}));

vi.mock('@metorial/module-store', () => ({
  storeService: {
    createStoreFromTemplate: mocks.createStoreFromTemplate
  },
  storeTemplateService: {
    createStoreTemplate: mocks.createStoreTemplate,
    updateStoreTemplate: mocks.updateStoreTemplate
  }
}));

vi.mock('@metorial/db', () => ({
  db,
  ID: {
    generateId: vi.fn()
  },
  withTransaction: vi.fn(async (callback: (tx: typeof db) => unknown) => await callback(db))
}));

vi.mock('../queues/lifecycle', () => ({
  enqueueSkillTemplateLifecycle: mocks.enqueueLifecycle
}));

import { skillTemplateService } from './skillTemplate';

let scope = {
  project: { oid: 1n },
  instance: { oid: 2n }
};

describe('skillTemplateService.createSkillTemplate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    let plainTemplate = {
      id: 'skt_plain',
      oid: 5n,
      storeTemplate: {
        id: 'stt_plain',
        oid: 6n,
        sourceStore: null,
        backingStores: [],
        items: []
      }
    };
    mocks.findUniqueSkillTemplate.mockResolvedValue(plainTemplate);
    mocks.updateStoreTemplate.mockResolvedValue(plainTemplate.storeTemplate);
    mocks.updateSkillTemplate.mockResolvedValue(plainTemplate);
    mocks.createStoreFromTemplate.mockResolvedValue({
      id: 'str_1',
      oid: 9n
    });
    mocks.createStoreTemplate.mockResolvedValue({
      id: 'stt_1',
      oid: 10n
    });
    mocks.createSkillTemplate.mockResolvedValue({
      id: 'skt_1'
    });
    mocks.findSkillTemplate.mockResolvedValue({
      id: 'skt_1',
      storeId: 'str_1'
    });
  });

  it('creates a store from the plain template when no source is provided', async () => {
    let skillTemplate = await skillTemplateService.createSkillTemplate({
      ...scope,
      input: {
        id: 'skt_1',
        name: 'My Skill Template'
      }
    });

    expect(mocks.createStoreFromTemplate).toHaveBeenCalledWith({
      ...scope,
      authorization: { type: 'privileged' },
      input: {
        templateId: 'stt_plain',
        name: 'Skill Template Store - My Skill Template',
        access: 'public_read'
      }
    });
    expect(mocks.createStoreTemplate).toHaveBeenCalledWith({
      ...scope,
      input: {
        name: 'My Skill Template',
        storeId: 'str_1',
        items: undefined
      }
    });
    expect(mocks.createSkillTemplate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          id: 'skt_1',
          slug: 'my-skill-template-abcde',
          storeId: 'str_1',
          storeTemplateId: 'stt_1'
        })
      })
    );
    expect(skillTemplate.storeId).toBe('str_1');
  });

  it('still rejects multiple explicit sources', async () => {
    await expect(
      skillTemplateService.createSkillTemplate({
        ...scope,
        input: {
          id: 'skt_1',
          name: 'My Skill Template',
          storeId: 'str_1',
          items: []
        }
      })
    ).rejects.toThrow(
      'Provide exactly one of skillId, storeId, or items when creating a skill template'
    );

    expect(mocks.createStoreTemplate).not.toHaveBeenCalled();
  });
});

describe('skillTemplateService.deleteSkillTemplate', () => {
  it('archives the template without deleting its store template', async () => {
    let template = {
      id: 'skt_1',
      oid: 7n,
      status: 'active',
      storeTemplate: {
        id: 'stt_1',
        projectOid: scope.project.oid,
        instanceOid: scope.instance.oid,
        sourceStore: null,
        backingStores: [],
        items: []
      }
    };
    mocks.findFirstSkillTemplate.mockResolvedValue(template);
    mocks.updateSkillTemplate.mockResolvedValue({ ...template, status: 'archived' });

    let archived = await skillTemplateService.deleteSkillTemplate({
      ...scope,
      skillTemplateId: template.id
    });

    expect(mocks.updateSkillTemplate).toHaveBeenCalledWith({
      where: { oid: template.oid },
      data: { status: 'archived' },
      include: expect.any(Object)
    });
    expect(mocks.enqueueLifecycle).toHaveBeenCalledWith({
      skillTemplateId: template.id,
      event: 'archived'
    });
    expect(archived.status).toBe('archived');
  });
});
