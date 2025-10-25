import { ServiceError } from '@metorial/error';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fileLinkService } from '../src/services/fileLink';

vi.mock('@metorial/db', () => ({
  db: {
    fileLink: {
      create: vi.fn(),
      findUnique: vi.fn(),
      delete: vi.fn(),
      update: vi.fn(),
      findMany: vi.fn()
    },
    File: {},
    FileLink: {},
    FilePurpose: {},
    ID: {
      generateId: vi.fn()
    }
  },
  File: {},
  FileLink: {},
  FilePurpose: {},
  ID: {
    generateId: vi.fn()
  }
}));

vi.mock('@metorial/id', () => ({
  generatePlainId: vi.fn()
}));

vi.mock('@metorial/pagination', () => ({
  Paginator: {
    create: vi.fn(fn => fn({ prisma: (cb: any) => cb({}) }))
  }
}));

vi.mock('@metorial/service', () => ({
  Service: {
    create: vi.fn((_name: string, factory: any) => ({
      build: () => factory()
    }))
  }
}));

vi.mock('@metorial/error', async () => {
  const actual = await vi.importActual('@metorial/error');
  return {
    ...actual,
    forbiddenError: vi.fn((args: any) => ({ ...args, type: 'forbidden' })),
    notFoundError: vi.fn((type: string, id: string) => ({ type, id })),
    ServiceError: class extends Error {
      constructor(public error: any) {
        super(error.message || 'ServiceError');
        this.name = 'ServiceError';
      }
    }
  };
});

// @ts-ignore
const { db } = await import('@metorial/db');
// @ts-ignore
const { generatePlainId } = await import('@metorial/id');

describe('fileLinkService', () => {
  const file = {
    oid: 'file-oid',
    id: 'file-id',
    status: 'active',
    purpose: { canHaveLinks: true }
  } as any;

  const fileWithoutLinks = {
    oid: 'file-oid-2',
    id: 'file-id-2',
    status: 'active',
    purpose: { canHaveLinks: false }
  } as any;

  const fileLink = {
    id: 'link-id',
    fileOid: 'file-oid',
    key: 'link-key',
    expiresAt: new Date(),
    file
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createFileLink', () => {
    it('creates file link with expiresAt', async () => {
      const expiresAt = new Date('2025-12-31');
      (db.fileLink.create as any).mockResolvedValue({
        id: 'new-link-id',
        fileOid: file.oid,
        key: 'generated-key',
        expiresAt,
        file
      });
      (generatePlainId as any).mockResolvedValue('generated-key');

      const result = await fileLinkService.createFileLink({
        file,
        input: { expiresAt }
      });

      expect(result).toBeDefined();
      expect(result.key).toBe('generated-key');
      expect(db.fileLink.create).toHaveBeenCalledWith({
        data: {
          id: undefined, // Will be mocked by ID.generateId
          fileOid: file.oid,
          expiresAt,
          key: 'generated-key'
        },
        include: { file: true }
      });
    });

    it('creates file link without expiresAt', async () => {
      (db.fileLink.create as any).mockResolvedValue({
        id: 'new-link-id',
        fileOid: file.oid,
        key: 'generated-key',
        expiresAt: undefined,
        file
      });
      (generatePlainId as any).mockResolvedValue('generated-key');

      const result = await fileLinkService.createFileLink({
        file,
        input: {}
      });

      expect(result).toBeDefined();
      expect(result.expiresAt).toBeUndefined();
      expect(db.fileLink.create).toHaveBeenCalled();
    });

    it('throws when file purpose does not allow links', async () => {
      await expect(
        fileLinkService.createFileLink({
          file: fileWithoutLinks,
          input: {}
        })
      ).rejects.toThrow(ServiceError);
    });

    it('generates unique key for file link', async () => {
      (db.fileLink.create as any).mockResolvedValue({
        id: 'new-link-id',
        fileOid: file.oid,
        key: 'unique-key-123',
        file
      });
      (generatePlainId as any).mockResolvedValue('unique-key-123');

      await fileLinkService.createFileLink({
        file,
        input: {}
      });

      expect(generatePlainId).toHaveBeenCalledWith(30);
    });
  });

  describe('getFileLinkById', () => {
    it('returns file link if found', async () => {
      (db.fileLink.findUnique as any).mockResolvedValue(fileLink);
      const result = await fileLinkService.getFileLinkById({
        fileLinkId: 'link-id',
        file
      });
      expect(result).toBe(fileLink);
      expect(db.fileLink.findUnique).toHaveBeenCalledWith({
        where: { id: 'link-id', fileOid: file.oid },
        include: { file: true }
      });
    });

    it('throws if not found', async () => {
      (db.fileLink.findUnique as any).mockResolvedValue(null);
      await expect(
        fileLinkService.getFileLinkById({ fileLinkId: 'bad-id', file })
      ).rejects.toThrow(ServiceError);
    });
  });

  describe('deleteFileLink', () => {
    it('deletes file link', async () => {
      (db.fileLink.delete as any).mockResolvedValue(fileLink);
      // @ts-ignore
      const result = await fileLinkService.deleteFileLink({ fileLink });
      expect(result).toBe(fileLink);
      expect(db.fileLink.delete).toHaveBeenCalledWith({
        where: { id: fileLink.id },
        include: { file: true }
      });
    });
  });

  describe('updateFileLink', () => {
    it('updates file link', async () => {
      (db.fileLink.update as any).mockResolvedValue(fileLink);
      const result = await fileLinkService.updateFileLink({
        // @ts-ignore
        fileLink,
        input: { expiresAt: fileLink.expiresAt }
      });
      expect(result).toBe(fileLink);
      expect(db.fileLink.update).toHaveBeenCalledWith({
        where: { id: fileLink.id },
        data: { expiresAt: fileLink.expiresAt },
        include: { file: true }
      });
    });

    it('updates file link with new expiresAt', async () => {
      const newExpiresAt = new Date('2026-01-01');
      const updatedLink = { ...fileLink, expiresAt: newExpiresAt };
      (db.fileLink.update as any).mockResolvedValue(updatedLink);

      const result = await fileLinkService.updateFileLink({
        // @ts-ignore
        fileLink,
        input: { expiresAt: newExpiresAt }
      });

      expect(result.expiresAt).toBe(newExpiresAt);
    });

    it('updates file link to remove expiresAt', async () => {
      const updatedLink = { ...fileLink, expiresAt: undefined };
      (db.fileLink.update as any).mockResolvedValue(updatedLink);

      const result = await fileLinkService.updateFileLink({
        // @ts-ignore
        fileLink,
        input: { expiresAt: undefined }
      });

      expect(result.expiresAt).toBeUndefined();
    });
  });

  describe('listFileLinks', () => {
    it('returns paginator', async () => {
      (db.fileLink.findMany as any).mockResolvedValue([fileLink]);
      const paginator = await fileLinkService.listFileLinks({ file });
      expect(Array.isArray(await paginator)).toBe(true);
    });

    it('lists multiple file links', async () => {
      const fileLink2 = { ...fileLink, id: 'link-id-2', key: 'link-key-2' };
      (db.fileLink.findMany as any).mockResolvedValue([fileLink, fileLink2]);
      const paginator = await fileLinkService.listFileLinks({ file });
      const result = await paginator;
      expect(Array.isArray(result)).toBe(true);
    });

    it('lists empty array when no links exist', async () => {
      (db.fileLink.findMany as any).mockResolvedValue([]);
      const paginator = await fileLinkService.listFileLinks({ file });
      const result = await paginator;
      expect(Array.isArray(result)).toBe(true);
    });

    it('filters by file oid', async () => {
      (db.fileLink.findMany as any).mockResolvedValue([fileLink]);
      await fileLinkService.listFileLinks({ file });
      expect(db.fileLink.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { fileOid: file.oid }
        })
      );
    });
  });

  describe('getFileLinkByKey', () => {
    it('returns file link and file if found', async () => {
      (db.fileLink.findUnique as any).mockResolvedValue(fileLink);
      const result = await fileLinkService.getFileLinkByKey({
        fileId: file.id,
        key: fileLink.key
      });
      expect(result).toEqual({ link: fileLink, file });
      expect(db.fileLink.findUnique).toHaveBeenCalledWith({
        where: {
          key: fileLink.key,
          file: { id: file.id, status: 'active' }
        },
        include: { file: true }
      });
    });

    it('throws if not found', async () => {
      (db.fileLink.findUnique as any).mockResolvedValue(null);
      await expect(
        fileLinkService.getFileLinkByKey({ fileId: file.id, key: 'bad-key' })
      ).rejects.toThrow(ServiceError);
    });

    it('only returns links for active files', async () => {
      (db.fileLink.findUnique as any).mockResolvedValue(fileLink);
      await fileLinkService.getFileLinkByKey({
        fileId: file.id,
        key: fileLink.key
      });
      expect(db.fileLink.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            file: expect.objectContaining({ status: 'active' })
          })
        })
      );
    });

    it('returns correct file object structure', async () => {
      (db.fileLink.findUnique as any).mockResolvedValue(fileLink);
      const result = await fileLinkService.getFileLinkByKey({
        fileId: file.id,
        key: fileLink.key
      });
      expect(result.file).toEqual(fileLink.file);
      expect(result.link).toEqual(fileLink);
    });

    it('throws with correct error for invalid key', async () => {
      (db.fileLink.findUnique as any).mockResolvedValue(null);
      try {
        await fileLinkService.getFileLinkByKey({ fileId: file.id, key: 'invalid-key' });
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error).toBeInstanceOf(ServiceError);
      }
    });
  });
});
