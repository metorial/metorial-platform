import { beforeEach, describe, expect, it, vi } from 'vitest';

let { getAccessTagFilter } = vi.hoisted(() => ({
  getAccessTagFilter: vi.fn()
}));

vi.mock('@metorial/module-access', () => ({
  accessTagService: {
    getAccessTagFilter
  },
  consumerSkillReadRoles: ['consumer#instance.skill:read'],
  isCanonicalResourceAuthorizationEnabled: () => true,
  isLegacyResourceAuthorizationEnabled: () => true
}));

import { getSkillMarketplaceAccessWhere } from './skillMarketplaceAccess';

describe('getSkillMarketplaceAccessWhere', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getAccessTagFilter.mockResolvedValue({
      some: {
        accessTagOid: { in: [3n] },
        accessTagPolicy: {
          roles: {
            hasSome: ['consumer#instance.skill:read']
          }
        }
      }
    });
  });

  it('uses canonical marketplace tag entities and the legacy relation during rollout', async () => {
    let accessTags = [{ accessTagOid: 3n }];

    await expect(
      getSkillMarketplaceAccessWhere({
        accessTags,
        legacyConsumerGroupOids: [4n]
      })
    ).resolves.toEqual({
      OR: [
        {
          accessTagEntities: {
            some: {
              accessTagOid: { in: [3n] },
              accessTagPolicy: {
                roles: {
                  hasSome: ['consumer#instance.skill:read']
                }
              }
            }
          }
        },
        {
          consumerAccesses: {
            some: {
              type: 'skill_marketplace',
              consumerGroupOid: {
                in: [4n]
              }
            }
          }
        }
      ]
    });
    expect(getAccessTagFilter).toHaveBeenCalledWith({
      tags: accessTags,
      roles: ['consumer#instance.skill:read']
    });
  });

  it('does not constrain privileged access', async () => {
    await expect(getSkillMarketplaceAccessWhere({})).resolves.toBeUndefined();
    expect(getAccessTagFilter).not.toHaveBeenCalled();
  });
});
