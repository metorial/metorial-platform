import { describe, expect, it, vi } from 'vitest';

vi.mock('@metorial/module-access', () => ({
  consumerSkillReadRoles: ['consumer#instance.skill:read'],
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
          storeParticipants: {
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
});
