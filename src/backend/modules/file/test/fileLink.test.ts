import { ServiceError } from '@lowerdeck/error';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fileLinkService } from '../src/services/fileLink';

vi.mock('@metorial/db', () => ({
  db: {
    fileLink: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
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

vi.mock('@lowerdeck/pagination', () => ({
  Paginator: {
    create: vi.fn(fn => fn({ prisma: (cb: any) => cb({}) }))
  }
}));

vi.mock('@lowerdeck/service', () => ({
  Service: {
    create: vi.fn((_name: string, factory: any) => ({
      build: () => factory()
    }))
  }
}));

vi.mock('../src/services/fileReference', () => ({
  fileReferenceService: {
    hasReferences: vi.fn().mockResolvedValue(false)
  }
}));

vi.mock('@lowerdeck/error', async () => {
  const actual = await vi.importActual('@lowerdeck/error');
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

  describe('getFileLinkByKey', () => {
    it('returns file link and file if found', async () => {
      (db.fileLink.findFirst as any).mockResolvedValue(fileLink);
      const result = await fileLinkService.getFileLinkByKey({
        fileId: file.id,
        key: fileLink.key
      });
      expect(result).toEqual({ link: fileLink, file });
      expect(db.fileLink.findFirst).toHaveBeenCalledWith({
        where: {
          key: fileLink.key,
          file: { id: file.id, status: 'active' }
        },
        include: { file: true }
      });
    });

    it('throws if not found', async () => {
      (db.fileLink.findFirst as any).mockResolvedValue(null);
      await expect(
        fileLinkService.getFileLinkByKey({ fileId: file.id, key: 'bad-key' })
      ).rejects.toThrow(ServiceError);
    });

    it('only returns links for active files', async () => {
      (db.fileLink.findFirst as any).mockResolvedValue(fileLink);
      await fileLinkService.getFileLinkByKey({
        fileId: file.id,
        key: fileLink.key
      });
      expect(db.fileLink.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            file: expect.objectContaining({ status: 'active' })
          })
        })
      );
    });

    it('returns correct file object structure', async () => {
      (db.fileLink.findFirst as any).mockResolvedValue(fileLink);
      const result = await fileLinkService.getFileLinkByKey({
        fileId: file.id,
        key: fileLink.key
      });
      expect(result.file).toEqual(fileLink.file);
      expect(result.link).toEqual(fileLink);
    });

    it('throws with correct error for invalid key', async () => {
      (db.fileLink.findFirst as any).mockResolvedValue(null);
      try {
        await fileLinkService.getFileLinkByKey({ fileId: file.id, key: 'invalid-key' });
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error).toBeInstanceOf(ServiceError);
      }
    });
  });

  describe('organization-scoped lookups', () => {
    it('lists links for an organization', async () => {
      (db.fileLink.findMany as any).mockResolvedValue([fileLink]);

      const paginator = await fileLinkService.listFileLinksForOrganization({
        organizationOid: BigInt(1),
        fileId: file.id
      });

      expect(Array.isArray(await paginator)).toBe(true);
      expect(db.fileLink.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            file: {
              organizationOid: BigInt(1),
              status: 'active',
              id: file.id
            }
          }
        })
      );
    });

    it('gets a link by id for an organization', async () => {
      (db.fileLink.findFirst as any).mockResolvedValue(fileLink);

      const result = await fileLinkService.getFileLinkByIdForOrganization({
        fileLinkId: fileLink.id,
        organizationOid: BigInt(1)
      });

      expect(result).toBe(fileLink);
      expect(db.fileLink.findFirst).toHaveBeenCalledWith({
        where: {
          id: fileLink.id,
          file: {
            organizationOid: BigInt(1),
            status: 'active'
          }
        },
        include: { file: true }
      });
    });
  });
});
