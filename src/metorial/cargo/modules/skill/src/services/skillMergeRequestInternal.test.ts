import { describe, expect, it } from 'vitest';
import { getVisibleSkillMergeRequestWhere } from './skillMergeRequestAccess';

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
  ])('allows privileged authorization to see every request in scope', authorization => {
    expect(
      getVisibleSkillMergeRequestWhere({
        projectOid,
        instanceOid,
        authorization
      })
    ).toEqual({
      projectOid,
      instanceOid
    });
  });

  it('keeps restricted consumers limited to visible source or target stores', () => {
    let where = getVisibleSkillMergeRequestWhere({
      projectOid,
      instanceOid,
      authorization: {
        type: 'restricted',
        resourceActor: actor,
        accessTags: [{ accessTagOid: 5n }]
      } as any
    });
    let readableStoreWhere = {
      OR: [
        { access: { in: ['public_read', 'public_write'] } },
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
