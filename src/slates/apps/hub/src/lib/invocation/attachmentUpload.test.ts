import { beforeEach, describe, expect, it, vi } from 'vitest';

let mocks = vi.hoisted(() => ({
  db: {
    slateAttachmentUpload: {
      findFirst: vi.fn(),
      updateMany: vi.fn(),
      aggregate: vi.fn()
    }
  },
  storage: { headObject: vi.fn() },
  deleteQueue: { add: vi.fn() }
}));

vi.mock('../../env', () => ({
  env: { storage: { MAX_ATTACHMENT_SIZE_BYTES: 500 * 1024 * 1024 } }
}));
vi.mock('../../db', () => ({ db: mocks.db }));
vi.mock('../../storage', () => ({ storage: mocks.storage }));
vi.mock('../../queues/attachment/uploadDelete', () => ({
  slateAttachmentUploadDeleteQueue: mocks.deleteQueue
}));

let { claimAttachmentUpload } = await import('./attachmentUpload');

let MiB = 1024 * 1024;

let invocation = { oid: 3n } as any;

let upload = (overrides: Record<string, unknown> = {}) => ({
  oid: 7n,
  id: 'shau_1',
  storageBucket: 'invocations',
  storageKey: 'attachments/uploads/shau_1',
  declaredSizeBytes: 100,
  multipartUploadId: null,
  ...overrides
});

let claim = () => claimAttachmentUpload({ referenceId: 'shau_1', invocation });

beforeEach(() => {
  vi.clearAllMocks();
  mocks.db.slateAttachmentUpload.updateMany.mockResolvedValue({ count: 1 });
  mocks.db.slateAttachmentUpload.aggregate.mockResolvedValue({ _sum: { sizeBytes: 0 } });
});

describe('claimAttachmentUpload', () => {
  it('accepts an object of exactly the declared size', async () => {
    mocks.db.slateAttachmentUpload.findFirst.mockResolvedValue(upload());
    mocks.storage.headObject.mockResolvedValue({ size: 100 });

    expect(await claim()).toMatchObject({ info: { size: 100 } });
  });

  it('rejects and deletes an object whose size differs from the declared size', async () => {
    mocks.db.slateAttachmentUpload.findFirst.mockResolvedValue(upload());
    mocks.storage.headObject.mockResolvedValue({ size: 900 });

    expect(await claim()).toBeNull();
    expect(mocks.db.slateAttachmentUpload.updateMany).toHaveBeenLastCalledWith({
      where: { oid: 7n, status: 'processing' },
      data: { status: 'size_mismatch' }
    });
    expect(mocks.deleteQueue.add).toHaveBeenCalledWith({
      bucket: 'invocations',
      key: 'attachments/uploads/shau_1'
    });
  });

  it('rejects single uploads above 100 MiB even without a declared size', async () => {
    mocks.db.slateAttachmentUpload.findFirst.mockResolvedValue(
      upload({ declaredSizeBytes: null })
    );
    mocks.storage.headObject.mockResolvedValue({ size: 100 * MiB + 1 });

    expect(await claim()).toBeNull();
    expect(mocks.db.slateAttachmentUpload.updateMany).toHaveBeenLastCalledWith({
      where: { oid: 7n, status: 'processing' },
      data: { status: 'oversized' }
    });
  });

  it('accepts multipart uploads up to the full maximum size', async () => {
    mocks.db.slateAttachmentUpload.findFirst.mockResolvedValue(
      upload({ multipartUploadId: 'upload_1', declaredSizeBytes: 500 * MiB })
    );
    mocks.storage.headObject.mockResolvedValue({ size: 500 * MiB });

    expect(await claim()).toMatchObject({ info: { size: 500 * MiB } });
  });

  it('only claims multipart uploads that were completed', async () => {
    mocks.db.slateAttachmentUpload.findFirst.mockResolvedValue(
      upload({ multipartUploadId: 'upload_1' })
    );
    mocks.db.slateAttachmentUpload.updateMany.mockResolvedValue({ count: 0 });

    expect(await claim()).toBeNull();
    expect(mocks.db.slateAttachmentUpload.updateMany).toHaveBeenCalledWith({
      where: { oid: 7n, status: 'uploaded' },
      data: { status: 'processing' }
    });
    expect(mocks.storage.headObject).not.toHaveBeenCalled();
  });
});
