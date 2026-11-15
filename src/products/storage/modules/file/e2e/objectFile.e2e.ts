import { uniqueId } from '@metorial/e2e';
import { randomBytes } from 'node:crypto';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ObjectStorageError } from 'object-storage-client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  createZipJobFromSpecFile,
  getCargoFilesBucketName,
  getObjectStream,
  getStorage,
  putObjectFile
} from '../src';

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

describe('createZipJobFromSpecFile', () => {
  let directory: string;

  beforeAll(async () => {
    directory = await mkdtemp(join(tmpdir(), 'zip-spec-e2e-'));
  });

  afterAll(async () => {
    await rm(directory, { recursive: true, force: true });
  });

  it('builds the archive from a spec file and joins the same spec sent by the client', async () => {
    let bucket = getCargoFilesBucketName();
    let sourceKey = `e2e/zip-spec/${uniqueId('source')}`;
    let archiveKey = `e2e/zip-spec/${uniqueId('archive')}.zip`;
    let jobId = uniqueId('zip-spec');
    await getStorage().putObject(bucket, sourceKey, Buffer.from('hello zip'), 'text/plain');

    let spec = {
      destination: { bucket, key: archiveKey, contentType: 'application/zip' },
      entries: [{ path: 'docs/hello.txt', source: { bucket, key: sourceKey } }]
    };
    let path = join(directory, 'spec.json');
    await writeFile(path, JSON.stringify(spec));

    let job = await createZipJobFromSpecFile({ jobId, path, waitSeconds: 20 });
    expect(job).toMatchObject({ id: jobId, state: 'completed' });

    let joined = await getStorage().createZipJob(
      jobId,
      { ...spec, entries: spec.entries.map(entry => ({ ...entry, compression: 'auto' })) },
      { waitSeconds: 1 }
    );
    expect(joined).toMatchObject({ id: jobId, state: 'completed', specHash: job.specHash });

    let archive = await getObjectStream(bucket, archiveKey);
    let bytes = Buffer.from(await new Response(archive.stream).arrayBuffer());
    expect(bytes.subarray(0, 4).toString('hex')).toBe('504b0304');
    expect(bytes.includes(Buffer.from('docs/hello.txt'))).toBe(true);

    await getStorage().deleteObject(bucket, sourceKey);
    await getStorage().deleteObject(bucket, archiveKey);
  });

  it('surfaces a conflicting spec under the same job id as a storage error', async () => {
    let bucket = getCargoFilesBucketName();
    let sourceKey = `e2e/zip-spec/${uniqueId('source')}`;
    let jobId = uniqueId('zip-spec');
    await getStorage().putObject(bucket, sourceKey, Buffer.from('a'), 'text/plain');

    let first = join(directory, 'first.json');
    let second = join(directory, 'second.json');
    let destination = { bucket, key: `e2e/zip-spec/${uniqueId('archive')}.zip` };
    await writeFile(
      first,
      JSON.stringify({
        destination,
        entries: [{ path: 'a.txt', source: { bucket, key: sourceKey } }]
      })
    );
    await writeFile(
      second,
      JSON.stringify({
        destination,
        entries: [{ path: 'b.txt', source: { bucket, key: sourceKey } }]
      })
    );

    await createZipJobFromSpecFile({ jobId, path: first, waitSeconds: 20 });
    let error = await createZipJobFromSpecFile({ jobId, path: second }).catch(e => e);

    expect(error).toBeInstanceOf(ObjectStorageError);
    expect(error.statusCode).toBe(409);

    await getStorage().deleteObject(bucket, sourceKey);
    await getStorage().deleteObject(bucket, destination.key);
  });
});
