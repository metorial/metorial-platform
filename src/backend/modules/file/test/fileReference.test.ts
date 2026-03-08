import { ServiceError } from '@lowerdeck/error';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fileReferenceService } from '../src/services/fileReference';

let { mockDb } = vi.hoisted(() => ({
  mockDb: {
    file: {
      findFirst: vi.fn()
    },
    fileLink: {
      create: vi.fn(),
      deleteMany: vi.fn()
    },
    fileReference: {
      create: vi.fn(),
      deleteMany: vi.fn(),
      count: vi.fn()
    }
  }
}));

vi.mock('@metorial/db', () => ({
  db: mockDb,
  ID: {
    generateId: vi.fn().mockResolvedValue('frf_test')
  }
}));

vi.mock('@metorial/config', () => ({
  getConfig: vi.fn(() => ({
    urls: {
      filesUrl: 'https://files.example.com'
    }
  }))
}));

vi.mock('@metorial/id', () => ({
  generatePlainId: vi.fn().mockResolvedValue('public-key')
}));

vi.mock('@lowerdeck/service', () => ({
  Service: {
    create: vi.fn((_name: string, factory: any) => ({
      build: () => factory()
    }))
  }
}));

const { db } = await import('@metorial/db');

describe('fileReferenceService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createImageEntityImage', () => {
    it('creates a file-backed entity image for a user-owned file', async () => {
      let file = {
        id: 'fil_123',
        oid: BigInt(1),
        purpose: {
          canHaveLinks: true
        }
      };
      (db.file.findFirst as any).mockResolvedValue(file);
      (db.fileLink.create as any).mockResolvedValue({
        id: 'flk_123',
        oid: BigInt(2),
        key: 'public-key',
        file
      });
      (db.fileReference.create as any).mockResolvedValue({
        id: 'frf_123',
        fileLink: {
          id: 'flk_123',
          oid: BigInt(2),
          key: 'public-key',
          file
        }
      });

      let result = await fileReferenceService.createImageEntityImage({
        fileId: file.id,
        owner: {
          type: 'user',
          userId: 'usr_123'
        },
        purpose: 'user_image',
        entityType: 'user',
        entityId: 'usr_123'
      });

      expect(result).toEqual({
        type: 'file',
        fileId: file.id,
        fileLinkId: 'flk_123',
        fileReferenceId: 'frf_123',
        fileUrl: 'https://files.example.com/files/fil_123/public-key'
      });
      expect(db.file.findFirst).toHaveBeenCalledWith({
        where: {
          id: file.id,
          status: 'active',
          purpose: {
            slug: 'user_image'
          },
          user: {
            id: 'usr_123'
          }
        },
        include: {
          purpose: true
        }
      });
    });

    it('rejects files outside the expected owner and purpose', async () => {
      (db.file.findFirst as any).mockResolvedValue(null);

      await expect(
        fileReferenceService.createImageEntityImage({
          fileId: 'fil_123',
          owner: {
            type: 'organization',
            organizationId: 'org_123'
          },
          purpose: 'organization_image',
          entityType: 'organization',
          entityId: 'org_123'
        })
      ).rejects.toThrow(ServiceError);
    });

    it('cleans up the file link when the last reference is removed', async () => {
      (db.fileReference.deleteMany as any).mockResolvedValue({ count: 1 });
      (db.fileReference.count as any).mockResolvedValue(0);
      (db.fileLink.deleteMany as any).mockResolvedValue({ count: 1 });

      await fileReferenceService.cleanupImageEntityImage({
        image: {
          type: 'file',
          fileId: 'fil_123',
          fileLinkId: 'flk_123',
          fileReferenceId: 'frf_123',
          fileUrl: 'https://files.example.com/files/fil_123/public-key'
        }
      });

      expect(db.fileReference.deleteMany).toHaveBeenCalledWith({
        where: {
          id: 'frf_123'
        }
      });
      expect(db.fileLink.deleteMany).toHaveBeenCalledWith({
        where: {
          id: 'flk_123'
        }
      });
    });
  });
});
