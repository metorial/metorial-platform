import {
  authClients,
  eventually,
  expectAuthMatrix,
  expectError,
  expectOk,
  expectPresented,
  listAll,
  metorialEndpoints,
  rest,
  testContext,
  uniqueId,
  useOrganization
} from '@metorial/e2e';
import { db, loadOrganizationFixture } from '@metorial/e2e/db';
import {
  oauthApplicationService,
  oauthAuthorizationService
} from '@metorial/module-machine-access';
import { describe, expect, it } from 'vitest';

describe('api-core management: oauth', () => {
  let org = useOrganization();
  let otherOrg = useOrganization();

  let dashboardPath = (path: string) =>
    `/dashboard/organizations/${org.ids.organizationId}${path}`;

  let createApplication = async (body: Record<string, unknown> = {}) =>
    expectOk(
      await org.clients.management.post('/organization/oauth/apps', {
        access_level: 'organization',
        name: uniqueId('rest-oauth-app'),
        description: 'REST application',
        redirect_uris: ['https://example.com/callback'],
        scopes: ['organization:read'],
        ...body
      })
    );

  let randomIp = () =>
    `10.${[0, 0, 0].map(() => Math.floor(Math.random() * 250) + 1).join('.')}`;

  let issueCliToken = async () => {
    if (!(await oauthApplicationService.getCliAuthOAuthApplication())) {
      await oauthApplicationService.upsertCliAuthOAuthApplication();
    }

    let fixture = await loadOrganizationFixture(org.ids);
    let ip = randomIp();
    let issued = await oauthAuthorizationService.issueCliAuthTokenForMember({
      organization: fixture.organization,
      member: fixture.member,
      context: { ip, ua: 'metorial-e2e-cli' }
    });

    return { ip, ...issued };
  };

  it('authenticates oauth routes per credential', async () => {
    let clients = authClients(org, {
      instanceDashboardVersion: rest(metorialEndpoints().api, {
        apiKey: org.keys.instanceSecret
      }),
      otherSession: rest(metorialEndpoints().api, { session: otherOrg.session })
    });
    let isDashboard = (name: string) => name === 'session' || name === 'otherSession';

    for (let path of [
      '/oauth/apps',
      '/oauth/scopes',
      '/oauth/installations',
      '/oauth/authorizations',
      '/oauth/authorization-logs',
      '/oauth/cli-devices'
    ]) {
      await expectAuthMatrix(
        clients,
        (client, name) =>
          client.get(isDashboard(name) ? dashboardPath(path) : `/organization${path}`),
        {
          none: 401,
          session: 200,
          management: 200,
          instance: 404,
          instanceDashboardVersion: 403,
          otherSession: [403, 404]
        }
      );
    }
  });

  it('runs the oauth application lifecycle with the presenter shape', async () => {
    let created = await createApplication({
      website_url: 'https://example.com',
      redirect_uris: ['https://example.com/callback', 'http://localhost:3000/callback']
    });
    expectPresented(created, 'machine_access.oauth_application');
    expect(created).toMatchObject({
      status: 'active',
      type: 'user_facing',
      access_level: 'organization',
      subject_type: 'organization_member',
      allow_token_exchange_without_client_secret: false,
      website_url: 'https://example.com',
      redirect_uris: ['https://example.com/callback', 'http://localhost:3000/callback'],
      organization_id: org.ids.organizationId,
      client_secrets: []
    });
    expect(created.client_id).toMatch(/^mt_oauth_/);
    expect(created.scopes.map((scope: any) => scope.identifier)).toEqual([
      'organization:read'
    ]);

    let path = `/organization/oauth/apps/${created.id}`;
    let fetched = expectOk(
      await org.clients.rest.get(dashboardPath(`/oauth/apps/${created.id}`))
    );
    expect(fetched.client_id).toBe(created.client_id);

    let name = uniqueId('renamed-oauth-app');
    let updated = expectOk(
      await org.clients.management.patch(path, {
        name,
        description: null,
        website_url: null,
        allow_token_exchange_without_client_secret: true,
        scopes: ['organization:read', 'organization.member:read']
      })
    );
    expect(updated).toMatchObject({
      name,
      description: null,
      website_url: null,
      allow_token_exchange_without_client_secret: true
    });
    expect(updated.scopes.map((scope: any) => scope.identifier).sort()).toEqual([
      'organization.member:read',
      'organization:read'
    ]);

    let clientSecret = expectOk(await org.clients.management.post(`${path}/client-secrets`));
    expectPresented(clientSecret, 'machine_access.oauth_application_client_secret');
    expect(clientSecret.secret).toMatch(/^mt_oauth_secret/);
    expect(expectOk(await org.clients.management.get(path)).client_secrets).toEqual([
      expect.objectContaining({ id: clientSecret.id, secret: null })
    ]);
    let deletedSecret = expectOk(
      await org.clients.management.delete(`${path}/client-secrets/${clientSecret.id}`)
    );
    expect(deletedSecret.deleted_at).toEqual(expect.any(String));
    expectError(
      await org.clients.management.delete(`${path}/client-secrets/${clientSecret.id}`),
      404,
      'not_found'
    );

    let archived = expectOk(await org.clients.management.delete(path));
    expect(archived.status).toBe('archived');
    expectError(await org.clients.management.patch(path, { name: 'x' }), 403, 'forbidden');
    expectError(await org.clients.management.post(`${path}/client-secrets`), 403, 'forbidden');
    expectError(await org.clients.management.delete(path), 403, 'forbidden');

    let active = await listAll(org.clients.management, '/organization/oauth/apps');
    expect(active.map(item => item.id)).not.toContain(created.id);
    let archivedList = await listAll(org.clients.management, '/organization/oauth/apps', {
      query: { status: 'archived' }
    });
    expect(archivedList.map(item => item.id)).toContain(created.id);
  });

  it('validates oauth application bodies and queries', async () => {
    let create = (body: Record<string, unknown>) =>
      org.clients.management.post('/organization/oauth/apps', {
        access_level: 'organization',
        name: uniqueId('invalid-oauth-app'),
        scopes: ['organization:read'],
        ...body
      });

    expectError(await create({ access_level: 'global' }), 400, 'invalid_data');
    expectError(await create({ scopes: undefined }), 400, 'invalid_data');
    expectError(await create({ subject_type: 'robot' }), 400, 'invalid_data');
    expectError(await create({ scopes: ['organization:fly'] }), 400, 'bad_request');
    expectError(
      await create({ redirect_uris: ['http://example.com/callback'] }),
      400,
      'bad_request'
    );
    expectError(await create({ redirect_uris: ['not a uri'] }), 400, 'bad_request');

    expectError(
      await org.clients.management.get('/organization/oauth/apps', {
        query: { subject_type: 'robot' }
      }),
      400,
      'invalid_data'
    );
    expectError(
      await org.clients.management.get('/organization/oauth/scopes', {
        query: { subject_type: 'robot' }
      }),
      400,
      'invalid_data'
    );
  });

  it('filters and pages oauth applications', async () => {
    let created = [await createApplication(), await createApplication()];
    let consumer = await createApplication({
      subject_type: 'consumer',
      scopes: ['consumer#organization:read']
    });
    expect(consumer.subject_type).toBe('consumer');

    let listed = await listAll(org.clients.management, '/organization/oauth/apps', {
      limit: 1
    });
    let ids = listed.map(item => item.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toEqual(expect.arrayContaining([...created, consumer].map(item => item.id)));

    let consumers = await listAll(org.clients.management, '/organization/oauth/apps', {
      query: { subject_type: 'consumer' }
    });
    expect(consumers.map(item => item.id)).toContain(consumer.id);
    expect(consumers.every(item => item.subject_type === 'consumer')).toBe(true);
  });

  it('hides service account applications from the oauth application routes', async () => {
    let serviceAccount = expectOk(
      await org.clients.management.post('/organization/service-accounts', {
        name: uniqueId('backing-app'),
        scopes: ['organization:read']
      })
    );
    let { oauthApplication } = await db.serviceAccount.findUniqueOrThrow({
      where: { id: serviceAccount.id },
      include: { oauthApplication: true }
    });
    let path = `/organization/oauth/apps/${oauthApplication.id}`;

    expectError(await org.clients.management.get(path), 404, 'not_found');
    expectError(await org.clients.management.patch(path, { name: 'x' }), 404, 'not_found');
    expectError(await org.clients.management.delete(path), 404, 'not_found');
    expectError(await org.clients.management.post(`${path}/client-secrets`), 404, 'not_found');

    let listed = await listAll(org.clients.management, '/organization/oauth/apps');
    expect(listed.map(item => item.id)).not.toContain(oauthApplication.id);
    expect(
      expectOk(
        await org.clients.management.get(`/organization/service-accounts/${serviceAccount.id}`)
      ).status
    ).toBe('active');
  });

  it('lists the oauth scopes per subject type', async () => {
    let member = expectOk(await org.clients.management.get('/organization/oauth/scopes'));
    expectPresented(member, 'management.oauth.scopes');
    let memberScopes = member.permissions.map((permission: any) => permission.identifier);
    expect(memberScopes).toContain('organization:read');
    expect(memberScopes.some((scope: string) => scope.startsWith('consumer#'))).toBe(false);

    let consumer = expectOk(
      await org.clients.management.get('/organization/oauth/scopes', {
        query: { subject_type: 'consumer' }
      })
    );
    let consumerScopes = consumer.permissions.map((permission: any) => permission.identifier);
    expect(consumerScopes).toContain('consumer#organization:read');
    expect(consumerScopes).not.toContain('organization:read');
  });

  it('revokes the scoped installation of an application', async () => {
    let application = await createApplication();

    let [installation, ...rest_] = await listAll(
      org.clients.management,
      '/organization/oauth/installations',
      { query: { app_id: application.id } }
    );
    expect(rest_).toEqual([]);
    expectPresented(installation, 'machine_access.oauth_installation');
    expect(installation).toMatchObject({
      status: 'active',
      organization_id: org.ids.organizationId,
      server_side_machine_access: null
    });
    expect(installation.oauth_application.id).toBe(application.id);
    expect(installation.oauth_application.client_secrets).toEqual([]);

    let path = `/organization/oauth/installations/${installation.id}`;
    expect(expectOk(await org.clients.management.get(path)).id).toBe(installation.id);
    expectError(await otherOrg.clients.management.get(path), 404, 'not_found');
    expectError(await otherOrg.clients.management.post(`${path}/revoke`), 404, 'not_found');

    let revoked = expectOk(await org.clients.management.post(`${path}/revoke`));
    expect(revoked.status).toBe('revoked');
    expect(revoked.revoked_at).toEqual(expect.any(String));

    let revokedList = await listAll(
      org.clients.management,
      '/organization/oauth/installations',
      {
        query: { app_id: application.id, status: 'revoked' }
      }
    );
    expect(revokedList.map(item => item.id)).toEqual([installation.id]);
    expect(
      await listAll(org.clients.management, '/organization/oauth/installations', {
        query: { app_id: application.id, status: 'active' }
      })
    ).toEqual([]);
  });

  it('lists cli devices and revokes cli authorizations', async () => {
    let { ip, oauthToken, oauthAuthorization, oauthApplication } = await issueCliToken();
    let tokenApi = rest(metorialEndpoints().api, { apiKey: oauthToken.accessToken });
    expect(expectOk(await tokenApi.get('/organization')).id).toBe(org.ids.organizationId);

    let devices = await listAll(org.clients.management, '/organization/oauth/cli-devices');
    let device = devices.find(item => item.ip === ip);
    expectPresented(device, 'machine_access.cli_device');
    expect(device).toMatchObject({
      organization_id: org.ids.organizationId,
      oauth_authorization_id: oauthAuthorization.id
    });
    expect(device.user.id).toBe(org.ids.userId);
    expect(
      expectOk(
        await org.clients.management.get(`/organization/oauth/cli-devices/${device.id}`)
      ).ip
    ).toBe(ip);

    let authorizations = await listAll(
      org.clients.management,
      '/organization/oauth/authorizations',
      { query: { app_id: oauthApplication.id, status: 'active' } }
    );
    let authorization = authorizations.find(item => item.id === oauthAuthorization.id);
    expectPresented(authorization, 'machine_access.oauth_authorization');
    expect(authorization).toMatchObject({
      status: 'active',
      subject_type: 'organization_member',
      user_id: org.ids.userId,
      oauth_application_id: oauthApplication.id
    });

    let path = `/organization/oauth/authorizations/${oauthAuthorization.id}`;
    expect(expectOk(await org.clients.management.get(path)).id).toBe(oauthAuthorization.id);
    expectError(await otherOrg.clients.management.get(path), 404, 'not_found');
    expectError(await otherOrg.clients.management.post(`${path}/revoke`), 404, 'not_found');

    let revoked = expectOk(await org.clients.management.post(`${path}/revoke`));
    expect(revoked.status).toBe('revoked');
    await eventually(async () => {
      expect((await tokenApi.get('/organization')).status).toBe(401);
    });

    let revokedList = await listAll(
      org.clients.management,
      '/organization/oauth/authorizations',
      {
        query: { app_id: oauthApplication.id, status: 'revoked' }
      }
    );
    expect(revokedList.map(item => item.id)).toContain(oauthAuthorization.id);
  });

  it('presents the client redirect of approved and rejected authorization requests', async () => {
    let application = await createApplication();
    let createRequest = (state: string) =>
      oauthAuthorizationService.createOAuthAuthorizationRequest({
        context: testContext(),
        input: {
          type: 'interactive',
          clientId: application.client_id,
          redirectUri: 'https://example.com/callback',
          scopes: ['organization:read'],
          state
        }
      });
    let decide = (urlToken: string, decision: 'approve' | 'reject', body: object) =>
      org.clients.rest.post(
        `/dashboard/oauth/authorization-requests/${urlToken}/${decision}`,
        body
      );

    let approvedRequest = await createRequest('approved-state');
    let approved = expectOk(
      await decide(approvedRequest.urlToken, 'approve', {
        organization_id: org.ids.organizationId
      })
    );
    let approvedUrl = new URL(approved.redirect_url);
    expect(approvedUrl.searchParams.get('code')).toEqual(expect.any(String));
    expect(approvedUrl.searchParams.get('state')).toBe('approved-state');
    expect(approvedUrl.searchParams.has('error')).toBe(false);

    let rejectedRequest = await createRequest('rejected-state');
    let rejected = expectOk(await decide(rejectedRequest.urlToken, 'reject', {}));
    expect(rejected.status).toBe('denied');
    let rejectedUrl = new URL(rejected.redirect_url);
    expect(`${rejectedUrl.origin}${rejectedUrl.pathname}`).toBe(
      'https://example.com/callback'
    );
    expect(Object.fromEntries(rejectedUrl.searchParams)).toEqual({
      error: 'access_denied',
      state: 'rejected-state'
    });
  });

  it('hides cli devices of other organizations', async () => {
    let { ip } = await issueCliToken();
    let devices = await listAll(org.clients.management, '/organization/oauth/cli-devices', {
      limit: 1
    });
    let ids = devices.map(item => item.id);
    expect(new Set(ids).size).toBe(ids.length);
    let device = devices.find(item => item.ip === ip);

    expectError(
      await otherOrg.clients.management.get(`/organization/oauth/cli-devices/${device.id}`),
      404,
      'not_found'
    );
    let otherDevices = await listAll(
      otherOrg.clients.management,
      '/organization/oauth/cli-devices'
    );
    expect(otherDevices.map(item => item.id)).not.toContain(device.id);
  });
});
