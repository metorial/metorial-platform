import {
  authClients,
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
import { oauthAuthorizationService } from '@metorial/module-machine-access';
import { describe, expect, it } from 'vitest';

describe('api-core management: service accounts', () => {
  let org = useOrganization();
  let otherOrg = useOrganization();

  let dashboardPath = (path: string) =>
    `/dashboard/organizations/${org.ids.organizationId}${path}`;

  let createServiceAccount = async (
    body: Record<string, unknown> = {},
    client = org.clients.management
  ) =>
    expectOk(
      await client.post('/organization/service-accounts', {
        name: uniqueId('rest-service-account'),
        description: 'REST service account',
        scopes: ['organization:read'],
        ...body
      })
    );

  let createClientSecret = async (serviceAccountId: string) =>
    expectOk(
      await org.clients.management.post(
        `/organization/service-accounts/${serviceAccountId}/client-secrets`
      )
    );

  let exchange = (clientId: string, clientSecret: string) =>
    oauthAuthorizationService.exchangeOAuthToken({
      context: testContext(),
      input: { grantType: 'client_credentials', clientId, clientSecret }
    });

  it('authenticates service account routes per credential', async () => {
    let serviceAccount = await createServiceAccount();
    let clients = authClients(org, {
      instanceDashboardVersion: rest(metorialEndpoints().api, {
        apiKey: org.keys.instanceSecret
      }),
      otherSession: rest(metorialEndpoints().api, { session: otherOrg.session })
    });
    let isDashboard = (name: string) => name === 'session' || name === 'otherSession';

    let responses = await expectAuthMatrix(
      clients,
      (client, name) =>
        client.get(
          isDashboard(name)
            ? dashboardPath('/service-accounts')
            : '/organization/service-accounts'
        ),
      {
        none: 401,
        session: 200,
        management: 200,
        instance: 404,
        instanceDashboardVersion: 403,
        otherSession: [403, 404]
      }
    );
    expect(responses.session.body.items.map((item: any) => item.id)).toContain(
      serviceAccount.id
    );

    await expectAuthMatrix(
      clients,
      (client, name) =>
        client.delete(
          isDashboard(name)
            ? dashboardPath(`/service-accounts/${serviceAccount.id}`)
            : `/organization/service-accounts/${serviceAccount.id}`
        ),
      { none: 401, instance: 404, instanceDashboardVersion: 403, otherSession: [403, 404] }
    );
    expect(
      expectOk(
        await org.clients.management.get(`/organization/service-accounts/${serviceAccount.id}`)
      ).status
    ).toBe('active');
  });

  it('runs the service account lifecycle with the presenter shape', async () => {
    let created = await createServiceAccount({
      scopes: ['organization:read', 'organization.member:read']
    });
    expectPresented(created, 'machine_access.service_account');
    expect(created).toMatchObject({
      status: 'active',
      subject_type: 'organization_member',
      description: 'REST service account',
      organization_id: org.ids.organizationId,
      portal_id: null,
      consumer_profile_id: null,
      policies: [],
      client_secrets: []
    });
    expect(created.client_id).toMatch(/^mt_oauth_/);
    expect(created.scopes.map((scope: any) => scope.identifier).sort()).toEqual([
      'organization.member:read',
      'organization:read'
    ]);

    let path = `/organization/service-accounts/${created.id}`;
    let fetched = expectOk(
      await org.clients.rest.get(dashboardPath(`/service-accounts/${created.id}`))
    );
    expect(fetched.client_id).toBe(created.client_id);

    let name = uniqueId('renamed-service-account');
    let updated = expectOk(
      await org.clients.management.patch(path, {
        name,
        description: null,
        scopes: ['organization:read']
      })
    );
    expect(updated).toMatchObject({ name, description: null });
    expect(updated.scopes.map((scope: any) => scope.identifier)).toEqual([
      'organization:read'
    ]);

    let archived = expectOk(await org.clients.management.delete(path));
    expect(archived.status).toBe('archived');

    expectError(await org.clients.management.patch(path, { name: 'x' }), 403, 'forbidden');
    expectError(await org.clients.management.post(`${path}/client-secrets`), 403, 'forbidden');
    expectError(await org.clients.management.delete(path), 403, 'forbidden');

    let active = await listAll(org.clients.management, '/organization/service-accounts');
    expect(active.map(item => item.id)).not.toContain(created.id);
    let archivedList = await listAll(
      org.clients.management,
      '/organization/service-accounts',
      {
        query: { status: 'archived' }
      }
    );
    expect(archivedList.map(item => item.id)).toContain(created.id);
  });

  it('returns client secrets only when they are created', async () => {
    let serviceAccount = await createServiceAccount();
    let path = `/organization/service-accounts/${serviceAccount.id}`;

    let clientSecret = await createClientSecret(serviceAccount.id);
    expectPresented(clientSecret, 'machine_access.oauth_application_client_secret');
    expect(clientSecret.secret).toMatch(/^mt_oauth_secret/);
    expect(clientSecret.preview).toBe(
      `${clientSecret.secret.slice(0, 4)}••••${clientSecret.secret.slice(-4)}`
    );
    expect(clientSecret.deleted_at).toBeNull();

    let fetched = expectOk(await org.clients.management.get(path));
    expect(fetched.client_secrets).toEqual([
      expect.objectContaining({
        id: clientSecret.id,
        preview: clientSecret.preview,
        secret: null
      })
    ]);

    let deleted = expectOk(
      await org.clients.management.delete(`${path}/client-secrets/${clientSecret.id}`)
    );
    expect(deleted.secret).toBeNull();
    expect(deleted.deleted_at).toEqual(expect.any(String));

    expect(expectOk(await org.clients.management.get(path)).client_secrets).toEqual([]);
    expectError(
      await org.clients.management.delete(`${path}/client-secrets/${clientSecret.id}`),
      404,
      'not_found'
    );
  });

  it('lists the credentials issued through client credentials', async () => {
    let serviceAccount = await createServiceAccount();
    let path = `/organization/service-accounts/${serviceAccount.id}`;
    let clientSecret = await createClientSecret(serviceAccount.id);

    let { oauthAuthorization } = await exchange(serviceAccount.client_id, clientSecret.secret);

    let credentials = await listAll(org.clients.management, `${path}/credentials`);
    let credential = credentials.find(item => item.status === 'active');
    expect(credentials).toHaveLength(1);
    expectPresented(credential, 'machine_access.service_account_credential');
    expect(credential).toMatchObject({
      service_account_id: serviceAccount.id,
      revoked_at: null,
      scopes: []
    });
    expect(credential.machine_access.id).toEqual(expect.any(String));
    expect(oauthAuthorization.status).toBe('active');

    let fetched = expectOk(
      await org.clients.management.get(`${path}/credentials/${credential.id}`)
    );
    expect(fetched.id).toBe(credential.id);

    expectOk(await org.clients.management.delete(path));

    let revoked = await listAll(org.clients.management, `${path}/credentials`, {
      query: { status: 'revoked' }
    });
    expect(revoked.map(item => item.id)).toEqual([credential.id]);
    expect(
      await listAll(org.clients.management, `${path}/credentials`, {
        query: { status: 'active' }
      })
    ).toEqual([]);
  });

  it('validates service account bodies and queries', async () => {
    let create = (body: Record<string, unknown>) =>
      org.clients.management.post('/organization/service-accounts', {
        name: uniqueId('invalid-service-account'),
        scopes: ['organization:read'],
        ...body
      });

    expectError(await create({ scopes: undefined }), 400, 'invalid_data');
    expectError(await create({ name: undefined }), 400, 'invalid_data');
    expectError(await create({ subject_type: 'robot' }), 400, 'invalid_data');
    expectError(await create({ scopes: ['organization:fly'] }), 400, 'bad_request');
    expectError(await create({ scopes: ['consumer#organization:read'] }), 400, 'bad_request');
    expectError(await create({ portal_id: 'ptl_unknown' }), 400, 'bad_request');
    expectError(await create({ subject_type: 'consumer' }), 400, 'bad_request');
    expectError(
      await create({
        subject_type: 'consumer',
        portal_id: 'ptl_unknown',
        scopes: ['consumer#organization:read']
      }),
      404,
      'not_found'
    );

    expectError(
      await org.clients.management.get('/organization/service-accounts', {
        query: { status: 'deleted' }
      }),
      400,
      'invalid_data'
    );

    let serviceAccount = await createServiceAccount();
    expectError(
      await org.clients.management.patch(
        `/organization/service-accounts/${serviceAccount.id}`,
        {
          scopes: ['organization:fly']
        }
      ),
      400,
      'bad_request'
    );
    expectError(
      await org.clients.management.post(
        `/organization/service-accounts/${serviceAccount.id}/policies`,
        { access_policy_id: 'apo_unknown' }
      ),
      404,
      'not_found'
    );
  });

  it('pages through service accounts without gaps or duplicates', async () => {
    let created = [
      await createServiceAccount(),
      await createServiceAccount(),
      await createServiceAccount()
    ];

    let listed = await listAll(org.clients.management, '/organization/service-accounts', {
      limit: 1
    });
    let ids = listed.map(item => item.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toEqual(expect.arrayContaining(created.map(item => item.id)));
  });

  it('hides service accounts, secrets and credentials of other organizations', async () => {
    let serviceAccount = await createServiceAccount();
    let sibling = await createServiceAccount();
    let clientSecret = await createClientSecret(serviceAccount.id);
    let { oauthAuthorization } = await exchange(serviceAccount.client_id, clientSecret.secret);
    let [credential] = await listAll(
      org.clients.management,
      `/organization/service-accounts/${serviceAccount.id}/credentials`
    );
    expect(credential.id).toEqual(expect.any(String));
    expect(oauthAuthorization.status).toBe('active');

    let other = otherOrg.clients.management;
    let path = `/organization/service-accounts/${serviceAccount.id}`;

    expectError(await other.get(path), 404, 'not_found');
    expectError(await other.patch(path, { name: 'hijacked' }), 404, 'not_found');
    expectError(await other.delete(path), 404, 'not_found');
    expectError(await other.post(`${path}/client-secrets`), 404, 'not_found');
    expectError(
      await other.delete(`${path}/client-secrets/${clientSecret.id}`),
      404,
      'not_found'
    );
    expectError(await other.get(`${path}/credentials`), 404, 'not_found');
    expectError(await other.get(`${path}/credentials/${credential.id}`), 404, 'not_found');

    let siblingPath = `/organization/service-accounts/${sibling.id}`;
    expectError(
      await org.clients.management.delete(`${siblingPath}/client-secrets/${clientSecret.id}`),
      404,
      'not_found'
    );
    expectError(
      await org.clients.management.get(`${siblingPath}/credentials/${credential.id}`),
      404,
      'not_found'
    );

    let otherList = await listAll(other, '/organization/service-accounts');
    expect(otherList.map(item => item.id)).not.toContain(serviceAccount.id);
    expect(expectOk(await org.clients.management.get(path)).name).toBe(serviceAccount.name);
  });
});
