import { eventually, uniqueId } from '@lowerdeck/testing-tools';
import { describe, expect, it } from 'vitest';
import { db } from '../src/db';
import { origin } from './client';
import { expectRpcError } from './errors';
import { createRepoSetup, createTenant } from './fixtures';

let text = (content: string) => Buffer.from(content, 'utf-8').toString('base64');

let createBucket = async (
  tenantId: string,
  input: {
    isReadOnly?: boolean;
    files?: { path: string; data: string; encoding: 'utf-8' | 'base64' }[];
  } = {}
) => origin.codeBucket.create({ tenantId, purpose: uniqueId('purpose'), ...input });

let readFile = async (tenantId: string, codeBucketId: string, path: string) => {
  let file = await origin.codeBucket.getFile({ tenantId, codeBucketId, path });
  return Buffer.from(file.content, 'base64').toString('utf-8');
};

let listPaths = async (tenantId: string, codeBucketId: string, prefix?: string) => {
  let result = await origin.codeBucket.getFiles({
    tenantId,
    codeBucketId,
    prefix,
    excludeContents: true
  });
  return (result.files as { path: string }[]).map(file => file.path).sort();
};

describe('origin code bucket', () => {
  it('creates an empty bucket', async () => {
    let tenant = await createTenant();

    let bucket = await createBucket(tenant.id);

    expect(bucket).toMatchObject({
      object: 'origin#codeBucket',
      status: 'ready',
      isReadOnly: false,
      isSynced: false,
      errorMessage: null
    });
    expect(bucket.repository).toBeUndefined();

    let row = await db.codeBucket.findUniqueOrThrow({
      where: { id: bucket.id },
      include: { purpose: true }
    });
    expect(row.tenantOid).toBe(tenant.oid);
  });

  it('reuses the purpose for the same tenant', async () => {
    let tenant = await createTenant();
    let purpose = uniqueId('purpose');

    let first = await origin.codeBucket.create({ tenantId: tenant.id, purpose });
    let second = await origin.codeBucket.create({ tenantId: tenant.id, purpose });

    let rows = await db.codeBucket.findMany({ where: { id: { in: [first.id, second.id] } } });
    expect(new Set(rows.map(row => row.purposeOid)).size).toBe(1);
  });

  it('creates a bucket with utf-8 and base64 files', async () => {
    let tenant = await createTenant();
    let binary = Buffer.from([0, 1, 2, 250, 251]);

    let bucket = await createBucket(tenant.id, {
      files: [
        { path: 'readme.md', data: '# Hello', encoding: 'utf-8' },
        { path: 'src/index.ts', data: 'export let a = 1;', encoding: 'utf-8' },
        { path: 'bin/data.bin', data: binary.toString('base64'), encoding: 'base64' }
      ]
    });

    expect(await readFile(tenant.id, bucket.id, 'readme.md')).toBe('# Hello');
    expect(await readFile(tenant.id, bucket.id, 'src/index.ts')).toBe('export let a = 1;');

    let file = await origin.codeBucket.getFile({
      tenantId: tenant.id,
      codeBucketId: bucket.id,
      path: 'bin/data.bin'
    });
    expect(file).toMatchObject({
      object: 'origin#codeBucketFileContent',
      encoding: 'base64',
      size: '5'
    });
    expect(Buffer.from(file.content, 'base64').equals(binary)).toBe(true);
  });

  it('gets a bucket', async () => {
    let tenant = await createTenant();
    let bucket = await createBucket(tenant.id);

    let fetched = await origin.codeBucket.get({
      tenantId: tenant.id,
      codeBucketId: bucket.id
    });

    expect(fetched).toMatchObject({ id: bucket.id, status: 'ready' });
  });

  it('lists files with and without contents and by prefix', async () => {
    let tenant = await createTenant();
    let bucket = await createBucket(tenant.id, {
      files: [
        { path: 'a.txt', data: 'a', encoding: 'utf-8' },
        { path: 'docs/one.md', data: 'one', encoding: 'utf-8' },
        { path: 'docs/two.md', data: 'two', encoding: 'utf-8' }
      ]
    });

    expect(await listPaths(tenant.id, bucket.id)).toEqual([
      '/a.txt',
      '/docs/one.md',
      '/docs/two.md'
    ]);
    expect(await listPaths(tenant.id, bucket.id, 'docs/')).toEqual([
      '/docs/one.md',
      '/docs/two.md'
    ]);

    let info = await origin.codeBucket.getFiles({
      tenantId: tenant.id,
      codeBucketId: bucket.id,
      excludeContents: true
    });
    expect(info.files[0]).toMatchObject({ object: 'origin#codeBucketFileInfo' });
    expect(Object.keys(info.files[0]!)).not.toContain('content');

    let withContent = await origin.codeBucket.getFiles({
      tenantId: tenant.id,
      codeBucketId: bucket.id,
      prefix: 'docs/'
    });
    let contents = (withContent.files as { path: string; content: string }[]).map(file => ({
      path: file.path,
      content: Buffer.from(file.content, 'base64').toString('utf-8')
    }));
    expect(contents.sort((a, b) => a.path.localeCompare(b.path))).toEqual([
      { path: '/docs/one.md', content: 'one' },
      { path: '/docs/two.md', content: 'two' }
    ]);
  });

  it('sets, overwrites and deletes files', async () => {
    let tenant = await createTenant();
    let bucket = await createBucket(tenant.id);
    let base = { tenantId: tenant.id, codeBucketId: bucket.id };

    await origin.codeBucket.setFile({
      ...base,
      path: 'file.txt',
      data: 'first',
      encoding: 'utf-8'
    });
    expect(await readFile(tenant.id, bucket.id, 'file.txt')).toBe('first');

    await origin.codeBucket.setFile({
      ...base,
      path: 'file.txt',
      data: text('second'),
      encoding: 'base64'
    });
    expect(await readFile(tenant.id, bucket.id, 'file.txt')).toBe('second');

    await origin.codeBucket.setFiles({
      ...base,
      files: [
        { path: 'x/1.txt', data: '1', encoding: 'utf-8' },
        { path: 'x/2.txt', data: '2', encoding: 'utf-8' }
      ]
    });
    expect(await listPaths(tenant.id, bucket.id)).toEqual([
      '/file.txt',
      '/x/1.txt',
      '/x/2.txt'
    ]);

    await origin.codeBucket.deleteFile({ ...base, path: 'file.txt' });
    expect(await listPaths(tenant.id, bucket.id)).toEqual(['/x/1.txt', '/x/2.txt']);

    await origin.codeBucket.deletePath({ ...base, path: 'x' });
    expect(await listPaths(tenant.id, bucket.id)).toEqual([]);
  });

  it('normalizes leading slashes in paths', async () => {
    let tenant = await createTenant();
    let bucket = await createBucket(tenant.id);

    await origin.codeBucket.setFile({
      tenantId: tenant.id,
      codeBucketId: bucket.id,
      path: '/lead/slash.txt',
      data: 'content',
      encoding: 'utf-8'
    });

    expect(await readFile(tenant.id, bucket.id, 'lead/slash.txt')).toBe('content');
  });

  it('fails to read a missing file', async () => {
    let tenant = await createTenant();
    let bucket = await createBucket(tenant.id);

    await expectRpcError(
      origin.codeBucket.getFile({
        tenantId: tenant.id,
        codeBucketId: bucket.id,
        path: 'missing.txt'
      }),
      'not_found'
    );
  });

  it('exports a zip download', async () => {
    let tenant = await createTenant();
    let bucket = await createBucket(tenant.id, {
      files: [{ path: 'a.txt', data: 'a', encoding: 'utf-8' }]
    });

    let zip = await origin.codeBucket.getAsZip({
      tenantId: tenant.id,
      codeBucketId: bucket.id
    });

    expect(zip.downloadUrl).toContain('/download/code-bucket/zips/');
    expect(new Date(zip.expiresAt).getTime()).toBeGreaterThan(Date.now());
  });

  it('issues editor tokens', async () => {
    let tenant = await createTenant();
    let bucket = await createBucket(tenant.id);

    let token = await origin.codeBucket.getEditorToken({
      tenantId: tenant.id,
      codeBucketId: bucket.id
    });

    expect(token.id).toBe(bucket.id);
    expect(token.token).toEqual(expect.any(String));
    expect(token.token.length).toBeGreaterThan(0);
    expect(new Date(token.expiresAt).getTime()).toBeGreaterThan(Date.now());

    let url = new URL(token.url);
    expect(url.searchParams.get('id')).toBe(bucket.id);
    expect(url.searchParams.get('token')).toBe(token.token);
  });

  it('issues editor tokens for a read-only bucket', async () => {
    let tenant = await createTenant();
    let bucket = await createBucket(tenant.id, { isReadOnly: true });

    let token = await origin.codeBucket.getEditorToken({
      tenantId: tenant.id,
      codeBucketId: bucket.id,
      isReadOnly: false
    });

    expect(token.token).toEqual(expect.any(String));
  });

  describe('read-only buckets', () => {
    it('can be read but not modified', async () => {
      let tenant = await createTenant();
      let bucket = await createBucket(tenant.id, {
        isReadOnly: true,
        files: [{ path: 'a.txt', data: 'a', encoding: 'utf-8' }]
      });
      let base = { tenantId: tenant.id, codeBucketId: bucket.id };

      expect(bucket.isReadOnly).toBe(true);
      expect(await readFile(tenant.id, bucket.id, 'a.txt')).toBe('a');

      let calls = [
        () =>
          origin.codeBucket.setFile({ ...base, path: 'b.txt', data: 'b', encoding: 'utf-8' }),
        () =>
          origin.codeBucket.setFiles({
            ...base,
            files: [{ path: 'b.txt', data: 'b', encoding: 'utf-8' }]
          }),
        () => origin.codeBucket.deleteFile({ ...base, path: 'a.txt' }),
        () => origin.codeBucket.deletePath({ ...base, path: 'a.txt' })
      ];

      for (let call of calls) {
        let error = await expectRpcError(call(), 'bad_request');
        expect(error.message).toBe('Cannot modify files in a read-only code bucket');
      }

      expect(await listPaths(tenant.id, bucket.id)).toEqual(['/a.txt']);
    });
  });

  describe('clone', () => {
    it.fails(
      'copies the files into a new bucket (bug: files written to a bucket are only flushed to object storage after a 5 minute delay, so copying a fresh bucket fails with object not found)',
      { timeout: 20_000 },
      async () => {
        let tenant = await createTenant();
        let source = await createBucket(tenant.id, {
          files: [
            { path: 'a.txt', data: 'a', encoding: 'utf-8' },
            { path: 'dir/b.txt', data: 'b', encoding: 'utf-8' }
          ]
        });

        let clone = await origin.codeBucket.clone({
          tenantId: tenant.id,
          codeBucketId: source.id
        });
        expect(clone.id).not.toBe(source.id);
        expect(clone.status).toBe('importing');

        await eventually(
          async () => {
            let fetched = await origin.codeBucket.get({
              tenantId: tenant.id,
              codeBucketId: clone.id
            });
            expect(fetched.status).toBe('ready');
          },
          { timeoutMs: 8000 }
        );

        expect(await listPaths(tenant.id, clone.id)).toEqual(['/a.txt', '/dir/b.txt']);

        let row = await db.codeBucket.findUniqueOrThrow({
          where: { id: clone.id },
          include: { parent: true }
        });
        expect(row.parent?.id).toBe(source.id);
      }
    );

    it.fails(
      'does not change the source when the clone is modified (bug: files written to a bucket are only flushed to object storage after a 5 minute delay, so copying a fresh bucket fails with object not found)',
      { timeout: 20_000 },
      async () => {
        let tenant = await createTenant();
        let source = await createBucket(tenant.id, {
          files: [{ path: 'a.txt', data: 'original', encoding: 'utf-8' }]
        });
        let clone = await origin.codeBucket.clone({
          tenantId: tenant.id,
          codeBucketId: source.id
        });

        await origin.codeBucket.setFile({
          tenantId: tenant.id,
          codeBucketId: clone.id,
          path: 'a.txt',
          data: 'changed',
          encoding: 'utf-8'
        });

        expect(await readFile(tenant.id, clone.id, 'a.txt')).toBe('changed');
        expect(await readFile(tenant.id, source.id, 'a.txt')).toBe('original');
      }
    );

    it('can create a read-only clone', async () => {
      let tenant = await createTenant();
      let source = await createBucket(tenant.id);

      let clone = await origin.codeBucket.clone({
        tenantId: tenant.id,
        codeBucketId: source.id,
        isReadOnly: true
      });

      expect(clone.isReadOnly).toBe(true);
    });
  });

  describe('syncBuckets', () => {
    it.fails(
      'copies the contents of the source into the target (bug: files written to a bucket are only flushed to object storage after a 5 minute delay, so copying a fresh bucket fails with object not found)',
      { timeout: 20_000 },
      async () => {
        let tenant = await createTenant();
        let source = await createBucket(tenant.id, {
          files: [{ path: 'from-source.txt', data: 'source', encoding: 'utf-8' }]
        });
        let target = await createBucket(tenant.id);

        expect(
          await origin.codeBucket.syncBuckets({
            tenantId: tenant.id,
            sourceCodeBucketId: source.id,
            targetCodeBucketId: target.id
          })
        ).toEqual({ success: true });

        await eventually(
          async () => {
            let fetched = await origin.codeBucket.get({
              tenantId: tenant.id,
              codeBucketId: target.id
            });
            expect(fetched.status).toBe('ready');
            expect(await listPaths(tenant.id, target.id)).toContain('/from-source.txt');
          },
          { timeoutMs: 8000 }
        );

        expect(await readFile(tenant.id, target.id, 'from-source.txt')).toBe('source');
      }
    );

    it('rejects buckets of another tenant', async () => {
      let tenant = await createTenant();
      let other = await createTenant();
      let own = await createBucket(tenant.id);
      let foreign = await createBucket(other.id);

      await expectRpcError(
        origin.codeBucket.syncBuckets({
          tenantId: tenant.id,
          sourceCodeBucketId: foreign.id,
          targetCodeBucketId: own.id
        }),
        'not_found'
      );
      await expectRpcError(
        origin.codeBucket.syncBuckets({
          tenantId: tenant.id,
          sourceCodeBucketId: own.id,
          targetCodeBucketId: foreign.id
        }),
        'not_found'
      );
    });
  });

  describe('repository links', () => {
    it('rejects enabling sync for a bucket without a repository', async () => {
      let tenant = await createTenant();
      let bucket = await createBucket(tenant.id);

      let error = await expectRpcError(
        origin.codeBucket.enableSyncFromRepo({
          tenantId: tenant.id,
          codeBucketId: bucket.id
        }),
        'bad_request'
      );
      expect(error.message).toBe('Code bucket is not linked to a repository');
    });

    it('rejects creating a bucket from an unknown or foreign repository', async () => {
      let { repo } = await createRepoSetup();
      let other = await createTenant();

      for (let scmRepoId of [repo.id, uniqueId('missing')])
        await expectRpcError(
          origin.codeBucket.createFromRepo({
            tenantId: other.id,
            scmRepoId,
            purpose: uniqueId('purpose')
          }),
          'bad_request'
        );
    });
  });

  describe('validation', () => {
    it('rejects invalid file encodings and missing purposes', async () => {
      let tenant = await createTenant();

      await expectRpcError(
        origin.codeBucket.create({
          tenantId: tenant.id,
          purpose: 'purpose',
          files: [{ path: 'a', data: 'a', encoding: 'latin1' as any }]
        }),
        'invalid_data'
      );
      await expectRpcError(
        origin.codeBucket.create({ tenantId: tenant.id } as any),
        'invalid_data'
      );
    });
  });

  describe('tenant isolation', () => {
    it('hides buckets from other tenants', async () => {
      let owner = await createTenant();
      let other = await createTenant();
      let bucket = await createBucket(owner.id, {
        files: [{ path: 'secret.txt', data: 'secret', encoding: 'utf-8' }]
      });
      let base = { tenantId: other.id, codeBucketId: bucket.id };

      let calls = [
        () => origin.codeBucket.get(base),
        () => origin.codeBucket.clone(base),
        () => origin.codeBucket.getFile({ ...base, path: 'secret.txt' }),
        () => origin.codeBucket.getFiles(base),
        () => origin.codeBucket.getAsZip(base),
        () => origin.codeBucket.getEditorToken(base),
        () => origin.codeBucket.enableSyncFromRepo(base),
        () => origin.codeBucket.setFile({ ...base, path: 'x', data: 'x', encoding: 'utf-8' }),
        () =>
          origin.codeBucket.setFiles({
            ...base,
            files: [{ path: 'x', data: 'x', encoding: 'utf-8' }]
          }),
        () => origin.codeBucket.deleteFile({ ...base, path: 'secret.txt' }),
        () => origin.codeBucket.deletePath({ ...base, path: 'secret.txt' })
      ];

      for (let call of calls) await expectRpcError(call(), 'not_found');

      expect(await listPaths(owner.id, bucket.id)).toEqual(['/secret.txt']);
    });

    it('rejects an unknown bucket', async () => {
      let tenant = await createTenant();

      await expectRpcError(
        origin.codeBucket.get({ tenantId: tenant.id, codeBucketId: uniqueId('missing') }),
        'not_found'
      );
    });
  });
});
