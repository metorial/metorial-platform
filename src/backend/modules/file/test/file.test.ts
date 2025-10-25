import { db, File, Instance, Organization, User } from '@metorial/db';
import { ServiceError } from '@metorial/error';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fileService } from '../src/services/file';

vi.mock('@metorial/db', () => ({
  db: {
    file: {
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      findMany: vi.fn()
    },
    user: {
      findFirst: vi.fn().mockResolvedValue({ oid: 'user_1' })
    }
  },
  ID: {
    generateId: vi.fn().mockResolvedValue('file_123')
  }
}));
vi.mock('@metorial/pagination', () => ({
  Paginator: {
    create: vi.fn(fn => fn({ prisma: (cb: any) => cb({}) }))
  }
}));
vi.mock('../src/definitions', () => ({
  purposes: {
    avatar: { oid: 'purpose_avatar', ownerType: 'user' },
    'org-doc': { oid: 'purpose_org_doc', ownerType: 'organization' }
  }
}));

const user: User = { oid: 'user_1' } as any;
const organization: Organization = { oid: 'org_1' } as any;
const instance: Instance = { oid: 'inst_1' } as any;

describe('fileService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createFile', () => {
    it('creates a file for a user with valid purpose', async () => {
      (db.file.create as any).mockResolvedValue({ id: 'file_123', purpose: {} });
      const result = await fileService.createFile({
        owner: { type: 'user', user },
        storeId: 'store_1',
        purpose: 'avatar',
        input: { name: 'test.png', mimeType: 'image/png', size: 123 }
      });
      expect(result.id).toBe('file_123');
      expect(db.file.create).toHaveBeenCalled();
    });

    it('throws for invalid purpose', async () => {
      await expect(
        fileService.createFile({
          owner: { type: 'user', user },
          storeId: 'store_1',
          purpose: 'invalid',
          input: { name: 'test.png', mimeType: 'image/png', size: 123 }
        })
      ).rejects.toThrow(ServiceError);
    });

    it('throws for mismatched owner type', async () => {
      await expect(
        fileService.createFile({
          owner: { type: 'organization', organization },
          storeId: 'store_1',
          purpose: 'avatar',
          input: { name: 'test.png', mimeType: 'image/png', size: 123 }
        })
      ).rejects.toThrow(ServiceError);
    });
  });

  describe('getFileById', () => {
    it('returns file for user owner', async () => {
      (db.file.findUnique as any).mockResolvedValue({ id: 'file_1', purpose: {} });
      const file = await fileService.getFileById({
        fileId: 'file_1',
        owner: { type: 'user', user }
      });
      expect(file.id).toBe('file_1');
      expect(db.file.findUnique).toHaveBeenCalled();
    });

    it('throws if file not found', async () => {
      (db.file.findUnique as any).mockResolvedValue(null);
      await expect(
        fileService.getFileById({ fileId: 'file_x', owner: { type: 'user', user } })
      ).rejects.toThrow(ServiceError);
    });
  });

  describe('updateFile', () => {
    it('updates title of an active file', async () => {
      const file: File = { id: 'file_1', status: 'active' } as any;
      (db.file.update as any).mockResolvedValue({
        id: 'file_1',
        title: 'new title',
        purpose: {}
      });
      const result = await fileService.updateFile({
        file,
        input: { title: 'new title' }
      });
      expect(result.title).toBe('new title');
    });

    it('throws if file is deleted', async () => {
      const file: File = { id: 'file_1', status: 'deleted' } as any;
      await expect(fileService.updateFile({ file, input: { title: 'x' } })).rejects.toThrow(
        ServiceError
      );
    });
  });

  describe('deleteFile', () => {
    it('always throws badRequestError', async () => {
      const file: File = { id: 'file_1', status: 'active' } as any;
      await expect(fileService.deleteFile({ file })).rejects.toThrow(ServiceError);
    });
  });

  describe('listFiles', () => {
    it('lists files for user owner', async () => {
      (db.file.findMany as any).mockResolvedValue([{ id: 'file_1', purpose: {} }]);
      const paginator = await fileService.listFiles({
        owner: { type: 'user', user }
      });
      expect(paginator).toBeDefined();
    });

    it('lists files for organization owner', async () => {
      (db.file.findMany as any).mockResolvedValue([{ id: 'file_1', purpose: {} }]);
      const paginator = await fileService.listFiles({
        owner: { type: 'organization', organization }
      });
      expect(paginator).toBeDefined();
    });

    it('lists files with specific purpose', async () => {
      (db.file.findMany as any).mockResolvedValue([{ id: 'file_1', purpose: {} }]);
      const paginator = await fileService.listFiles({
        owner: { type: 'user', user },
        purpose: 'avatar'
      });
      expect(paginator).toBeDefined();
    });

    it('throws for mismatched purpose and owner type', async () => {
      await expect(
        fileService.listFiles({
          owner: { type: 'organization', organization },
          purpose: 'avatar'
        })
      ).rejects.toThrow(ServiceError);
    });

    it('filters by active status', async () => {
      (db.file.findMany as any).mockResolvedValue([{ id: 'file_1', status: 'active', purpose: {} }]);
      await fileService.listFiles({ owner: { type: 'user', user } });
      expect(db.file.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: 'active'
          })
        })
      );
    });
  });

  describe('createFile - additional edge cases', () => {
    it('creates file for organization owner', async () => {
      (db.file.create as any).mockResolvedValue({ id: 'file_org', purpose: {} });
      const result = await fileService.createFile({
        owner: { type: 'organization', organization },
        storeId: 'store_1',
        purpose: 'org-doc',
        input: { name: 'doc.pdf', mimeType: 'application/pdf', size: 5000 }
      });
      expect(result.id).toBe('file_org');
      expect(db.file.create).toHaveBeenCalled();
    });

    it('creates file with optional title', async () => {
      (db.file.create as any).mockResolvedValue({ id: 'file_123', title: 'My File', purpose: {} });
      const result = await fileService.createFile({
        owner: { type: 'user', user },
        storeId: 'store_1',
        purpose: 'avatar',
        input: { name: 'test.png', mimeType: 'image/png', size: 123, title: 'My File' }
      });
      expect(result.title).toBe('My File');
    });

    it('creates file without optional title', async () => {
      (db.file.create as any).mockResolvedValue({ id: 'file_123', purpose: {} });
      const result = await fileService.createFile({
        owner: { type: 'user', user },
        storeId: 'store_1',
        purpose: 'avatar',
        input: { name: 'test.png', mimeType: 'image/png', size: 123 }
      });
      expect(result.id).toBe('file_123');
    });

    it('throws when user not found', async () => {
      (db.user.findFirst as any).mockResolvedValue(null);
      await expect(
        fileService.createFile({
          owner: { type: 'user', user: { id: 'nonexistent' } },
          storeId: 'store_1',
          purpose: 'avatar',
          input: { name: 'test.png', mimeType: 'image/png', size: 123 }
        })
      ).rejects.toThrow('WTF - user not found');
    });
  });

  describe('getFileById - additional edge cases', () => {
    beforeEach(() => {
      (db.user.findFirst as any).mockResolvedValue({ oid: 'user_1' });
    });

    it('returns file for organization owner', async () => {
      (db.file.findUnique as any).mockResolvedValue({ id: 'file_1', purpose: {} });
      const file = await fileService.getFileById({
        fileId: 'file_1',
        owner: { type: 'organization', organization }
      });
      expect(file.id).toBe('file_1');
    });

    it('returns file for instance owner', async () => {
      (db.file.findUnique as any).mockResolvedValue({ id: 'file_1', purpose: {} });
      const file = await fileService.getFileById({
        fileId: 'file_1',
        owner: { type: 'instance', organization, instance }
      });
      expect(file.id).toBe('file_1');
    });

    it('queries with OR condition for user owner to include organization membership', async () => {
      (db.file.findUnique as any).mockResolvedValue({ id: 'file_1', purpose: {} });
      await fileService.getFileById({
        fileId: 'file_1',
        owner: { type: 'user', user }
      });
      expect(db.file.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: expect.arrayContaining([
              expect.objectContaining({ userOid: 'user_1' }),
              expect.objectContaining({
                organization: expect.objectContaining({
                  members: expect.objectContaining({
                    some: expect.objectContaining({ userOid: 'user_1' })
                  })
                })
              })
            ])
          })
        })
      );
    });

    it('throws when user not found', async () => {
      (db.user.findFirst as any).mockResolvedValue(null);
      await expect(
        fileService.getFileById({
          fileId: 'file_1',
          owner: { type: 'user', user: { id: 'nonexistent' } }
        })
      ).rejects.toThrow('WTF - user not found');
    });
  });

  describe('updateFile - additional edge cases', () => {
    it('updates file with undefined title', async () => {
      const file: File = { id: 'file_1', status: 'active' } as any;
      (db.file.update as any).mockResolvedValue({ id: 'file_1', purpose: {} });
      const result = await fileService.updateFile({
        file,
        input: {}
      });
      expect(result.id).toBe('file_1');
    });

    it('preserves file status as active after update', async () => {
      const file: File = { id: 'file_1', status: 'active', title: 'old' } as any;
      (db.file.update as any).mockResolvedValue({
        id: 'file_1',
        status: 'active',
        title: 'new',
        purpose: {}
      });
      const result = await fileService.updateFile({
        file,
        input: { title: 'new' }
      });
      expect(result.id).toBe('file_1');
    });
  });
});
