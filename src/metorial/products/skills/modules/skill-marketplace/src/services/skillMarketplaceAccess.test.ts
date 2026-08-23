import { beforeEach, describe, expect, it, vi } from 'vitest';

let { getAccessTagFilter } = vi.hoisted(() => ({
  getAccessTagFilter: vi.fn()
}));

vi.mock('@metorial/module-access', () => ({
  accessTagService: {
    getAccessTagFilter
  },
  consumerSkillReadRoles: ['consumer#instance.skill:read']
}));

import { getSkillMarketplaceAccessWhere } from '../lib/skillMarketplaceAccess';

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

  it('uses only canonical marketplace tag entities', async () => {
    let accessTags = [{ accessTagOid: 3n }];

    await expect(
      getSkillMarketplaceAccessWhere({
        accessTags
      })
    ).resolves.toEqual({
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
