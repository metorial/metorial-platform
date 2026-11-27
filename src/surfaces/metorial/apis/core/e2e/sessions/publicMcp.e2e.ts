import {
  API_VERSIONS,
  createRemoteProvider,
  expectAuthMatrix,
  expectError,
  expectOk,
  expectPresented,
  listAll,
  uniqueId,
  useMcpTestServer,
  useOrganization
} from '@metorial/e2e';
import { beforeAll, describe, expect, it } from 'vitest';
import { createProviderDeployment, crossTenantClients, ids, instancePathFor } from './_shared';

describe('api-core sessions: public MCP servers', () => {
  let org = useOrganization();
  let otherOrg = useOrganization();
  let server = useMcpTestServer();

  let providerId: string;
  let deployment: any;
  let secondDeployment: any;
  let otherDeployment: any;

  beforeAll(async () => {
    ({ providerId } = await createRemoteProvider(org.clients.instance, { url: server.url }));
    let otherProvider = await createRemoteProvider(otherOrg.clients.instance, {
      url: server.url
    });

    deployment = await createProviderDeployment(org.clients.instance, providerId);
    secondDeployment = await createProviderDeployment(org.clients.instance, providerId);
    otherDeployment = await createProviderDeployment(
      otherOrg.clients.instance,
      otherProvider.providerId
    );
  }, 180_000);

  let client = () => org.clients.instance.with({ version: API_VERSIONS.dashboard });
  let otherClient = () => otherOrg.clients.instance.with({ version: API_VERSIONS.dashboard });

  let uniqueSlug = () => uniqueId('e2e-public');

  let createServer = async (body: Record<string, unknown> = {}) =>
    expectOk(
      await client().post('/public-mcp-servers', {
        provider_deployment_id: deployment.id,
        name: uniqueId('Public MCP'),
        slug: uniqueSlug(),
        ...body
      })
    );

  let slugAvailability = async (slug: string) =>
    expectOk(await client().get('/public-mcp-server-slugs/availability', { query: { slug } }));

  it('authenticates public MCP routes per credential and API version', async () => {
    let publicServer = await createServer();
    let clients = {
      ...crossTenantClients(org, otherOrg),
      dashboardInstance: client()
    };

    let responses = await expectAuthMatrix(
      clients,
      (rest, name) =>
        rest.get(instancePathFor(org, name, `/public-mcp-servers/${publicServer.id}`)),
      {
        none: 401,
        session: 200,
        management: 200,
        dashboardInstance: 200,
        instance: 404,
        otherSession: 404,
        otherManagement: 404
      }
    );
    expect(responses.session.body.id).toBe(publicServer.id);

    await expectAuthMatrix(
      { ...clients, otherDashboardInstance: otherClient() },
      (rest, name) => rest.get(instancePathFor(org, name, '/public-mcp-servers')),
      {
        none: 401,
        session: 200,
        management: 200,
        dashboardInstance: 200,
        instance: 404,
        otherDashboardInstance: 200
      }
    );
  });

  it('runs the public MCP server lifecycle', async () => {
    let slug = uniqueSlug();
    let created = await createServer({
      slug: `  ${slug.toUpperCase()} `,
      description: '  Created by e2e  ',
      metadata: { env: 'e2e' },
      redirect_uri_filters: ['https://claude.ai/*'],
      max_active_grants: 10,
      access_token_ttl_seconds: 3600
    });
    expectPresented(created, 'provider.public_mcp_server');
    expect(created).toMatchObject({
      status: 'active',
      slug,
      description: 'Created by e2e',
      metadata: { env: 'e2e' },
      provider_id: providerId,
      deployment: { id: deployment.id },
      redirect_uri_filters: ['https://claude.ai/*'],
      max_active_grants: 10,
      access_token_ttl_seconds: 3600,
      disabled_at: null,
      archived_at: null
    });
    expect(created.connect_url).toContain(slug);
    expect((await slugAvailability(slug)).is_available).toBe(false);

    let fetched = expectOk(await client().get(`/public-mcp-servers/${created.id}`));
    expect(fetched.slug).toBe(slug);

    let disabled = expectOk(
      await client().patch(`/public-mcp-servers/${created.id}`, {
        status: 'disabled',
        description: null,
        max_active_grants: null
      })
    );
    expect(disabled.status).toBe('disabled');
    expect(disabled.disabled_at).toEqual(expect.any(String));
    expect(disabled.description).toBeNull();
    expect(disabled.max_active_grants).toBeNull();

    let disabledList = await listAll(client(), '/public-mcp-servers', {
      query: { status: 'disabled' }
    });
    expect(ids(disabledList)).toContain(created.id);

    let renamedSlug = uniqueSlug();
    let renamed = expectOk(
      await client().patch(`/public-mcp-servers/${created.id}`, {
        status: 'active',
        slug: renamedSlug,
        name: 'Renamed public MCP'
      })
    );
    expect(renamed).toMatchObject({
      status: 'active',
      slug: renamedSlug,
      name: 'Renamed public MCP',
      disabled_at: null
    });
    expect((await slugAvailability(slug)).is_available).toBe(true);
    expect((await slugAvailability(renamedSlug)).is_available).toBe(false);

    let archived = expectOk(await client().delete(`/public-mcp-servers/${created.id}`));
    expect(archived.status).toBe('archived');
    expect(archived.archived_at).toEqual(expect.any(String));

    expectError(
      await client().patch(`/public-mcp-servers/${created.id}`, { name: 'Too late' }),
      410,
      'gone'
    );
    expectError(await client().delete(`/public-mcp-servers/${created.id}`), 410, 'gone');

    let active = await listAll(client(), '/public-mcp-servers');
    expect(ids(active)).not.toContain(created.id);

    expect((await slugAvailability(renamedSlug)).is_available).toBe(false);
    expectError(
      await client().post('/public-mcp-servers', {
        provider_deployment_id: deployment.id,
        name: uniqueId('Public MCP'),
        slug: renamedSlug
      }),
      409,
      'public_mcp_slug_taken'
    );
  });

  it('claims slugs globally', async () => {
    let slug = uniqueSlug();
    let availability = await slugAvailability(` ${slug.toUpperCase()}`);
    expectPresented(availability, 'provider.public_mcp_server.slug_availability');
    expect(availability).toMatchObject({ slug, is_available: true });

    let first = await createServer({ slug });

    expectError(
      await client().post('/public-mcp-servers', {
        provider_deployment_id: secondDeployment.id,
        name: 'Duplicate slug',
        slug
      }),
      409,
      'public_mcp_slug_taken'
    );
    expectError(
      await otherClient().post('/public-mcp-servers', {
        provider_deployment_id: otherDeployment.id,
        name: 'Duplicate slug',
        slug
      }),
      409,
      'public_mcp_slug_taken'
    );
    expect(
      expectOk(
        await otherClient().get('/public-mcp-server-slugs/availability', { query: { slug } })
      ).is_available
    ).toBe(false);

    let second = await createServer();
    expectError(
      await client().patch(`/public-mcp-servers/${second.id}`, { slug }),
      409,
      'public_mcp_slug_taken'
    );
    expect(expectOk(await client().get(`/public-mcp-servers/${first.id}`)).slug).toBe(slug);
  });

  it('validates public MCP server bodies, slugs and settings', async () => {
    let valid = {
      provider_deployment_id: deployment.id,
      name: 'Valid',
      slug: uniqueSlug()
    };
    let post = (body: unknown) => client().post('/public-mcp-servers', body);

    for (let body of [
      {},
      { ...valid, provider_deployment_id: undefined },
      { ...valid, name: undefined },
      { ...valid, slug: undefined },
      { ...valid, name: 42 },
      { ...valid, metadata: 'x' },
      { ...valid, redirect_uri_filters: 'https://claude.ai/*' },
      { ...valid, max_active_grants: 'many' },
      { ...valid, tool_filters: { type: 'unknown' } }
    ]) {
      expectError(await post(body), 400, 'invalid_data');
    }

    for (let slug of [
      'ab',
      'Has Spaces',
      'double--dash',
      '-leading',
      'admin',
      'x'.repeat(49)
    ]) {
      expectError(await post({ ...valid, slug }), 400, 'invalid_public_mcp_slug');
      expectError(
        await client().get('/public-mcp-server-slugs/availability', { query: { slug } }),
        400,
        'invalid_public_mcp_slug'
      );
    }
    expectError(
      await client().get('/public-mcp-server-slugs/availability'),
      400,
      'invalid_data'
    );

    for (let settings of [
      { access_token_ttl_seconds: 60 },
      { refresh_token_ttl_seconds: 60 },
      { grant_idle_expiry_seconds: 60 },
      { max_active_grants: 0 },
      { access_token_ttl_seconds: 3600.5 }
    ]) {
      expectError(await post({ ...valid, ...settings }), 400, 'bad_request');
    }
    expectError(await post({ ...valid, name: '   ' }), 400, 'bad_request');

    let created = await createServer();
    let patch = (body: unknown) => client().patch(`/public-mcp-servers/${created.id}`, body);
    expectError(await patch({ status: 'archived' }), 400, 'invalid_data');
    expectError(await patch({ name: 42 }), 400, 'invalid_data');
    expectError(await patch({ name: '' }), 400, 'bad_request');
    expectError(await patch({ slug: 'NOT VALID' }), 400, 'invalid_public_mcp_slug');

    let missingDeployment = expectError(
      await post({ ...valid, provider_deployment_id: uniqueId('pdp') }),
      404,
      'not_found'
    );
    expect(missingDeployment.entity).toBe('provider.deployment');

    for (let query of [{ status: 'deleted' }, { limit: 0 }]) {
      expectError(await client().get('/public-mcp-servers', { query }), 400, 'invalid_data');
    }
  });

  it('lists grants and clients of a server', async () => {
    let created = await createServer();

    let grants = expectOk(await client().get(`/public-mcp-servers/${created.id}/grants`));
    expect(grants.items).toEqual([]);
    let clients = expectOk(await client().get(`/public-mcp-servers/${created.id}/clients`));
    expect(clients.items).toEqual([]);

    let grantId = uniqueId('pmgr');
    expectError(
      await client().get(`/public-mcp-servers/${created.id}/grants/${grantId}`),
      404,
      'not_found'
    );
    expectError(
      await client().post(`/public-mcp-servers/${created.id}/grants/${grantId}/revoke`),
      404,
      'not_found'
    );
    expectError(
      await client().get(`/public-mcp-servers/${created.id}/grants`, {
        query: { status: 'unknown' }
      }),
      400,
      'invalid_data'
    );
  });

  it('pages through and filters public MCP servers', async () => {
    let created = [
      await createServer(),
      await createServer(),
      await createServer({ provider_deployment_id: secondDeployment.id })
    ];

    let paged = await listAll(client(), '/public-mcp-servers', { limit: 1 });
    expect(new Set(ids(paged)).size).toBe(paged.length);
    expect(ids(paged)).toEqual(expect.arrayContaining(ids(created)));

    let byDeployment = await listAll(client(), '/public-mcp-servers', {
      query: { provider_deployment_id: secondDeployment.id }
    });
    expect(ids(byDeployment)).toEqual([created[2].id]);

    let byId = await listAll(client(), '/public-mcp-servers', {
      query: { id: created[0].id }
    });
    expect(ids(byId)).toEqual([created[0].id]);
  });

  it('hides public MCP servers from other organizations', async () => {
    let created = await createServer();
    let other = otherClient();

    for (let response of [
      await other.get(`/public-mcp-servers/${created.id}`),
      await other.patch(`/public-mcp-servers/${created.id}`, { name: 'x' }),
      await other.delete(`/public-mcp-servers/${created.id}`),
      await other.get(`/public-mcp-servers/${created.id}/grants`),
      await other.get(`/public-mcp-servers/${created.id}/clients`)
    ]) {
      expectError(response, 404, 'not_found');
    }

    expect(ids(await listAll(other, '/public-mcp-servers'))).not.toContain(created.id);

    let foreign = expectError(
      await client().post('/public-mcp-servers', {
        provider_deployment_id: otherDeployment.id,
        name: 'Foreign deployment',
        slug: uniqueSlug()
      }),
      404,
      'not_found'
    );
    expect(foreign.entity).toBe('provider.deployment');

    expect(expectOk(await client().get(`/public-mcp-servers/${created.id}`)).status).toBe(
      'active'
    );
  });
});
