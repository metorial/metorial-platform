import { hashBytes } from '@lowerdeck/hash/content';
import { beforeEach, describe, expect, it, vi } from 'vitest';

let { events, db, storage } = vi.hoisted(() => {
  let events: string[] = [];

  let db = {
    $executeRaw: vi.fn(async (_strings: TemplateStringsArray, keys: string[]) => {
      events.push(`lock:${keys.join(',')}`);
    }),
    skillSyncBlob: {
      createMany: vi.fn(async ({ data }: any) => {
        events.push(`row:${data.map((blob: { key: string }) => blob.key).join(',')}`);
      }),
      updateMany: vi.fn(async () => {})
    }
  };

  let storage = {
    objects: new Set<string>(),
    putObject: vi.fn(async (_bucket: string, key: string) => {
      events.push(`put:${key}`);
      storage.objects.add(key);
    }),
    headObject: vi.fn(async (_bucket: string, key: string) => {
      if (!storage.objects.has(key))
        throw Object.assign(new Error('missing'), { statusCode: 404 });
      return { key };
    })
  };

  return { events, db, storage };
});

vi.mock('@metorial/db', () => ({
  withTransaction: async (run: (tx: typeof db) => unknown) => {
    events.push('tx');
    return await run(db);
  }
}));
vi.mock('@metorial/module-file', () => ({
  getCargoFilesBucketName: () => 'files',
  getStorage: () => storage
}));

import { getSkillSyncBlobKey, lockSkillSyncObjects, putSkillSyncBlobs } from './blobStore';

let bytes = (text: string) => new TextEncoder().encode(text);
let keyOf = (text: string) => getSkillSyncBlobKey(hashBytes(bytes(text)).sha256);

describe('putSkillSyncBlobs', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    events.length = 0;
    storage.objects.clear();
  });

  it('tracks the row before the object exists and references it under the same locks', async () => {
    let reference = vi.fn(async () => {
      events.push('reference');
      return 'result';
    });

    let { blobs, result, written, rewritten } = await putSkillSyncBlobs({
      blobs: [{ bytes: bytes('a') }],
      reference
    });

    let key = keyOf('a');
    let lock = `lock:skill-sync-object:${key}`;
    expect(events.filter(event => event !== 'tx')).toEqual([
      lock,
      `row:${key}`,
      `put:${key}`,
      lock,
      `row:${key}`,
      'reference'
    ]);
    expect(result).toBe('result');
    expect(written).toBe(1);
    expect(rewritten).toBe(0);
    expect(blobs).toEqual([
      expect.objectContaining({
        key,
        sha256: hashBytes(bytes('a')).sha256,
        gitBlobSha: hashBytes(bytes('a')).gitBlobSha,
        byteSize: 1
      })
    ]);
  });

  it('writes duplicate content once but returns one ref per input', async () => {
    let { blobs, written } = await putSkillSyncBlobs({
      blobs: [{ bytes: bytes('same') }, { bytes: bytes('other') }, { bytes: bytes('same') }],
      reference: async refs => refs.length
    });

    expect(written).toBe(2);
    expect(blobs.map(blob => blob.key)).toEqual([
      keyOf('same'),
      keyOf('other'),
      keyOf('same')
    ]);
    expect(storage.putObject).toHaveBeenCalledTimes(2);
  });

  it('re-uploads an object garbage collection deleted between the upload and the reference', async () => {
    let key = keyOf('gc');

    await putSkillSyncBlobs({
      blobs: [{ bytes: bytes('gc') }],
      reference: async () => {
        storage.objects.delete(key);
      }
    });

    expect(storage.putObject).toHaveBeenCalledTimes(2);
    expect(storage.objects.has(key)).toBe(true);
  });

  it('does not reference anything when the upload fails', async () => {
    storage.putObject.mockRejectedValueOnce(new Error('storage down'));
    let reference = vi.fn();

    await expect(
      putSkillSyncBlobs({ blobs: [{ bytes: bytes('x') }], reference })
    ).rejects.toThrow('storage down');
    expect(reference).not.toHaveBeenCalled();
  });

  it('still runs the reference callback when there is nothing to upload', async () => {
    let { result } = await putSkillSyncBlobs({ blobs: [], reference: async () => 'rows' });

    expect(result).toBe('rows');
    expect(db.$executeRaw).not.toHaveBeenCalled();
  });
});

describe('lockSkillSyncObjects', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    events.length = 0;
  });

  it('locks keys deduplicated and in one sorted order', async () => {
    await lockSkillSyncObjects(['b', 'a', 'b']);
    await lockSkillSyncObjects(['a', 'b']);

    let locks = events.filter(event => event.startsWith('lock:'));
    expect(locks).toEqual([
      'lock:skill-sync-object:a,skill-sync-object:b',
      'lock:skill-sync-object:a,skill-sync-object:b'
    ]);
  });
});
