import { uniqueId } from '@metorial/e2e';
import { randomBytes } from 'node:crypto';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ObjectStorageError } from 'object-storage-client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { getCargoFilesBucketName, getObjectStream, getStorage, putObjectFile } from '../src';

describe('putObjectFile', () => {
  let directory: string;

  beforeAll(async () => {
    directory = await mkdtemp(join(tmpdir(), 'object-file-e2e-'));
  });

  afterAll(async () => {
    await rm(directory, { recursive: true, force: true });
  });

  it('stores the file byte for byte under the key with its content type', async () => {
    let content = randomBytes(3 * 1024 * 1024 + 17);
    let path = join(directory, 'object.bin');
    await writeFile(path, content);
    let key = `e2e/object-file/${uniqueId('object')}`;

    await putObjectFile({
      bucket: getCargoFilesBucketName(),
      key,
      path,
      contentType: 'application/gzip'
    });

    let object = await getObjectStream(getCargoFilesBucketName(), key);
    let stored = Buffer.from(await new Response(object.stream).arrayBuffer());
    expect(stored.equals(content)).toBe(true);
    expect(object.size).toBe(content.byteLength);
    expect(object.contentType).toBe('application/gzip');

    let metadata = await getStorage().headObject(getCargoFilesBucketName(), key);
    expect(Number(metadata.size)).toBe(content.byteLength);

    await getStorage().deleteObject(getCargoFilesBucketName(), key);
  });

  it('surfaces a rejected write as a storage error', async () => {
    let path = join(directory, 'small.bin');
    await writeFile(path, 'x');

    let error = await putObjectFile({
      bucket: `missing-bucket-${uniqueId('bucket').toLowerCase()}`,
      key: 'a',
      path
    }).catch(e => e);

    expect(error).toBeInstanceOf(ObjectStorageError);
  });
});
