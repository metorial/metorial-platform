import { beforeEach, describe, expect, it, vi } from 'vitest';

let mocks = vi.hoisted(() => ({
  isStoreResourceFlagEnabled: vi.fn(),
  getStoreResourceAccessWhere: vi.fn()
}));

vi.mock('@metorial/module-access', () => ({
  consumerSkillReadRoles: ['consumer#instance.skill:read'],
  isStoreResourceFlagEnabled: mocks.isStoreResourceFlagEnabled,
  getStoreResourceAccessWhere: mocks.getStoreResourceAccessWhere,
  accessTagService: {
    getAccessTagFilter: async (d: { tags?: { accessTagOid: bigint }[]; roles: string[] }) =>
      d.tags
        ? {
            some: {
              accessTagOid: { in: d.tags.map(tag => tag.accessTagOid) },
              accessTagPolicy: { roles: { hasSome: d.roles } }
            }
          }
        : undefined
  }
}));

import { getVisibleSkillMergeRequestWhere } from '../lib/skillMergeRequestAccess';

let projectOid = 1n;
let instanceOid = 2n;
let actor = {
  oid: 3n,
  projectOid: 1n,
  consumerProfileOid: 4n
} as any;

beforeEach(() => {
  vi.clearAllMocks();
  mocks.isStoreResourceFlagEnabled.mockResolvedValue(false);
});

describe('skill merge request visibility', () => {
  it.each([
    { type: 'privileged' } as const,
    { type: 'privileged', resourceActor: actor } as const
  ])('allows privileged authorization to see every request in scope', async authorization => {
    expect(
      await getVisibleSkillMergeRequestWhere({
        projectOid,
        instanceOid,
        authorization
      })
    ).toEqual({
      projectOid,
      instanceOid
    });
  });

  it('limits restricted consumers to readable stores and skills shared through their access tags', async () => {
    let where = await getVisibleSkillMergeRequestWhere({
      projectOid,
      instanceOid,
      authorization: {
        type: 'restricted',
        resourceActor: actor,
        accessTags: [{ accessTagOid: 5n }]
      } as any
    });
    let accessTagFilter = {
      some: {
        accessTagOid: { in: [5n] },
        accessTagPolicy: { roles: { hasSome: ['consumer#instance.skill:read'] } }
      }
    };
    let readableStoreWhere = {
      OR: [
        { access: { in: ['public_read', 'public_write'] }, skill: { is: null } },
        {
          skill: {
            is: {
              status: 'active',
              OR: [
                { accessTagEntities: accessTagFilter },
                {
                  skillGroupItems: {
                    some: {
                      status: 'active',
                      skillGroup: { status: 'active', accessTagEntities: accessTagFilter }
                    }
                  }
                }
              ]
            }
          }
        },
        { createdByResourceActorOid: actor.oid },
        {
          storeParticipantActors: {
            some: {
              resourceActorOid: actor.oid,
              permissions: {
                hasSome: ['content_read', 'content_write']
              }
            }
          }
        }
      ]
    };

    expect(where).toEqual({
      projectOid,
      instanceOid,
      OR: [
        { sourceSkill: { store: readableStoreWhere } },
        { targetSkill: { store: readableStoreWhere } }
      ]
    });
  });

  it('reads store-level grants when store-access-v2 is on', async () => {
    let storeAccessWhere = { OR: [{ oid: { in: [9n] } }] };
    mocks.isStoreResourceFlagEnabled.mockResolvedValue(true);
    mocks.getStoreResourceAccessWhere.mockResolvedValue(storeAccessWhere);

    let where = await getVisibleSkillMergeRequestWhere({
      projectOid,
      instanceOid,
      authorization: {
        type: 'restricted',
        resourceActor: actor,
        accessTags: [{ accessTagOid: 5n }]
      } as any
    });
    let readableStoreWhere = {
      OR: [storeAccessWhere, { createdByResourceActorOid: actor.oid }]
    };

    expect(mocks.isStoreResourceFlagEnabled).toHaveBeenCalledWith({
      project: { oid: projectOid },
      flag: 'store-access-v2'
    });
    expect(mocks.getStoreResourceAccessWhere).toHaveBeenCalledWith({
      accessTags: [{ accessTagOid: 5n }],
      level: 'read'
    });
    expect(where).toEqual({
      projectOid,
      instanceOid,
      OR: [
        { sourceSkill: { store: readableStoreWhere } },
        { targetSkill: { store: readableStoreWhere } }
      ]
    });
  });
});
