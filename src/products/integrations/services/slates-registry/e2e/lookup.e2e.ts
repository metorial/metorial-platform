import { uniqueId } from '@lowerdeck/testing-tools';
import { describe, expect, it } from 'vitest';
import { db } from '../src/db';
import { createPublisher, publicApi, publishSlate, registryClient } from './helpers';

describe('version lookup E2E', () => {
  it('requires a user token', async () => {
    let anonymous = await publicApi().post('/slates/version-lookup', { items: [] });
    expect(anonymous.status).toBe(401);

    let publisher = await createPublisher();
    let reader = await registryClient.readerToken.create({
      tenantId: publisher.tenant.id,
      name: 'reader'
    });
    let asReader = await publicApi(reader.secret).post('/slates/version-lookup', { items: [] });
    expect(asReader.status).toBe(401);
  });

  it('reports every status in request order', async () => {
    let publisher = await createPublisher();
    let other = await createPublisher();

    let { slate: published, published: version } = await publishSlate(publisher);
    let { slate: deleted } = await publishSlate(publisher);
    await db.slate.updateMany({
      where: { identifier: deleted },
      data: { status: 'deleted' }
    });
    let { slate: foreign } = await publishSlate(other);

    let items = [
      { identifier: `@${publisher.scope}/${published}`, version: '1.0.0' },
      { identifier: `@${publisher.scope}/${published}`, version: '9.9.9' },
      { identifier: `@${publisher.scope}/${uniqueId('unknown')}`, version: '1.0.0' },
      { identifier: `@${uniqueId('noscope')}/x`, version: '1.0.0' },
      { identifier: `@${other.scope}/${foreign}`, version: '1.0.0' },
      { identifier: `@${publisher.scope}/${deleted}`, version: '1.0.0' },
      { identifier: 'not-an-identifier', version: '1.0.0' }
    ];

    let response = await publicApi(publisher.token).post('/slates/version-lookup', { items });
    expect(response.status).toBe(200);

    expect(response.body.items.map((i: any) => i.status)).toEqual([
      'published',
      'not_published',
      'not_published',
      'scope_not_found',
      'scope_forbidden',
      'slate_deleted',
      'scope_not_found'
    ]);
    expect(response.body.items.map((i: any) => i.identifier)).toEqual(
      items.map(i => i.identifier)
    );

    let hit = response.body.items[0];
    expect(hit.checksum).toEqual(expect.any(String));
    expect(hit.checksum).toBe(
      (
        await db.slateVersion.findFirstOrThrow({
          where: { id: version.id },
          include: { bundleArtifact: true }
        })
      ).bundleArtifact.checksum
    );
    expect(response.body.items[1].checksum).toBeNull();
  });

  it('matches semver-equivalent versions', async () => {
    let publisher = await createPublisher();
    let { slate } = await publishSlate(publisher, { version: '1.2.3' });

    let response = await publicApi(publisher.token).post('/slates/version-lookup', {
      items: [{ identifier: `@${publisher.scope}/${slate}`, version: 'v1.2.3' }]
    });
    expect(response.body.items[0].status).toBe('published');
  });

  it('accepts identifiers without the leading @', async () => {
    let publisher = await createPublisher();
    let { slate } = await publishSlate(publisher);

    let response = await publicApi(publisher.token).post('/slates/version-lookup', {
      items: [{ identifier: `${publisher.scope}/${slate}`, version: '1.0.0' }]
    });
    expect(response.body.items[0].status).toBe('published');
  });

  it('validates the request body', async () => {
    let publisher = await createPublisher();
    let api = publicApi(publisher.token);

    expect((await api.post('/slates/version-lookup', {})).status).toBe(400);
    expect(
      (await api.post('/slates/version-lookup', { items: [{ identifier: 'a/b' }] })).status
    ).toBe(400);
    expect(
      (
        await api.post('/slates/version-lookup', {
          items: [{ identifier: 'a'.repeat(215), version: '1.0.0' }]
        })
      ).status
    ).toBe(400);
    expect(
      (
        await api.post('/slates/version-lookup', {
          items: Array.from({ length: 2001 }, () => ({ identifier: 'a/b', version: '1.0.0' }))
        })
      ).status
    ).toBe(400);
  });

  it('answers an empty lookup', async () => {
    let publisher = await createPublisher();
    let response = await publicApi(publisher.token).post('/slates/version-lookup', {
      items: []
    });
    expect(response.body).toEqual({ items: [] });
  });
});
