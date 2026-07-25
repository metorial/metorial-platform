import { describe, expect, it } from 'vitest';
import { getVisibleSkillMergeRequestWhere } from './skillMergeRequestAccess';

let resourceTenantOid = 1n;
let resourceGroupOid = 2n;
let actor = {
  oid: 3n,
  resourceTenantOid,
  consumerProfileOid: 4n
} as any;

describe('skill merge request visibility', () => {
  it.each([
    { type: 'privileged' } as const,
    { type: 'privileged', resourceActor: actor } as const
  ])('allows privileged authorization to see every request in scope', authorization => {
    expect(
      getVisibleSkillMergeRequestWhere({
        resourceTenantOid,
        resourceGroupOid,
        authorization
      })
    ).toEqual({
      resourceTenantOid,
      resourceGroupOid
    });
  });

  it('keeps restricted consumers limited to visible source or target stores', () => {
    let where = getVisibleSkillMergeRequestWhere({
      resourceTenantOid,
      resourceGroupOid,
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
      resourceTenantOid,
      resourceGroupOid,
      OR: [
        { sourceSkill: { store: readableStoreWhere } },
        { targetSkill: { store: readableStoreWhere } }
      ]
    });
  });
});
