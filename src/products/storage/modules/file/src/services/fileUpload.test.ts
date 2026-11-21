import { beforeEach, describe, expect, it, vi } from 'vitest';

let mocks = vi.hoisted(() => ({
  findUpload: vi.fn(),
  claimUpload: vi.fn(),
  updateUpload: vi.fn(),
  findActiveFile: vi.fn(),
  putObject: vi.fn(),
  headObject: vi.fn(),
  deleteObject: vi.fn(),
  executeRaw: vi.fn(),
  createFile: vi.fn(),
  requestContentHashes: vi.fn()
}));

vi.mock('@metorial/db', () => {
  let db = {
    $executeRaw: mocks.executeRaw,
    fileUpload: {
      findFirst: mocks.findUpload,
      updateMany: mocks.claimUpload,
      update: mocks.updateUpload
    },
    file: { findFirst: mocks.findActiveFile }
  };

  return {
    db,
    ID: { generateId: async () => 'fup_new' },
    withTransaction: async (cb: (db: unknown) => Promise<unknown>) => await cb(db)
  };
});
vi.mock('@metorial/fabric', () => ({ Fabric: { fire: async () => {} } }));
vi.mock('@metorial/module-store', () => ({
  storeAccessService: {},
  storeWritePermission: 'write'
}));
vi.mock('../env', () => ({ env: { service: {}, storage: {} } }));
vi.mock('../storage', () => ({
  getCargoFilesBucketName: () => 'cargo-files',
  getStorage: () => ({
    putObject: mocks.putObject,
    headObject: mocks.headObject,
    deleteObject: mocks.deleteObject
  })
}));
vi.mock('../queues/fileUploadCleanup', () => ({
  fileUploadCleanupSingleQueue: { add: vi.fn() }
}));
vi.mock('./file', () => ({
  fileService: {
    createFile: mocks.createFile,
    requestContentHashes: mocks.requestContentHashes
  }
}));
vi.mock('./filePurpose', () => ({
  documentFilePurposeSlug: 'document',
  filePurposeService: {}
}));

let { fileUploadService } = await import('./fileUpload');

let upload = {
  oid: 5n,
  id: 'fup_1',
  status: 'pending',
  storeId: 'aBcDeFgHiJkLmNoPqRsT',
  fileName: 'archive.zip',
  fileSize: 1024,
  fileType: 'application/zip',
  title: null,
  attachStoreId: null,
  attachPath: null,
  attachReplace: false,
  expiresAt: new Date(Date.now() + 60_000),
  purpose: { id: 'fpr_1' },
  file: null
};

let complete = () =>
  fileUploadService.completePendingUpload({
    instance: { oid: 1n } as any,
    project: { oid: 1n } as any,
    uploadId: upload.id,
    authorization: { type: 'privileged' } as any
  });

describe('signed-URL upload completion', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.findUpload.mockResolvedValue(upload);
    mocks.claimUpload.mockResolvedValue({ count: 1 });
    mocks.findActiveFile.mockResolvedValue(null);
    mocks.createFile.mockImplementation(async (d: { storeId: string }) => ({
      id: 'fil_1',
      oid: 1n,
      storeId: d.storeId
    }));
  });

  it('keeps the random key, writes nothing and queues hashing for the new file', async () => {
    mocks.headObject.mockResolvedValue({ size: 1024 });

    let file = await complete();

    expect(file.storeId).toBe(upload.storeId);
    expect(mocks.createFile).toHaveBeenCalledWith(
      expect.objectContaining({
        storeId: upload.storeId,
        internal: { contentPersistence: { type: 'object' } }
      })
    );
    expect(mocks.putObject).not.toHaveBeenCalled();
    expect(mocks.requestContentHashes).toHaveBeenCalledWith({ file });
  });

  it('discards a mismatched upload through the guarded delete', async () => {
    mocks.headObject.mockResolvedValue({ size: 10 });

    await expect(complete()).rejects.toMatchObject({
      message: expect.stringMatching(/10 bytes but 1024 bytes were declared/)
    });

    expect(mocks.executeRaw).toHaveBeenCalledTimes(1);
    expect(mocks.executeRaw.mock.calls[0]!.slice(1)).toEqual([
      `cargo-object:${upload.storeId}`
    ]);
    expect(mocks.findActiveFile).toHaveBeenCalledWith({
      where: { storeId: upload.storeId, status: 'active' },
      select: { oid: true }
    });
    expect(mocks.deleteObject).toHaveBeenCalledWith('cargo-files', upload.storeId);
    expect(mocks.createFile).not.toHaveBeenCalled();
    expect(mocks.requestContentHashes).not.toHaveBeenCalled();
  });
});

describe('signed-URL upload creation', () => {
  let create = (mimeType?: string) =>
    fileUploadService.createPendingUpload({
      instance: { oid: 1n } as any,
      project: { oid: 1n } as any,
      purpose: 'generic',
      authorization: { type: 'privileged' } as any,
      input: { name: 'photo.png', size: 1024, mimeType }
    });

  let isFileTypeError = async (mimeType?: string) =>
    await create(mimeType).then(
      () => false,
      (error: Error) => /single media type/.test(error.message)
    );

  it.each([
    'image/png, text/html',
    'image/png,text/html',
    'text/html, image/png',
    'image/png; a=b, text/html',
    'video/webm;codecs=vp8,opus',
    'image/png\r\ncontent-type: text/html',
    'image/png text/html',
    'image',
    'not a type'
  ])('rejects the file type %j', async mimeType => {
    await expect(create(mimeType)).rejects.toMatchObject({
      message: expect.stringMatching(/single media type/)
    });
  });

  it.each([
    undefined,
    '',
    'image/png',
    ' image/png ',
    'IMAGE/PNG',
    'application/pdf',
    'application/octet-stream',
    'text/plain;charset=utf-8',
    'text/plain; charset=utf-8',
    'text/html; charset=utf-8',
    'image/svg+xml',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'multipart/form-data; boundary=----x'
  ])('accepts the file type %j', async mimeType => {
    expect(await isFileTypeError(mimeType)).toBe(false);
  });
});
