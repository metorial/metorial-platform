import { uniqueId } from '@lowerdeck/testing-tools';
import { describe, expect, it } from 'vitest';
import {
  createPublisher,
  createTenant,
  expectRpcError,
  listAll,
  publicApi,
  publishSlate,
  registryClient
} from './helpers';

let prebuilt = { supports_prebuilt: 'true' };

let createSubRegistry = async (tenant: { id: string }) =>
  registryClient.subRegistry.create({
    tenantId: tenant.id,
    identifier: uniqueId('sub'),
    name: 'E2E Sub Registry'
  });

describe('sub registry management E2E', () => {
  it('creates, gets and lists sub registries', async () => {
    let tenant = await createTenant();
    let sub = await createSubRegistry(tenant);

    expect(sub).toMatchObject({
      object: 'tenant.sub_registry',
      tenantId: tenant.id,
      filters: []
    });

    let fetched = await registryClient.subRegistry.get({
      tenantId: tenant.id,
      subRegistryId: sub.id
    });
    expect(fetched.id).toBe(sub.id);

    let listed = await registryClient.subRegistry.list({ tenantId: tenant.id });
    expect(listed.items.map(s => s.id)).toEqual([sub.id]);
  });

  it('rejects duplicate identifiers and cross-tenant access', async () => {
    let tenant = await createTenant();
    let outsider = await createTenant();
    let sub = await createSubRegistry(tenant);

    await expectRpcError(
      registryClient.subRegistry.create({
        tenantId: outsider.id,
        identifier: sub.identifier,
        name: 'Copy'
      }),
      'conflict'
    );
    await expectRpcError(
      registryClient.subRegistry.get({ tenantId: outsider.id, subRegistryId: sub.id }),
      'not_found'
    );
    await expectRpcError(
      registryClient.subRegistry.addFilter({
        tenantId: outsider.id,
        subRegistryId: sub.id,
        type: 'scope',
        value: 'x'
      }),
      'not_found'
    );
  });

  it('adds, lists, removes, sets and clears filters', async () => {
    let tenant = await createTenant();
    let sub = await createSubRegistry(tenant);
    let ids = { tenantId: tenant.id, subRegistryId: sub.id };

    let scope = await registryClient.subRegistry.addFilter({
      ...ids,
      type: 'scope',
      value: 'acme'
    });
    await registryClient.subRegistry.addFilter({ ...ids, type: 'prefix', value: 'acme/' });

    let listed = await registryClient.subRegistry.listFilters(ids);
    expect(listed.map(f => `${f.type}:${f.value}`)).toEqual(['scope:acme', 'prefix:acme/']);

    await registryClient.subRegistry.removeFilter({ ...ids, filterId: scope.id });
    expect(await registryClient.subRegistry.listFilters(ids)).toHaveLength(1);

    await expectRpcError(
      registryClient.subRegistry.removeFilter({ ...ids, filterId: scope.id }),
      'not_found'
    );

    let replaced = await registryClient.subRegistry.setFilters({
      ...ids,
      filters: [
        { type: 'package', value: 'acme/one' },
        { type: 'package', value: 'acme/two' }
      ]
    });
    expect(replaced.filters.map(f => f.value).sort()).toEqual(['acme/one', 'acme/two']);

    await registryClient.subRegistry.clearFilters(ids);
    expect(await registryClient.subRegistry.listFilters(ids)).toEqual([]);
  });

  it('rejects empty filter values', async () => {
    let tenant = await createTenant();
    let sub = await createSubRegistry(tenant);

    await expectRpcError(
      registryClient.subRegistry.addFilter({
        tenantId: tenant.id,
        subRegistryId: sub.id,
        type: 'scope',
        value: ''
      }),
      'bad_request'
    );
  });
});

describe('sub registry filtering E2E', () => {
  let setup = async () => {
    let first = await createPublisher();
    let second = await createPublisher(first.tenant);
    let a1 = (await publishSlate(first, { query: { access: 'public' } })).slate;
    let a2 = (await publishSlate(first, { query: { access: 'public' } })).slate;
    let b1 = (await publishSlate(second, { query: { access: 'public' } })).slate;
    let sub = await createSubRegistry(first.tenant);

    return { first, second, a1, a2, b1, sub };
  };

  let slatesVia = async (
    sub: { identifier: string },
    token: string | undefined,
    scopes: string[]
  ) => {
    let api = publicApi(token, { 'Metorial-Sub-Registry-Id': sub.identifier });
    let items = await listAll(api, '/slates', { scopeId: scopes.join(','), ...prebuilt });
    return items.map((s: any) => s.fullIdentifier).sort();
  };

  it('returns everything visible when no filters are set', async () => {
    let { first, second, a1, a2, b1, sub } = await setup();

    expect(await slatesVia(sub, first.token, [first.scope, second.scope])).toEqual(
      [`${first.scope}/${a1}`, `${first.scope}/${a2}`, `${second.scope}/${b1}`].sort()
    );
  });

  it('restricts by scope filters', async () => {
    let { first, second, a1, a2, sub } = await setup();
    await registryClient.subRegistry.addFilter({
      tenantId: first.tenant.id,
      subRegistryId: sub.id,
      type: 'scope',
      value: first.scope
    });

    expect(await slatesVia(sub, first.token, [first.scope, second.scope])).toEqual(
      [`${first.scope}/${a1}`, `${first.scope}/${a2}`].sort()
    );
  });

  it('restricts by package filters', async () => {
    let { first, second, a1, sub } = await setup();
    await registryClient.subRegistry.addFilter({
      tenantId: first.tenant.id,
      subRegistryId: sub.id,
      type: 'package',
      value: `${first.scope}/${a1}`
    });

    expect(await slatesVia(sub, first.token, [first.scope, second.scope])).toEqual([
      `${first.scope}/${a1}`
    ]);
  });

  it('restricts by prefix filters', async () => {
    let { first, second, b1, sub } = await setup();
    await registryClient.subRegistry.addFilter({
      tenantId: first.tenant.id,
      subRegistryId: sub.id,
      type: 'prefix',
      value: `${second.scope}/`
    });

    expect(await slatesVia(sub, first.token, [first.scope, second.scope])).toEqual([
      `${second.scope}/${b1}`
    ]);
  });

  it('unions multiple filters', async () => {
    let { first, second, a1, b1, sub } = await setup();
    await registryClient.subRegistry.setFilters({
      tenantId: first.tenant.id,
      subRegistryId: sub.id,
      filters: [
        { type: 'package', value: `${first.scope}/${a1}` },
        { type: 'scope', value: second.scope }
      ]
    });

    expect(await slatesVia(sub, first.token, [first.scope, second.scope])).toEqual(
      [`${first.scope}/${a1}`, `${second.scope}/${b1}`].sort()
    );
  });

  it('applies filters to direct lookups and change notifications', async () => {
    let { first, a1, a2, sub } = await setup();
    await registryClient.subRegistry.addFilter({
      tenantId: first.tenant.id,
      subRegistryId: sub.id,
      type: 'package',
      value: `${first.scope}/${a1}`
    });
    let api = publicApi(first.token, { 'Metorial-Sub-Registry-Id': sub.identifier });

    expect((await api.get(`/slates/${first.scope}/${a1}`, { query: prebuilt })).status).toBe(
      200
    );
    expect((await api.get(`/slates/${first.scope}/${a2}`, { query: prebuilt })).status).toBe(
      404
    );

    let notifications = await listAll(api, '/change-notifications', prebuilt);
    expect(
      notifications.every((n: any) => n.slate.fullIdentifier === `${first.scope}/${a1}`)
    ).toBe(true);
    expect(notifications.length).toBeGreaterThan(0);
  });

  it('reports the sub registry in /info', async () => {
    let { first, sub } = await setup();

    let info = await publicApi(first.token, { 'Metorial-Sub-Registry-Id': sub.identifier }).get(
      '/info'
    );
    expect(info.body.registry).toMatchObject({ id: sub.id, identifier: sub.identifier });
    expect(info.body.tenant).toMatchObject({ id: first.tenant.id });

    let altHeader = await publicApi(first.token, {
      'Slates-Sub-Registry-Id': sub.identifier
    }).get('/info');
    expect(altHeader.body.registry?.id).toBe(sub.id);
  });

  it('returns 404 for unknown sub registries', async () => {
    let response = await publicApi(undefined, {
      'Metorial-Sub-Registry-Id': uniqueId('missing')
    }).get('/info');
    expect(response.status).toBe(404);
  });

  it('rejects tokens of another tenant', async () => {
    let { sub } = await setup();
    let outsider = await createPublisher();

    let response = await publicApi(outsider.token, {
      'Metorial-Sub-Registry-Id': sub.identifier
    }).get('/info');
    expect(response.status).toBe(401);
  });

  it('lets reader tokens of the tenant read through the sub registry', async () => {
    let { first, a1, sub } = await setup();
    let reader = await registryClient.readerToken.create({
      tenantId: first.tenant.id,
      name: 'reader'
    });

    let response = await publicApi(reader.secret, {
      'Metorial-Sub-Registry-Id': sub.identifier
    }).get(`/slates/${first.scope}/${a1}`, { query: prebuilt });
    expect(response.status).toBe(200);
  });
});
