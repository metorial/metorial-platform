import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@metorial/db', () => ({
  ID: {
    generateId: vi.fn()
  },
  withTransaction: vi.fn(callback =>
    callback({
      accessPolicyAssignment: {
        findFirst: vi.fn(),
        create: vi.fn(),
        deleteMany: vi.fn()
      },
      organizationMember: {
        update: vi.fn()
      }
    })
  )
}));

vi.mock('@mtsrc/service', () => ({
  Service: {
    create: vi.fn((name, factory) => ({
      build: () => factory()
    }))
  }
}));

vi.mock('@metorial/fabric', () => ({
  Fabric: {
    fire: vi.fn()
  }
}));

vi.mock('../src/services/accessPolicy', () => ({
  accessPolicyService: {
    getDefaultAccessPolicy: vi.fn()
  }
}));

import { ID, withTransaction } from '@metorial/db';
import { accessPolicyAssignmentService } from '../src/services/accessPolicyAssignment';

describe('AccessPolicyAssignmentService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('assignAccessPolicyToMember', () => {
    it('should set the member role to admin when assigning the default admin policy', async () => {
      let organization = { oid: 1 };
      let member = { oid: 2, role: 'member' };
      let accessPolicy = { oid: 3, organizationOid: 1, type: 'admin' };
      let update = vi.fn().mockResolvedValue({ ...member, role: 'admin' });
      let create = vi.fn().mockResolvedValue({
        id: 'apa_1',
        accessPolicy,
        member: { ...member, role: 'admin' }
      });

      vi.mocked(ID.generateId).mockResolvedValue('apa_1');
      vi.mocked(withTransaction).mockImplementation(async callback => {
        let mockDb = {
          accessPolicyAssignment: {
            findFirst: vi.fn().mockResolvedValue(null),
            create,
            deleteMany: vi.fn()
          },
          organizationMember: {
            update
          }
        };
        return callback(mockDb as any);
      });

      await accessPolicyAssignmentService.assignAccessPolicyToMember({
        organization: organization as any,
        member: member as any,
        accessPolicy: accessPolicy as any,
        allowDefault: true,
        performedBy: { oid: 4 } as any,
        context: {} as any
      });

      expect(update).toHaveBeenCalledWith({
        where: { oid: member.oid },
        data: { role: 'admin' }
      });
    });
  });

  describe('removeAccessPolicyFromMember', () => {
    it('should set the member role to member when removing the default admin policy', async () => {
      let member = { oid: 2, role: 'admin' };
      let accessPolicy = { oid: 3, type: 'admin' };
      let update = vi.fn().mockResolvedValue({ ...member, role: 'member' });
      let deleteMany = vi.fn().mockResolvedValue({ count: 1 });

      vi.mocked(withTransaction).mockImplementation(async callback => {
        let mockDb = {
          accessPolicyAssignment: {
            findFirst: vi.fn().mockResolvedValue({
              id: 'apa_1',
              accessPolicy,
              member
            }),
            create: vi.fn(),
            deleteMany
          },
          organizationMember: {
            update
          }
        };
        return callback(mockDb as any);
      });

      await accessPolicyAssignmentService.removeAccessPolicyFromMember({
        organization: { oid: 1 } as any,
        member: member as any,
        accessPolicy: accessPolicy as any,
        allowDefault: true,
        performedBy: { oid: 4 } as any,
        context: {} as any
      });

      expect(deleteMany).toHaveBeenCalledWith({
        where: {
          accessPolicyOid: accessPolicy.oid,
          memberOid: member.oid
        }
      });
      expect(update).toHaveBeenCalledWith({
        where: { oid: member.oid },
        data: { role: 'member' }
      });
    });
  });
});
