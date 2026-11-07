import { uniqueId } from '@lowerdeck/testing-tools';
import { describe, expect, it } from 'vitest';
import { db } from '../src/db';
import {
  buildZip,
  createPublisher,
  publicApi,
  publishSlate,
  registryClient,
  slatePackageFiles,
  uploadVersion
} from './helpers';

let upload = async (
  publisher: { token: string; scope: string },
  slate: string,
  files: Record<string, string>,
  opts: { version?: string; query?: Record<string, string> } = {}
) =>
  uploadVersion({
    token: publisher.token,
    scope: publisher.scope,
    slate,
    version: opts.version ?? '1.0.0',
    body: await buildZip(files),
    query: opts.query
  });

describe('slate version upload auth E2E', () => {
  it('requires a user token', async () => {
    let publisher = await createPublisher();
    let slate = uniqueId('slate');
    let body = await buildZip(slatePackageFiles({ scope: publisher.scope, slate }));

    let anonymous = await uploadVersion({
      scope: publisher.scope,
      slate,
      version: '1.0.0',
      body
    });
    expect(anonymous.status).toBe(401);

    let garbage = await uploadVersion({
      token: 'not-a-token',
      scope: publisher.scope,
      slate,
      version: '1.0.0',
      body
    });
    expect(garbage.status).toBe(401);
  });

  it('rejects reader tokens', async () => {
    let publisher = await createPublisher();
    let reader = await registryClient.readerToken.create({
      tenantId: publisher.tenant.id,
      name: 'reader'
    });
    let slate = uniqueId('slate');

    let result = await uploadVersion({
      token: reader.secret,
      scope: publisher.scope,
      slate,
      version: '1.0.0',
      body: await buildZip(slatePackageFiles({ scope: publisher.scope, slate }))
    });
    expect(result.status).toBe(401);
  });

  it('rejects read-only users', async () => {
    let publisher = await createPublisher();
    await db.user.update({
      where: { id: publisher.user.id },
      data: { access: 'read' }
    });
    let slate = uniqueId('slate');

    let result = await upload(
      publisher,
      slate,
      slatePackageFiles({ scope: publisher.scope, slate })
    );
    expect(result.status).toBe(403);
  });

  it('rejects publishing into a scope of another tenant', async () => {
    let owner = await createPublisher();
    let attacker = await createPublisher();
    let slate = uniqueId('slate');

    let result = await uploadVersion({
      token: attacker.token,
      scope: owner.scope,
      slate,
      version: '1.0.0',
      body: await buildZip(slatePackageFiles({ scope: owner.scope, slate }))
    });
    expect(result.status).toBe(403);

    let lookup = await publicApi(owner.token).get(`/slates/${owner.scope}/${slate}`);
    expect(lookup.status).toBe(404);
  });

  it('returns 404 for an unknown scope', async () => {
    let publisher = await createPublisher();
    let scope = uniqueId('missing');
    let slate = uniqueId('slate');

    let result = await uploadVersion({
      token: publisher.token,
      scope,
      slate,
      version: '1.0.0',
      body: await buildZip(slatePackageFiles({ scope, slate }))
    });
    expect(result.status).toBe(404);
  });
});

describe('slate version upload E2E', () => {
  it('publishes a prebuilt version and presents it', async () => {
    let publisher = await createPublisher();
    let slate = uniqueId('slate');

    let result = await upload(
      publisher,
      slate,
      slatePackageFiles({
        scope: publisher.scope,
        slate,
        version: '1.2.3',
        manifest: {
          description: 'A demo slate',
          categories: ['e2e-demo'],
          timeout: 60
        },
        extra: { 'README.md': '# Hello', 'docs/guide.md': '# Guide' }
      }),
      { version: '1.2.3' }
    );

    expect(result.status).toBe(200);
    expect(result.body).toMatchObject({
      object: 'slate.version',
      version: '1.2.3',
      build: 'prebuilt',
      isCurrent: true,
      manifest: { name: `@${publisher.scope}/${slate}`, description: 'A demo slate', timeout: 60 }
    });
    expect(result.body.documents.map((d: any) => d.path).sort()).toEqual([
      'README.md',
      'docs/guide.md'
    ]);

    let presented = await publicApi(publisher.token).get(`/slates/${publisher.scope}/${slate}`, {
      query: { supports_prebuilt: true }
    });
    expect(presented.status).toBe(200);
    expect(presented.body).toMatchObject({
      object: 'slate',
      fullIdentifier: `${publisher.scope}/${slate}`,
      identifier: slate,
      status: 'active',
      tenantId: publisher.tenant.id,
      currentVersion: { version: '1.2.3' },
      categories: [expect.objectContaining({ identifier: 'e2e-demo' })]
    });
  });

  it('is idempotent for identical contents', async () => {
    let publisher = await createPublisher();
    let slate = uniqueId('slate');
    let files = slatePackageFiles({ scope: publisher.scope, slate });

    let first = await upload(publisher, slate, files);
    let second = await upload(publisher, slate, files);

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(second.body.id).toBe(first.body.id);

    let versions = await publicApi(publisher.token).get(
      `/slates/${publisher.scope}/${slate}/versions`,
      { query: { supports_prebuilt: true } }
    );
    expect(versions.body.items).toHaveLength(1);
  });

  it('rejects different contents for an existing version with 409', async () => {
    let publisher = await createPublisher();
    let slate = uniqueId('slate');

    await upload(publisher, slate, slatePackageFiles({ scope: publisher.scope, slate }));

    let changed = await upload(
      publisher,
      slate,
      slatePackageFiles({
        scope: publisher.scope,
        slate,
        extra: { 'dist/index.js': 'module.exports = { changed: true };' }
      })
    );
    expect(changed.status).toBe(409);
  });

  it('rejects a slate identifier that another scope already uses', async () => {
    let first = await createPublisher();
    let second = await createPublisher();
    let slate = uniqueId('slate');

    await upload(first, slate, slatePackageFiles({ scope: first.scope, slate }));

    let result = await upload(
      second,
      slate,
      slatePackageFiles({ scope: second.scope, slate })
    );
    expect(result.status).toBe(409);
  });

  it('keeps old versions and moves the current pointer to the newest', async () => {
    let publisher = await createPublisher();
    let slate = uniqueId('slate');

    for (let version of ['1.0.0', '2.0.0', '1.5.0']) {
      let result = await upload(
        publisher,
        slate,
        slatePackageFiles({ scope: publisher.scope, slate, version }),
        { version }
      );
      expect(result.status).toBe(200);
    }

    let versions = await publicApi(publisher.token).get(
      `/slates/${publisher.scope}/${slate}/versions`,
      { query: { supports_prebuilt: true } }
    );
    expect(versions.body.items.map((v: any) => v.version).sort()).toEqual([
      '1.0.0',
      '1.5.0',
      '2.0.0'
    ]);

    let current = versions.body.items.filter((v: any) => v.isCurrent);
    expect(current).toHaveLength(1);
    expect(current[0].version).toBe('2.0.0');
  });

  describe('access', () => {
    it('defaults new slates to private', async () => {
      let publisher = await createPublisher();
      let { slate } = await publishSlate(publisher);

      let presented = await publicApi(publisher.token).get(
        `/slates/${publisher.scope}/${slate}`,
        { query: { supports_prebuilt: true } }
      );
      expect(presented.body.access).toBe('private');
    });

    it('applies default_access only when the upload creates the slate', async () => {
      let publisher = await createPublisher();
      let { slate } = await publishSlate(publisher, { query: { default_access: 'public' } });

      let get = () =>
        publicApi(publisher.token).get(`/slates/${publisher.scope}/${slate}`, {
          query: { supports_prebuilt: true }
        });
      expect((await get()).body.access).toBe('public');

      await publishSlate(publisher, {
        slate,
        version: '1.1.0',
        query: { default_access: 'private' }
      });
      expect((await get()).body.access).toBe('public');
    });

    it('applies access to every new version', async () => {
      let publisher = await createPublisher();
      let { slate } = await publishSlate(publisher, { query: { access: 'public' } });
      await publishSlate(publisher, { slate, version: '1.1.0', query: { access: 'private' } });

      let presented = await publicApi(publisher.token).get(
        `/slates/${publisher.scope}/${slate}`,
        { query: { supports_prebuilt: true } }
      );
      expect(presented.body.access).toBe('private');
    });

    it('validates the access query', async () => {
      let publisher = await createPublisher();
      let slate = uniqueId('slate');

      let result = await upload(
        publisher,
        slate,
        slatePackageFiles({ scope: publisher.scope, slate }),
        { query: { access: 'secret' } }
      );
      expect(result.status).toBe(400);
    });
  });

  describe('validation', () => {
    it('requires an application/zip content type', async () => {
      let publisher = await createPublisher();
      let slate = uniqueId('slate');
      let body = await buildZip(slatePackageFiles({ scope: publisher.scope, slate }));

      for (let contentType of ['application/json', 'text/plain', null]) {
        let result = await uploadVersion({
          token: publisher.token,
          scope: publisher.scope,
          slate,
          version: '1.0.0',
          body,
          contentType
        });
        expect(result.status).toBe(400);
      }
    });

    it('rejects bodies that are not zip archives', async () => {
      let publisher = await createPublisher();
      let result = await uploadVersion({
        token: publisher.token,
        scope: publisher.scope,
        slate: uniqueId('slate'),
        version: '1.0.0',
        body: 'definitely not a zip'
      });
      expect(result.status).toBe(400);
    });

    it('rejects packages without a dist directory', async () => {
      let publisher = await createPublisher();
      let slate = uniqueId('slate');
      let files = slatePackageFiles({ scope: publisher.scope, slate });
      delete files['dist/index.js'];
      files['src/helper.ts'] = 'export {}';

      let result = await upload(publisher, slate, files);
      expect(result.status).toBe(400);
    });

    it('rejects prebuilt packages that ship source entrypoints', async () => {
      let publisher = await createPublisher();
      let slate = uniqueId('slate');

      let result = await upload(
        publisher,
        slate,
        slatePackageFiles({
          scope: publisher.scope,
          slate,
          extra: { 'src/index.ts': 'export {}' }
        })
      );
      expect(result.status).toBe(400);
    });

    it('rejects packages whose main is not inside dist', async () => {
      let publisher = await createPublisher();
      let slate = uniqueId('slate');

      let result = await upload(
        publisher,
        slate,
        slatePackageFiles({
          scope: publisher.scope,
          slate,
          packageJson: { main: 'lib/index.js' },
          extra: { 'dist/other.js': '', 'lib/index.js': '' }
        })
      );
      expect(result.status).toBe(400);
    });

    it('requires slate.json and package.json', async () => {
      let publisher = await createPublisher();

      for (let missing of ['slate.json', 'package.json']) {
        let slate = uniqueId('slate');
        let files = slatePackageFiles({ scope: publisher.scope, slate });
        delete files[missing];

        let result = await upload(publisher, slate, files);
        expect(result.status).toBe(400);
      }
    });

    it('rejects malformed manifests', async () => {
      let publisher = await createPublisher();
      let cases: Record<string, Record<string, string>> = {};
      let slate = () => uniqueId('slate');

      let a = slate();
      cases[a] = { ...slatePackageFiles({ scope: publisher.scope, slate: a }), 'slate.json': '{' };
      let b = slate();
      cases[b] = slatePackageFiles({
        scope: publisher.scope,
        slate: b,
        manifest: { timeout: 901 }
      });
      let c = slate();
      cases[c] = slatePackageFiles({
        scope: publisher.scope,
        slate: c,
        manifest: { timeout: 0 }
      });
      let d = slate();
      cases[d] = slatePackageFiles({
        scope: publisher.scope,
        slate: d,
        manifest: { categories: 'not-an-array' }
      });

      for (let [name, files] of Object.entries(cases)) {
        let result = await upload(publisher, name, files);
        expect(result.status, name).toBe(400);
      }
    });

    it('rejects invalid semver versions', async () => {
      let publisher = await createPublisher();
      let slate = uniqueId('slate');

      let result = await upload(
        publisher,
        slate,
        slatePackageFiles({ scope: publisher.scope, slate, version: 'not-semver' }),
        { version: 'not-semver' }
      );
      expect(result.status).toBe(400);
    });

    it('requires the URL version to match package.json', async () => {
      let publisher = await createPublisher();
      let slate = uniqueId('slate');

      let result = await upload(
        publisher,
        slate,
        slatePackageFiles({ scope: publisher.scope, slate, version: '1.0.0' }),
        { version: '2.0.0' }
      );
      expect(result.status).toBe(400);
    });

    it('requires slate.json name to match the URL', async () => {
      let publisher = await createPublisher();
      let slate = uniqueId('slate');

      let result = await upload(
        publisher,
        slate,
        slatePackageFiles({ scope: publisher.scope, slate: uniqueId('other') })
      );
      expect(result.status).toBe(400);
    });

    it('rejects archives with path traversal', async () => {
      let publisher = await createPublisher();
      let slate = uniqueId('slate');

      let result = await upload(publisher, slate, {
        ...slatePackageFiles({ scope: publisher.scope, slate }),
        'dist/../../evil.js': 'x'
      });
      expect(result.status).toBe(400);
    });

    it('rejects archives with non-canonical paths', async () => {
      let publisher = await createPublisher();
      let slate = uniqueId('slate');
      let files = slatePackageFiles({ scope: publisher.scope, slate });

      let prefixed = Object.fromEntries(
        Object.entries(files).map(([path, content]) => [`package/${path}`, content])
      );

      let result = await upload(publisher, slate, prefixed);
      expect(result.status).toBe(400);
    });

    it('rejects oversized bodies', async () => {
      let publisher = await createPublisher();
      let result = await uploadVersion({
        token: publisher.token,
        scope: publisher.scope,
        slate: uniqueId('slate'),
        version: '1.0.0',
        body: Buffer.alloc(64 * 1024 * 1024 + 1024)
      });
      expect(result.status).toBe(413);
    });
  });

  describe('base64 json upload', () => {
    it('publishes an unbuilt version', async () => {
      let publisher = await createPublisher();
      let slate = uniqueId('slate');
      let files = slatePackageFiles({ scope: publisher.scope, slate });
      delete files['dist/index.js'];
      files['src/index.ts'] = 'export default {};';

      let response = await publicApi(publisher.token).post(
        `/slates/${publisher.scope}/${slate}/versions`,
        {
          contentBase64: (await buildZip(files)).toString('base64'),
          access: 'private'
        }
      );

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({ version: '1.0.0', build: 'unbuilt' });
    });

    it('validates the body and requires auth', async () => {
      let publisher = await createPublisher();
      let path = `/slates/${publisher.scope}/${uniqueId('slate')}/versions`;

      let invalid = await publicApi(publisher.token).post(path, { access: 'private' });
      expect(invalid.status).toBe(400);

      let anonymous = await publicApi().post(path, { contentBase64: '', access: 'private' });
      expect(anonymous.status).toBe(401);
    });
  });
});
