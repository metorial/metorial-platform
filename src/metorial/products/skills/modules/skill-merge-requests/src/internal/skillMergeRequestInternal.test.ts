import { beforeEach, describe, expect, it, vi } from 'vitest';

let mocks = vi.hoisted(() => ({
  getStoreResourceAccessWhere: vi.fn()
}));

vi.mock('@metorial/module-access', () => ({
  getStoreResourceAccessWhere: mocks.getStoreResourceAccessWhere
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

  it('limits restricted consumers to stores they can read through grants or created', async () => {
    let storeAccessWhere = { OR: [{ oid: { in: [9n] } }] };
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
