import { beforeEach, describe, expect, it, vi } from 'vitest';

let mocks = vi.hoisted(() => ({
  getAccessTagFilter: vi.fn()
}));

vi.mock('@metorial/module-access', () => ({
  consumerSkillWriteRoles: ['consumer#instance.skill:write'],
  accessTagService: {
    getAccessTagFilter: mocks.getAccessTagFilter
  }
}));

import { assertSkillRecordScope, getSkillMetadataWriteAccessWhere } from './skillAccess';

let accessTagFilter = {
  some: {
    accessTagOid: { in: [7n] },
    accessTagPolicy: {
      roles: { hasSome: ['consumer#instance.skill:write'] }
    }
  }
};
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
    mocks.getAccessTagFilter.mockResolvedValue(accessTagFilter);
  });

  it('requires a direct write grant on the exact scoped skill', async () => {
    await expect(
      getSkillMetadataWriteAccessWhere({
        ...scope,
        skill: { oid: 6n },
        authorization: {
          type: 'restricted',
          resourceActor: actor,
          accessTags: [{ accessTagOid: 7n }]
        }
      })
    ).resolves.toEqual({
      oid: 6n,
      projectOid: 1n,
      instanceOid: 2n,
      accessTagEntities: accessTagFilter
    });
  });

  it('does not authorize through a shared store or another owning skill', async () => {
    let where = await getSkillMetadataWriteAccessWhere({
      ...scope,
      skill: { oid: 6n },
      authorization: {
        type: 'restricted',
        resourceActor: actor,
        accessTags: [{ accessTagOid: 7n }]
      }
    });

    expect(where).not.toHaveProperty('store');
    expect(where).not.toHaveProperty('skillGroupItems');
    expect(where).toMatchObject({
      oid: 6n,
      instanceOid: 2n
    });
  });

  it('leaves privileged metadata writes to the scoped record assertion', async () => {
    await expect(
      getSkillMetadataWriteAccessWhere({
        ...scope,
        skill: { oid: 6n },
        authorization: { type: 'privileged' }
      })
    ).resolves.toBeUndefined();
    expect(mocks.getAccessTagFilter).not.toHaveBeenCalled();
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
