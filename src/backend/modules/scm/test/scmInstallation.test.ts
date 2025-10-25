import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ServiceError } from '@metorial/error';

// Mock external dependencies
vi.mock('@metorial/db', () => ({
  db: {
    scmInstallation: {
      findFirst: vi.fn(),
      findMany: vi.fn()
    }
  }
}));

vi.mock('@metorial/pagination', () => ({
  Paginator: {
    create: vi.fn((fn) => {
      // Mock paginator that just returns the function result
      return fn({
        prisma: (fn: any) => fn({})
      });
    })
  }
}));

import { scmInstallationService } from '../src/services/scmInstallation';
import { db } from '@metorial/db';

describe('scmInstallationService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getScmInstallationById', () => {
    it('should return installation when found', async () => {
      const mockOrganization = { oid: 'org-oid-1', id: 'org-1' } as any;
      const mockInstallation = {
        id: 'scm-inst-1',
        organizationOid: 'org-oid-1',
        provider: 'github',
        externalUserId: '12345'
      };

      vi.mocked(db.scmInstallation.findFirst).mockResolvedValue(mockInstallation as any);

      const result = await scmInstallationService.getScmInstallationById({
        organization: mockOrganization,
        scmInstallationId: 'scm-inst-1'
      });

      expect(result).toEqual(mockInstallation);
      expect(db.scmInstallation.findFirst).toHaveBeenCalledWith({
        where: {
          id: 'scm-inst-1',
          organizationOid: mockOrganization.oid
        }
      });
    });

    it('should throw error when installation not found', async () => {
      const mockOrganization = { oid: 'org-oid-1', id: 'org-1' } as any;

      vi.mocked(db.scmInstallation.findFirst).mockResolvedValue(null);

      await expect(
        scmInstallationService.getScmInstallationById({
          organization: mockOrganization,
          scmInstallationId: 'non-existent'
        })
      ).rejects.toThrow(ServiceError);
    });

    it('should throw error when installation belongs to different organization', async () => {
      const mockOrganization = { oid: 'org-oid-1', id: 'org-1' } as any;

      vi.mocked(db.scmInstallation.findFirst).mockResolvedValue(null);

      await expect(
        scmInstallationService.getScmInstallationById({
          organization: mockOrganization,
          scmInstallationId: 'scm-inst-other-org'
        })
      ).rejects.toThrow(ServiceError);
    });
  });

  describe('listScmInstallations', () => {
    it('should list installations for organization and actor', async () => {
      const mockOrganization = { oid: 'org-oid-1', id: 'org-1' } as any;
      const mockActor = { oid: 'actor-oid-1', id: 'actor-1' } as any;
      const mockInstallations = [
        {
          id: 'scm-inst-1',
          organizationOid: 'org-oid-1',
          ownerActorOid: 'actor-oid-1',
          provider: 'github'
        },
        {
          id: 'scm-inst-2',
          organizationOid: 'org-oid-1',
          ownerActorOid: 'actor-oid-1',
          provider: 'github'
        }
      ];

      vi.mocked(db.scmInstallation.findMany).mockResolvedValue(mockInstallations as any);

      const result = await scmInstallationService.listScmInstallations({
        organization: mockOrganization,
        actor: mockActor
      });

      expect(result).toBeDefined();
      expect(db.scmInstallation.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            organizationOid: mockOrganization.oid,
            ownerActorOid: mockActor.oid
          }
        })
      );
    });

    it('should return empty list when no installations found', async () => {
      const mockOrganization = { oid: 'org-oid-1', id: 'org-1' } as any;
      const mockActor = { oid: 'actor-oid-1', id: 'actor-1' } as any;

      vi.mocked(db.scmInstallation.findMany).mockResolvedValue([]);

      const result = await scmInstallationService.listScmInstallations({
        organization: mockOrganization,
        actor: mockActor
      });

      expect(result).toBeDefined();
      expect(db.scmInstallation.findMany).toHaveBeenCalled();
    });

    it('should only return installations for the specified actor', async () => {
      const mockOrganization = { oid: 'org-oid-1', id: 'org-1' } as any;
      const mockActor = { oid: 'actor-oid-1', id: 'actor-1' } as any;
      const mockInstallations = [
        {
          id: 'scm-inst-1',
          organizationOid: 'org-oid-1',
          ownerActorOid: 'actor-oid-1'
        }
      ];

      vi.mocked(db.scmInstallation.findMany).mockResolvedValue(mockInstallations as any);

      await scmInstallationService.listScmInstallations({
        organization: mockOrganization,
        actor: mockActor
      });

      expect(db.scmInstallation.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            organizationOid: mockOrganization.oid,
            ownerActorOid: mockActor.oid
          }
        })
      );
    });
  });
});
