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
    purpose: 'test'
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
  });

  describe('listFileLinks', () => {
    it('returns paginator', async () => {
      (db.fileLink.findMany as any).mockResolvedValue([fileLink]);
      const paginator = await fileLinkService.listFileLinks({ file });
      expect(Array.isArray(await paginator)).toBe(true);
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
  });
});
