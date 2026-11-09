import { uniqueId } from '@lowerdeck/testing-tools';
import { describe, expect, it } from 'vitest';
import { db } from '../src/db';
import { ares } from './client';
import { createApp, expectRpcStatus, REDIRECT_URL } from './fixtures';

describe('ares app', () => {
  it('creates an app with defaults and persists it', async () => {
    let slug = uniqueId('app').toLowerCase();
    let app = await ares.app.create({ defaultRedirectUrl: REDIRECT_URL, slug });

    expect(app).toMatchObject({
      object: 'ares#app',
      slug,
      mode: 'standard',
      isSessionless: false,
      disableEmailAuth: false,
      defaultRedirectUrl: REDIRECT_URL,
      redirectDomains: []
    });
    expect(app.clientId).toBeTruthy();

    let row = await db.app.findUniqueOrThrow({ where: { id: app.id } });
    expect(row.slug).toBe(slug);
    expect(row.clientId).toBe(app.clientId);
  });

  it('normalizes redirect domains', async () => {
    let app = await createApp({ redirectDomains: ['  Example.COM ', '*.Sub.Example.com'] });
    expect(app.redirectDomains).toEqual(['example.com', '*.sub.example.com']);
  });

  it.each(['', 'http://example.com', 'a*b.com', '*.'])(
    'rejects the invalid redirect domain %j',
    async domain => {
      await expectRpcStatus(createApp({ redirectDomains: [domain] }), 400);
    }
  );

  it.fails(
    'rejects a duplicate slug with a client error (bug: unique violation surfaces as HTTP 500)',
    async () => {
      let app = await createApp();
      await expectRpcStatus(createApp({ slug: app.slug! }), 409);
    }
  );

  it('gets an app by id and rejects unknown ids', async () => {
    let app = await createApp();

    let fetched = await ares.app.get({ id: app.id });
    expect(fetched).toMatchObject({ id: app.id, clientId: app.clientId, slug: app.slug });

    await expectRpcStatus(ares.app.get({ id: 'app_missing' }), 404);
  });

  it('updates only the provided fields', async () => {
    let app = await createApp();

    let updated = await ares.app.update({
      id: app.id,
      isSessionless: true,
      disableEmailAuth: true,
      redirectDomains: ['other.example.org']
    });

    expect(updated).toMatchObject({
      id: app.id,
      slug: app.slug,
      defaultRedirectUrl: REDIRECT_URL,
      isSessionless: true,
      disableEmailAuth: true,
      redirectDomains: ['other.example.org']
    });

    let row = await db.app.findUniqueOrThrow({ where: { id: app.id } });
    expect(row.isSessionless).toBe(true);
    expect(row.disableEmailAuth).toBe(true);
  });

  it('rejects updating an unknown app', async () => {
    await expectRpcStatus(ares.app.update({ id: 'app_missing', isSessionless: true }), 404);
  });

  it('upserts an app by slug without duplicating it', async () => {
    let slug = uniqueId('app').toLowerCase();

    let created = await ares.app.upsert({ slug, defaultRedirectUrl: REDIRECT_URL });
    let updated = await ares.app.upsert({
      slug,
      defaultRedirectUrl: 'https://other.example.com/callback',
      disableEmailAuth: true
    });

    expect(updated).toMatchObject({
      id: created.id,
      clientId: created.clientId,
      defaultRedirectUrl: 'https://other.example.com/callback',
      disableEmailAuth: true
    });
    expect(await db.app.count({ where: { slug } })).toBe(1);
  });

  it('moves horizon mode to the most recently flagged app', async () => {
    let first = await createApp({ mode: 'horizon' });
    let second = await createApp({ mode: 'horizon' });

    expect((await ares.app.get({ id: first.id })).mode).toBe('standard');
    expect((await ares.app.get({ id: second.id })).mode).toBe('horizon');
  });

  it('pages through apps without duplicates', async () => {
    let created = await Promise.all([createApp(), createApp(), createApp()]);

    let seen: string[] = [];
    let after: string | undefined;

    for (let page = 0; page < 500; page++) {
      let result = await ares.app.list({ limit: 50, after });
      seen.push(...result.items.map(i => i.id));
      if (!result.pagination.has_more_after) break;
      after = result.items[result.items.length - 1]!.id;
    }

    expect(new Set(seen).size).toBe(seen.length);
    expect(seen).toEqual(expect.arrayContaining(created.map(c => c.id)));
  });
});
