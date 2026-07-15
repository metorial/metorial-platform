import { beforeEach, describe, expect, it, vi } from 'vitest';

let { db } = vi.hoisted(() => ({
  db: {
    skillGroup: {
      findMany: vi.fn(),
      findFirst: vi.fn()
    }
  }
}));

vi.mock('@metorial/db', () => ({ db }));

vi.mock('../src/services/skill', () => ({
  intersectIds: (allowedIds: string[], requestedIds?: string[]) => {
    let uniqueAllowedIds = [...new Set(allowedIds)];
    if (!requestedIds?.length) return uniqueAllowedIds;

    let requestedIdSet = new Set(requestedIds);
    return uniqueAllowedIds.filter(id => requestedIdSet.has(id));
  }
}));

import {
  assertSkillGroupReadable,
  getAccessibleSkillGroupIds
} from '../src/services/skillGroupAccess';

let instance = { oid: 1n };
let consumerProfile = { oid: 2n };
let consumerGroups = [{ oid: 3n }, { oid: 4n }];

describe('consumer skill group access', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('lists only groups with direct consumer access', async () => {
    db.skillGroup.findMany.mockResolvedValue([
      { id: 'skill_group_direct' },
      { id: 'skill_group_direct' }
    ]);

    await expect(
      getAccessibleSkillGroupIds({
        instance: instance as any,
        consumerProfile: consumerProfile as any,
        consumerGroups,
        requestedIds: ['skill_group_direct', 'skill_group_visible_skill_only']
      })
    ).resolves.toEqual(['skill_group_direct']);

    expect(db.skillGroup.findMany).toHaveBeenCalledWith({
      where: {
        instanceOid: instance.oid,
        consumerAccesses: {
          some: {
            consumerGroupOid: {
              in: consumerGroups.map(group => group.oid)
            }
          }
        }
      },
      select: {
        id: true
      }
    });
  });

  it('allows reading a directly accessible group', async () => {
    db.skillGroup.findFirst.mockResolvedValue({ id: 'skill_group_direct' });

    await expect(
      assertSkillGroupReadable({
        instance: instance as any,
        skillGroupId: 'skill_group_direct',
        consumerProfile: consumerProfile as any,
        consumerGroups
      })
    ).resolves.toBeUndefined();

    expect(db.skillGroup.findFirst).toHaveBeenCalledWith({
      where: {
        instanceOid: instance.oid,
        id: 'skill_group_direct',
        consumerAccesses: {
          some: {
            consumerGroupOid: {
              in: consumerGroups.map(group => group.oid)
            }
          }
        }
      }
    });
  });

  it('rejects a group without direct consumer access', async () => {
    db.skillGroup.findFirst.mockResolvedValue(null);

    await expect(
      assertSkillGroupReadable({
        instance: instance as any,
        skillGroupId: 'skill_group_visible_skill_only',
        consumerProfile: consumerProfile as any,
        consumerGroups
      })
    ).rejects.toThrow('Skill group not found');
  });

  it('does not restrict non-consumer reads', async () => {
    await expect(
      assertSkillGroupReadable({
        instance: instance as any,
        skillGroupId: 'skill_group_admin'
      })
    ).resolves.toBeUndefined();

    expect(db.skillGroup.findFirst).not.toHaveBeenCalled();
  });
});
