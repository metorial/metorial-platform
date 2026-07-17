import { beforeEach, describe, expect, it, vi } from 'vitest';

let { db, getAccessTagFilterMock } = vi.hoisted(() => ({
  db: {
    skillGroup: {
      findFirst: vi.fn()
    },
    skillGroupItem: {
      findFirst: vi.fn()
    }
  },
  getAccessTagFilterMock: vi.fn()
}));

vi.mock('@metorial/db', () => ({
  db,
  ID: {
    generateId: vi.fn()
  },
  withTransaction: vi.fn(async (fn: any) => await fn(db))
}));

vi.mock('@metorial/module-access', () => ({
  consumerSkillReadRoles: ['consumer#instance.skill:read'],
  accessTagService: {
    getAccessTagFilter: getAccessTagFilterMock
  }
}));

vi.mock('@metorial/cargo-module-search', () => ({
  voyager: {},
  voyagerIndex: {},
  voyagerSource: Promise.resolve({})
}));

vi.mock('@metorial/cargo-list-utils', () => ({
  normalizeDateFilter: vi.fn(value => value)
}));

vi.mock('../queues/lifecycle/skillGroup', () => ({
  enqueueSkillGroupLifecycle: vi.fn()
}));

vi.mock('./skill', () => ({
  skillService: {}
}));

import { skillGroupService } from './skillGroup';
import { skillGroupItemService } from './skillGroupItem';

let scope = {
  resourceTenant: { oid: 1n, id: 'rtn_1' },
  resourceGroup: { oid: 2n, id: 'rgr_1' }
};
let accessTags = [{ accessTagOid: 3n }];
let accessTagFilter = {
  some: {
    accessTagOid: { in: [3n] }
  }
};

describe('consumer skill group lifecycle filtering', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getAccessTagFilterMock.mockResolvedValue(accessTagFilter);
  });

  it('hydrates skill groups with active items backed by active skills only', async () => {
    db.skillGroup.findFirst.mockResolvedValue({
      id: 'skg_1',
      items: []
    });

    await skillGroupService.getSkillGroupById({
      ...scope,
      skillGroupId: 'skg_1',
      accessTags
    });

    expect(db.skillGroup.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        include: expect.objectContaining({
          items: expect.objectContaining({
            where: {
              status: 'active',
              skill: {
                status: 'active'
              }
            }
          })
        })
      })
    );
  });

  it('does not expose an active group item whose skill is archived', async () => {
    db.skillGroupItem.findFirst.mockResolvedValue(null);

    await expect(
      skillGroupItemService.getSkillGroupItemById({
        ...scope,
        skillGroupItemId: 'sgi_archived_skill',
        allowDeleted: true,
        accessTags
      })
    ).rejects.toThrow();

    expect(db.skillGroupItem.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          skill: {
            status: 'active'
          }
        })
      })
    );
  });
});
