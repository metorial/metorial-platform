import { beforeEach, describe, expect, it, vi } from 'vitest';

let mocks = vi.hoisted(() => ({
  getStoreResourceKindAccessWhere: vi.fn(),
  getEffectiveSkillAccessLevel: vi.fn(async (d: { level: string }) => d.level)
}));

vi.mock('@metorial/module-access', () => ({
  skillStoreResourceKind: { kind: 'skill' },
  getStoreResourceKindAccessWhere: mocks.getStoreResourceKindAccessWhere,
  getEffectiveSkillAccessLevel: mocks.getEffectiveSkillAccessLevel
}));

import { assertSkillRecordScope, getSkillMetadataWriteAccessWhere } from './skillAccess';

let scope = {
  project: { oid: 1n },
  instance: { oid: 2n }
} as any;
let actor = {
  oid: 3n,
  projectOid: 1n,
  consumerProfileOid: 4n,
  consumerOid: 5n
} as any;

describe('skill metadata write access', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('requires a store-level write grant on the exact scoped skill', async () => {
    mocks.getStoreResourceKindAccessWhere.mockResolvedValue({ marker: 'skill-store-write' });

    let where = await getSkillMetadataWriteAccessWhere({
      ...scope,
      skill: { oid: 6n },
      authorization: {
        type: 'restricted',
        resourceActor: actor,
        accessTags: [{ accessTagOid: 7n }]
      }
    });

    expect(mocks.getStoreResourceKindAccessWhere).toHaveBeenCalledWith({
      kind: { kind: 'skill' },
      accessTags: [{ accessTagOid: 7n }],
      level: 'write'
    });
    expect(where).toEqual({
      oid: 6n,
      projectOid: 1n,
      instanceOid: 2n,
      store: { is: { marker: 'skill-store-write' } }
    });
    expect(where).not.toHaveProperty('accessTagEntities');
    expect(where).not.toHaveProperty('skillGroupItems');
  });

  it('checks the read grant for consumers with organization member access', async () => {
    mocks.getEffectiveSkillAccessLevel.mockResolvedValueOnce('read');
    mocks.getStoreResourceKindAccessWhere.mockResolvedValue({ marker: 'skill-store-read' });
    let authorization = {
      type: 'restricted' as const,
      resourceActor: actor,
      accessTags: [{ accessTagOid: 7n }]
    };

    let where = await getSkillMetadataWriteAccessWhere({
      ...scope,
      skill: { oid: 6n },
      authorization
    });

    expect(mocks.getEffectiveSkillAccessLevel).toHaveBeenCalledWith({
      project: scope.project,
      authorization,
      level: 'write'
    });
    expect(mocks.getStoreResourceKindAccessWhere).toHaveBeenCalledWith({
      kind: { kind: 'skill' },
      accessTags: [{ accessTagOid: 7n }],
      level: 'read'
    });
    expect(where).toMatchObject({ store: { is: { marker: 'skill-store-read' } } });
  });

  it('leaves privileged metadata writes to the scoped record assertion', async () => {
    await expect(
      getSkillMetadataWriteAccessWhere({
        ...scope,
        skill: { oid: 6n },
        authorization: { type: 'privileged' }
      })
    ).resolves.toBeUndefined();
    expect(mocks.getStoreResourceKindAccessWhere).not.toHaveBeenCalled();
  });

  it('rejects a privileged skill record from a sibling group', () => {
    expect(() =>
      assertSkillRecordScope({
        ...scope,
        skill: {
          projectOid: 1n,
          instanceOid: 999n,
          store: {
            projectOid: 1n,
            instanceOid: 999n
          }
        }
      })
    ).toThrow('Skill does not belong to the supplied project and instance');
  });
});
