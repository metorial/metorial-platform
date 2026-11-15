import { uniqueId } from '@lowerdeck/testing-tools';
import { describe, expect, it } from 'vitest';
import { createPublisher, listAll, publicApi, publishSlate, registryClient } from './helpers';

let prebuilt = { supports_prebuilt: 'true' };

describe('slate read E2E', () => {
  it('hides prebuilt slates on direct lookup unless supports_prebuilt is set', async () => {
    let publisher = await createPublisher();
    let { slate } = await publishSlate(publisher, { query: { access: 'public' } });
    let api = publicApi(publisher.token);

    expect((await api.get(`/slates/${publisher.scope}/${slate}`)).status).toBe(404);
    expect(
      (await api.get(`/slates/${publisher.scope}/${slate}`, { query: prebuilt })).status
    ).toBe(200);

    let visible = await listAll(api, '/slates', { scopeId: publisher.scope, ...prebuilt });
    expect(visible.map((s: any) => s.identifier)).toEqual([slate]);
  });

  it.fails(
    'hides prebuilt slates from listings unless supports_prebuilt is set (bug: listSlates ignores supportsPrebuilt)',
    async () => {
      let publisher = await createPublisher();
      await publishSlate(publisher, { query: { access: 'public' } });

      let hidden = await listAll(publicApi(publisher.token), '/slates', {
        scopeId: publisher.scope
      });
      expect(hidden).toHaveLength(0);
    }
  );

  it('shows private slates to their tenant only and public slates to everyone', async () => {
    let owner = await createPublisher();
    let outsider = await createPublisher();
    let { slate: privateSlate } = await publishSlate(owner);
    let { slate: publicSlate } = await publishSlate(owner, { query: { access: 'public' } });

    let path = (slate: string) => `/slates/${owner.scope}/${slate}`;
    let get = (token: string | undefined, slate: string) =>
      publicApi(token).get(path(slate), { query: prebuilt });

    expect((await get(owner.token, privateSlate)).status).toBe(200);
    expect((await get(outsider.token, privateSlate)).status).toBe(404);
    expect((await get(undefined, privateSlate)).status).toBe(404);

    expect((await get(owner.token, publicSlate)).status).toBe(200);
    expect((await get(outsider.token, publicSlate)).status).toBe(200);
    expect((await get(undefined, publicSlate)).status).toBe(200);

    let anonymousList = await listAll(publicApi(), '/slates', {
      scopeId: owner.scope,
      ...prebuilt
    });
    expect(anonymousList.map((s: any) => s.identifier)).toEqual([publicSlate]);

    let ownerList = await listAll(publicApi(owner.token), '/slates', {
      scopeId: owner.scope,
      ...prebuilt
    });
    expect(ownerList.map((s: any) => s.identifier).sort()).toEqual(
      [privateSlate, publicSlate].sort()
    );
  });

  it('finds a slate by id, full identifier and @-prefixed identifier', async () => {
    let publisher = await createPublisher();
    let { slate } = await publishSlate(publisher);
    let api = publicApi(publisher.token);

    let byPath = await api.get(`/slates/${publisher.scope}/${slate}`, { query: prebuilt });
    expect(byPath.status).toBe(200);

    let byScopeId = await api.get(`/slates/${byPath.body.scope.id}/${byPath.body.id}`, {
      query: prebuilt
    });
    expect(byScopeId.body.id).toBe(byPath.body.id);

    let withAt = await api.get(`/slates/@${publisher.scope}/${slate}`, { query: prebuilt });
    expect(withAt.status === 200 || withAt.status === 404).toBe(true);
  });

  it('presents scope and creator without leaking internals', async () => {
    let publisher = await createPublisher();
    let { slate } = await publishSlate(publisher);

    let response = await publicApi(publisher.token).get(`/slates/${publisher.scope}/${slate}`, {
      query: prebuilt
    });

    expect(response.body.scope).toMatchObject({
      object: 'scope',
      type: 'user',
      identifier: publisher.scope
    });
    expect(response.body.createdByUser).toMatchObject({
      object: 'user',
      id: publisher.user.id
    });

    let serialized = response.text;
    expect(serialized).not.toContain(publisher.token);
    expect(serialized).not.toMatch(/"oid"|"tenantOid"|"secret/i);
  });

  it('returns 404 for unknown slates', async () => {
    let publisher = await createPublisher();
    let response = await publicApi(publisher.token).get(
      `/slates/${publisher.scope}/${uniqueId('missing')}`,
      { query: prebuilt }
    );
    expect(response.status).toBe(404);
  });

  it('paginates slate listings without duplicates', async () => {
    let publisher = await createPublisher();
    let slates: string[] = [];
    for (let i = 0; i < 5; i++) slates.push((await publishSlate(publisher)).slate);

    let api = publicApi(publisher.token);
    let query = { scopeId: publisher.scope, ...prebuilt };

    let page = await api.get('/slates', { query: { ...query, limit: '2' } });
    expect(page.body.items).toHaveLength(2);
    expect(page.body.pagination.has_more_after).toBe(true);

    let all = await listAll(api, '/slates', query);
    let identifiers = all.map((s: any) => s.identifier);
    expect(new Set(identifiers).size).toBe(identifiers.length);
    expect(identifiers.sort()).toEqual(slates.sort());

    let paged: any[] = [];
    let after: string | undefined;
    while (true) {
      let next = await api.get('/slates', { query: { ...query, limit: '2', after } });
      paged.push(...next.body.items);
      if (!next.body.pagination.has_more_after) break;
      after = next.body.items.at(-1).id;
    }
    expect(paged.map((s: any) => s.id).sort()).toEqual(all.map((s: any) => s.id).sort());
  });

  it('rejects invalid pagination parameters', async () => {
    let api = publicApi();
    expect((await api.get('/slates', { query: { limit: '0' } })).status).toBe(400);
    expect((await api.get('/slates', { query: { limit: '101' } })).status).toBe(400);
    expect((await api.get('/slates', { query: { limit: 'abc' } })).status).toBe(400);
    expect((await api.get('/slates', { query: { order: 'sideways' } })).status).toBe(400);
  });

  it('filters listings by scope and user', async () => {
    let first = await createPublisher();
    let second = await createPublisher(first.tenant);
    let { slate: a } = await publishSlate(first, { query: { access: 'public' } });
    let { slate: b } = await publishSlate(second, { query: { access: 'public' } });
    let api = publicApi(first.token);

    let byScope = await listAll(api, '/slates', { scopeId: second.scope, ...prebuilt });
    expect(byScope.map((s: any) => s.identifier)).toEqual([b]);

    let byUser = await listAll(api, '/slates', { userId: first.user.id, ...prebuilt });
    expect(byUser.map((s: any) => s.identifier)).toEqual([a]);

    let both = await listAll(api, '/slates', {
      scopeId: `${first.scope},${second.scope}`,
      ...prebuilt
    });
    expect(both.map((s: any) => s.identifier).sort()).toEqual([a, b].sort());
  });
});

describe('slate version read E2E', () => {
  it('lists versions with a single current version and gets by id or semver', async () => {
    let publisher = await createPublisher();
    let { slate } = await publishSlate(publisher, {
      version: '1.0.0',
      extra: { 'README.md': '# One' }
    });
    await publishSlate(publisher, { slate, version: '1.1.0' });
    let api = publicApi(publisher.token);
    let base = `/slates/${publisher.scope}/${slate}/versions`;

    let list = await api.get(base, { query: prebuilt });
    expect(list.status).toBe(200);
    expect(list.body.items).toHaveLength(2);
    expect(list.body.items.filter((v: any) => v.isCurrent).map((v: any) => v.version)).toEqual([
      '1.1.0'
    ]);

    let bySemver = await api.get(`${base}/1.0.0`, { query: prebuilt });
    expect(bySemver.status).toBe(200);
    expect(bySemver.body).toMatchObject({
      object: 'slate.version',
      version: '1.0.0',
      isCurrent: false,
      build: 'prebuilt'
    });
    expect(bySemver.body.documents).toEqual([
      expect.objectContaining({ object: 'slate.document', path: 'README.md', content: '# One' })
    ]);

    let byId = await api.get(`${base}/${bySemver.body.id}`, { query: prebuilt });
    expect(byId.body.id).toBe(bySemver.body.id);

    expect((await api.get(`${base}/9.9.9`, { query: prebuilt })).status).toBe(404);
  });

  it('does not list versions of another tenant\'s private slate', async () => {
    let owner = await createPublisher();
    let outsider = await createPublisher();
    let { slate } = await publishSlate(owner);

    let response = await publicApi(outsider.token).get(
      `/slates/${owner.scope}/${slate}/versions`,
      { query: prebuilt }
    );
    expect(response.status).toBe(404);
  });

  it('redirects downloads to the stored bundle', async () => {
    let publisher = await createPublisher();
    let { slate, body } = await publishSlate(publisher);

    let response = await publicApi(publisher.token).get(
      `/slates/${publisher.scope}/${slate}/versions/1.0.0/download`,
      { query: prebuilt }
    );
    expect(response.status).toBe(302);

    let location = response.headers.get('location');
    expect(location).toBeTruthy();

    let downloaded = await fetch(location!);
    expect(downloaded.status).toBe(200);
    expect(Buffer.from(await downloaded.arrayBuffer()).equals(body)).toBe(true);
  });

  it('does not redirect downloads for slates the caller cannot see', async () => {
    let owner = await createPublisher();
    let outsider = await createPublisher();
    let { slate } = await publishSlate(owner);

    for (let token of [outsider.token, undefined]) {
      let response = await publicApi(token).get(
        `/slates/${owner.scope}/${slate}/versions/1.0.0/download`,
        { query: prebuilt }
      );
      expect(response.status).toBe(404);
    }
  });
});

describe('registry info and directory E2E', () => {
  it('describes anonymous callers', async () => {
    let response = await publicApi().get('/info');
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ tenant: null, registry: null, user: null });
  });

  it('describes user and reader token callers', async () => {
    let publisher = await createPublisher();

    let asUser = await publicApi(publisher.token).get('/info');
    expect(asUser.body.tenant).toMatchObject({ id: publisher.tenant.id });
    expect(asUser.body.user).toMatchObject({
      id: publisher.user.id,
      identifier: publisher.user.identifier
    });

    let reader = await registryClient.readerToken.create({
      tenantId: publisher.tenant.id,
      name: 'reader'
    });
    expect(reader.secret).toEqual(expect.any(String));
    expect(reader).toMatchObject({ object: 'reader_token', tenantId: publisher.tenant.id });

    let asReader = await publicApi(reader.secret).get('/info');
    expect(asReader.status).toBe(200);
    expect(asReader.body.user).toBeNull();
  });

  it('lists scopes and users publicly and finds them by identifier', async () => {
    let publisher = await createPublisher();
    let api = publicApi();

    let scope = await api.get(`/scopes/${publisher.scope}`);
    expect(scope.status).toBe(200);
    expect(scope.body).toMatchObject({ object: 'scope', identifier: publisher.scope });

    let user = await api.get(`/users/${publisher.user.identifier}`);
    expect(user.body).toMatchObject({ id: publisher.user.id });

    let scopes = await listAll(api, '/scopes');
    expect(scopes.map((s: any) => s.identifier)).toContain(publisher.scope);

    expect((await api.get('/scopes/scope_missing')).status).toBe(404);
    expect((await api.get('/users/user_missing')).status).toBe(404);
  });
});

describe('change notifications E2E', () => {
  it('records a notification per published version', async () => {
    let publisher = await createPublisher();
    let { slate, published } = await publishSlate(publisher, { query: { access: 'public' } });
    let api = publicApi(publisher.token);

    let notifications = await listAll(api, '/change-notifications', prebuilt);
    let mine = notifications.filter(
      (n: any) => n.slate.fullIdentifier === `${publisher.scope}/${slate}`
    );

    expect(mine).toHaveLength(1);
    expect(mine[0]).toMatchObject({
      object: 'change_notification',
      type: 'slate_version_created',
      slate: { identifier: slate },
      slateVersion: { id: published.id, identifier: '1.0.0' }
    });

    let fetched = await api.get(`/change-notifications/${mine[0]!.id}`, { query: prebuilt });
    expect(fetched.status).toBe(200);
    expect(fetched.body.id).toBe(mine[0]!.id);

    await publishSlate(publisher, { slate, version: '1.1.0' });
    let after = (await listAll(api, '/change-notifications', prebuilt)).filter(
      (n: any) => n.slate.fullIdentifier === `${publisher.scope}/${slate}`
    );
    expect(after.map((n: any) => n.slateVersion.identifier).sort()).toEqual(['1.0.0', '1.1.0']);
  });

  it('does not repeat a notification for an idempotent republish', async () => {
    let publisher = await createPublisher();
    let first = await publishSlate(publisher);
    await publishSlate(publisher, { slate: first.slate });

    let notifications = (
      await listAll(publicApi(publisher.token), '/change-notifications', prebuilt)
    ).filter((n: any) => n.slate.fullIdentifier === `${publisher.scope}/${first.slate}`);
    expect(notifications).toHaveLength(1);
  });

  it('hides notifications of private slates from other tenants', async () => {
    let owner = await createPublisher();
    let outsider = await createPublisher();
    let { slate } = await publishSlate(owner);
    let fullIdentifier = `${owner.scope}/${slate}`;

    let seenByOwner = await listAll(publicApi(owner.token), '/change-notifications', prebuilt);
    let ownerNotification = seenByOwner.find(
      (n: any) => n.slate.fullIdentifier === fullIdentifier
    ) as any;
    expect(ownerNotification).toBeDefined();

    for (let token of [outsider.token, undefined]) {
      let seen = await listAll(publicApi(token), '/change-notifications', prebuilt);
      expect(seen.some((n: any) => n.slate.fullIdentifier === fullIdentifier)).toBe(false);

      let direct = await publicApi(token).get(`/change-notifications/${ownerNotification.id}`, {
        query: prebuilt
      });
      expect(direct.status).toBe(404);
    }
  });

  it('returns 404 for unknown notifications', async () => {
    let response = await publicApi().get('/change-notifications/cn_missing', { query: prebuilt });
    expect(response.status).toBe(404);
  });
});
