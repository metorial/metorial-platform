import { hashBytes } from '@lowerdeck/hash/content';
import { createHash } from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';

let mocks = vi.hoisted(() => ({
  putObject: vi.fn(),
  headObject: vi.fn(),
  createFile: vi.fn(),
  enqueueDelete: vi.fn()
}));

vi.mock('@metorial/db', () => ({
  db: {},
  withTransaction: async (cb: (db: unknown) => Promise<unknown>) => await cb({}),
  isInTransaction: () => false
}));
vi.mock('../storage', () => ({
  getCargoFilesBucketName: () => 'cargo-files',
  getStorage: () => ({ putObject: mocks.putObject, headObject: mocks.headObject })
}));
vi.mock('../services/file', () => ({
  fileService: { createFile: mocks.createFile }
}));
vi.mock('../queues/objectDelete', () => ({
  cargoObjectDelete: { enqueue: mocks.enqueueDelete }
}));

let { uploadCargoFile } = await import('./uploadFile');

let sha256 = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');

let randomBytes = (seed: number) => {
  let length = (seed * 104729) % 4096;
  return Uint8Array.from(
    { length },
    (_, index) => (seed * 13 + index * 7 + (index >> 3)) % 256
  );
};

let upload = (bytes: Uint8Array, input: { fileName?: string; storeId?: string } = {}) =>
  uploadCargoFile({
    instance: { oid: 1n } as any,
    project: { oid: 1n } as any,
    purpose: 'generic',
    file: new Blob([bytes as BlobPart], { type: 'application/x-custom' }),
    fileName: input.fileName ?? 'payload.bin',
    storeId: input.storeId,
    authorization: { type: 'privileged' } as any
  });

describe('uploadCargoFile', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.putObject.mockResolvedValue({});
    mocks.headObject.mockResolvedValue({ size: 0 });
    mocks.enqueueDelete.mockResolvedValue(undefined);
    mocks.createFile.mockImplementation(async (d: { storeId: string }) => ({
      id: 'fil_1',
      storeId: d.storeId
    }));
  });

  it('only ever writes content-addressed keys that match their bytes', async () => {
    for (let seed = 0; seed < 100; seed++) {
      await upload(randomBytes(seed));
    }

    expect(mocks.putObject).toHaveBeenCalledTimes(100);
    for (let [bucket, key, content, contentType] of mocks.putObject.mock.calls) {
      expect(bucket).toBe('cargo-files');
      expect(key).toBe(`sha256/${sha256(content)}`);
      expect(contentType).toBe('application/octet-stream');
    }
  });

  it('stores identical bytes under one key and persists the hashes on the row', async () => {
    let bytes = randomBytes(7);
    let expected = hashBytes(bytes);

    await upload(bytes, { fileName: 'first.bin' });
    await upload(bytes, { fileName: 'second.bin' });

    let calls = mocks.createFile.mock.calls.map(([d]) => d);
    expect(calls.map(d => d.storeId)).toEqual([
      `sha256/${expected.sha256}`,
      `sha256/${expected.sha256}`
    ]);
    expect(calls[0].internal.contentHashes).toEqual(expected);
    expect(calls[0].input).toMatchObject({
      mimeType: 'application/x-custom',
      size: bytes.length
    });
  });

  it('keeps buffered text in the database without writing the object', async () => {
    let bytes = new TextEncoder().encode('# Skill\n');

    await upload(bytes, { fileName: 'SKILL.md' });

    expect(mocks.putObject).not.toHaveBeenCalled();
    expect(mocks.headObject).not.toHaveBeenCalled();
    let [d] = mocks.createFile.mock.calls[0]!;
    expect(d.storeId).toBe(`sha256/${sha256(bytes)}`);
    expect(d.internal.contentPersistence).toMatchObject({ type: 'database' });
  });

  it('writes an explicit storeId as before, with the file content type', async () => {
    let bytes = randomBytes(3);

    await upload(bytes, { storeId: 'explicit_key' });

    expect(mocks.putObject).toHaveBeenCalledWith(
      'cargo-files',
      'explicit_key',
      bytes,
      'application/x-custom'
    );
    expect(mocks.createFile.mock.calls[0]![0]).toMatchObject({
      storeId: 'explicit_key',
      internal: { contentHashes: hashBytes(bytes) }
    });
  });

  it('refuses an explicit content-addressed storeId that does not match the bytes', async () => {
    await expect(
      upload(randomBytes(3), { storeId: `sha256/${sha256(randomBytes(4))}` })
    ).rejects.toThrow(/does not match/);

    expect(mocks.putObject).not.toHaveBeenCalled();
    expect(mocks.createFile).not.toHaveBeenCalled();
  });

  it('queues a guarded delete of the object when the row cannot be written', async () => {
    let bytes = randomBytes(11);
    mocks.createFile.mockRejectedValueOnce(new Error('purpose too small'));

    await expect(upload(bytes)).rejects.toThrow('purpose too small');

    expect(mocks.enqueueDelete).toHaveBeenCalledWith('cargo-files', [
      `sha256/${sha256(bytes)}`
    ]);
  });
});
