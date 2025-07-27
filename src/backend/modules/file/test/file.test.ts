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
    create: vi.fn(fn => fn(() => Promise.resolve([])))
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
});
