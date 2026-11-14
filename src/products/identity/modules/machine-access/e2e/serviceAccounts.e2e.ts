import { forbiddenError, ServiceError } from '@lowerdeck/error';
import {
  expectOk,
  expectServiceError,
  firstPage,
  metorialEndpoints,
  rest,
  testContext,
  uniqueId,
  useOrganization
} from '@metorial/e2e';
import { db, loadOrganizationFixture } from '@metorial/e2e/db';
import { Fabric, type FabricEvents } from '@metorial/fabric';
import {
  accessPolicyAssignmentService,
  accessPolicyService
} from '@metorial/module-organization';
import { afterEach, describe, expect, it } from 'vitest';
import {
  machineAccessAuthService,
  oauthAuthorizationService,
  serviceAccountService
} from '../src';

type SecretRequestedEvent = FabricEvents['machine_access.secret.requested:before'];

describe('module-machine-access service accounts', () => {
  let org = useOrganization();
  let otherOrg = useOrganization();

  let cleanups: (() => void)[] = [];

  afterEach(() => {
    for (let cleanup of cleanups.splice(0)) cleanup();
  });

  let createServiceAccount = async (
    scopes: string[] = ['organization:read'],
    ids: { organizationId: string } = org.ids
  ) => {
    let fixture = await loadOrganizationFixture(ids);
    let name = uniqueId('service-account');

    let serviceAccount = await serviceAccountService.createServiceAccount({
      organization: fixture.organization,
      auditScope: fixture.auditScope,
      input: { name, description: 'E2E service account', scopes }
    });

    return { fixture, name, serviceAccount };
  };

  let exchange = (input: {
    clientId: string;
    clientSecret: string;
    scopes?: string[];
    expiresIn?: number;
  }) =>
    oauthAuthorizationService.exchangeOAuthToken({
      context: testContext(),
      input: { grantType: 'client_credentials', ...input }
    });

  let authenticate = (token: string) =>
    machineAccessAuthService.authenticateWithMachineAccessToken({
      token,
      context: testContext()
    });

  let tokenApi = (apiKey: string) => rest(metorialEndpoints().api, { apiKey });

  let listenToSecretRequests = (veto = false) => {
    let events: SecretRequestedEvent[] = [];

    cleanups.push(
      Fabric.listen('machine_access.secret.requested:before', async event => {
        events.push(event);
        if (veto) {
          throw new ServiceError(forbiddenError({ message: 'Elevation required' }));
        }
      })
    );

    return events;
  };

  it('creates a service account backed by a server-side oauth application', async () => {
    let { serviceAccount, name, fixture } = await createServiceAccount([
      'organization:read',
      'organization.member:read',
      'organization:read'
    ]);
    let scopes = ['organization.member:read', 'organization:read'];

    expect(serviceAccount).toMatchObject({
      status: 'active',
      subjectType: 'organization_member',
      name,
      description: 'E2E service account',
      scopes,
      portal: null,
      consumerProfile: null
    });

    let application = serviceAccount.oauthApplication;
    expect(application).toMatchObject({
      status: 'active',
      type: 'server_side',
      accessLevel: 'organization',
      subjectType: 'organization_member',
      scopes,
      redirectUris: []
    });
    expect(application.clientId).toMatch(/^mt_oauth_/);
    expect(application.clientSecrets).toEqual([]);
    expect(application.serverSideMachineAccess).toMatchObject({
      type: 'organization_management',
      status: 'active',
      hasCustomScopes: true,
      scopes
    });
    expect(application.scopedInstallation).toMatchObject({ status: 'active', scopes });
    expect(application.scopedInstallation?.serverSideMachineAccessOid).toBe(
      application.serverSideMachineAccess?.oid
    );

    let fetched = await serviceAccountService.getServiceAccountById({
      organization: fixture.organization,
      serviceAccountId: serviceAccount.id
    });
    expect(fetched.oauthApplication.id).toBe(application.id);

    let listed = await firstPage(
      await serviceAccountService.listServiceAccounts({ organization: fixture.organization })
    );
    expect(listed.map(item => item.id)).toContain(serviceAccount.id);
  });

  it('rejects unknown and consumer-only scopes', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let name = uniqueId('invalid-scopes');

    for (let scopes of [['organization:fly'], ['consumer#organization:read']]) {
      let error = await expectServiceError(
        serviceAccountService.createServiceAccount({
          organization: fixture.organization,
          auditScope: fixture.auditScope,
          input: { name, scopes }
        }),
        'bad_request'
      );
      expect(error.message).toContain(scopes[0]);
    }

    expect(await db.serviceAccount.count({ where: { name } })).toBe(0);
    expect(await db.oAuthApplication.count({ where: { name } })).toBe(0);
  });

  it('updates names, descriptions and scopes across the backing application', async () => {
    let { serviceAccount, fixture } = await createServiceAccount([
      'organization:read',
      'organization.member:read'
    ]);
    let name = uniqueId('renamed');

    let updated = await serviceAccountService.updateServiceAccount({
      serviceAccount,
      organization: fixture.organization,
      auditScope: fixture.auditScope,
      input: { name, description: null, scopes: ['organization:read'] }
    });
    expect(updated).toMatchObject({ name, description: null, scopes: ['organization:read'] });
    expect(updated.oauthApplication).toMatchObject({ name, scopes: ['organization:read'] });
    expect(updated.oauthApplication.scopedInstallation?.scopes).toEqual(['organization:read']);
    expect(updated.oauthApplication.serverSideMachineAccess?.scopes).toEqual([
      'organization:read'
    ]);

    await expectServiceError(
      serviceAccountService.updateServiceAccount({
        serviceAccount: updated,
        organization: fixture.organization,
        auditScope: fixture.auditScope,
        input: { scopes: ['organization:fly'] }
      }),
      'bad_request'
    );
    expect(
      (await db.serviceAccount.findUniqueOrThrow({ where: { oid: serviceAccount.oid } }))
        .scopes
    ).toEqual(['organization:read']);
  });

  it('creates and deletes client secrets', async () => {
    let { serviceAccount, fixture } = await createServiceAccount();

    let clientSecret = await serviceAccountService.createServiceAccountClientSecret({
      serviceAccount,
      auditScope: fixture.auditScope
    });
    expect(clientSecret.secret).toMatch(/^mt_oauth_secret/);
    expect(clientSecret.secretPreview).toBe(
      `${clientSecret.secret.slice(0, 4)}••••${clientSecret.secret.slice(-4)}`
    );
    expect(clientSecret.oauthApplicationOid).toBe(serviceAccount.oauthApplication.oid);

    let reloaded = await serviceAccountService.getServiceAccountById({
      organization: fixture.organization,
      serviceAccountId: serviceAccount.id
    });
    expect(reloaded.oauthApplication.clientSecrets.map(secret => secret.id)).toEqual([
      clientSecret.id
    ]);

    let fetched = await serviceAccountService.getServiceAccountClientSecretById({
      serviceAccount,
      oauthApplicationClientSecretId: clientSecret.id
    });
    let deleted = await serviceAccountService.deleteServiceAccountClientSecret({
      oauthApplicationClientSecret: fetched,
      auditScope: fixture.auditScope
    });
    expect(deleted.deletedAt).toBeInstanceOf(Date);

    await expectServiceError(
      serviceAccountService.getServiceAccountClientSecretById({
        serviceAccount,
        oauthApplicationClientSecretId: clientSecret.id
      }),
      'not_found'
    );
    await expectServiceError(
      exchange({
        clientId: serviceAccount.oauthApplication.clientId,
        clientSecret: clientSecret.secret
      }),
      'unauthorized'
    );
  });

  it('exchanges client credentials for tokens scoped by assigned policies', async () => {
    let { serviceAccount, fixture } = await createServiceAccount(['organization:read']);
    let clientId = serviceAccount.oauthApplication.clientId;
    let { secret: clientSecret } =
      await serviceAccountService.createServiceAccountClientSecret({
        serviceAccount,
        auditScope: fixture.auditScope
      });

    let unscoped = await exchange({ clientId, clientSecret });
    expect(unscoped.oauthAuthorization).toMatchObject({
      status: 'active',
      type: 'server_side',
      scopes: []
    });

    let auth = await authenticate(unscoped.oauthToken.accessToken);
    expect(auth.type).toBe('oauth_token');
    if (auth.type != 'oauth_token') return;
    expect(
      auth.oauthToken.oauthAuthorization.serviceAccountCredential?.serviceAccount.id
    ).toBe(serviceAccount.id);

    let credentials = await firstPage(
      await serviceAccountService.listServiceAccountCredentials({ serviceAccount })
    );
    let credential = credentials.find(
      item => item.oauthAuthorization.id == unscoped.oauthAuthorization.id
    );
    expect(credential).toBeDefined();
    let fetched = await serviceAccountService.getServiceAccountCredentialById({
      serviceAccount,
      serviceAccountCredentialId: credential!.id
    });
    expect(fetched.serviceAccount.id).toBe(serviceAccount.id);

    let adminPolicy = await accessPolicyService.getDefaultAccessPolicy({
      organization: fixture.organization,
      type: 'admin'
    });
    if (!adminPolicy) throw new Error('The organization has no default admin access policy');
    await accessPolicyAssignmentService.assignAccessPolicyToServiceAccount({
      organization: fixture.organization,
      serviceAccount,
      accessPolicy: adminPolicy,
      auditScope: fixture.auditScope,
      allowDefault: true
    });

    let scoped = await exchange({ clientId, clientSecret });
    expect(scoped.oauthAuthorization.scopes).toEqual(['organization:read']);

    let organization = expectOk(
      await tokenApi(scoped.oauthToken.accessToken).get('/organization')
    );
    expect(organization.id).toBe(org.ids.organizationId);
    expect(
      (
        await tokenApi(scoped.oauthToken.accessToken).get('/organization/api-keys', {
          query: { type: 'organization_management_token' }
        })
      ).status
    ).toBe(403);

    await expectServiceError(
      exchange({ clientId, clientSecret, scopes: ['organization.member:read'] }),
      'bad_request'
    );
    await expectServiceError(
      exchange({ clientId, clientSecret: 'mt_oauth_secret_wrong' }),
      'unauthorized'
    );
    await expectServiceError(
      exchange({ clientId, clientSecret, expiresIn: 10 }),
      'bad_request'
    );
  });

  it('archives service accounts and revokes their tokens', async () => {
    let { serviceAccount, fixture } = await createServiceAccount();
    let clientId = serviceAccount.oauthApplication.clientId;
    let { secret: clientSecret } =
      await serviceAccountService.createServiceAccountClientSecret({
        serviceAccount,
        auditScope: fixture.auditScope
      });
    let { oauthToken, oauthAuthorization } = await exchange({ clientId, clientSecret });
    expect((await authenticate(oauthToken.accessToken)).type).toBe('oauth_token');

    let archived = await serviceAccountService.archiveServiceAccount({
      serviceAccount,
      organization: fixture.organization,
      auditScope: fixture.auditScope
    });
    expect(archived.status).toBe('archived');
    expect(archived.oauthApplication.status).toBe('archived');
    expect(
      (
        await db.oAuthInstallation.findUniqueOrThrow({
          where: { oid: serviceAccount.oauthApplication.scopedInstallation!.oid }
        })
      ).status
    ).toBe('revoked');
    expect(
      (await db.oAuthAuthorization.findUniqueOrThrow({ where: { id: oauthAuthorization.id } }))
        .status
    ).toBe('revoked');

    await expect(authenticate(oauthToken.accessToken)).rejects.toThrow(
      /expired or has been revoked/
    );
    expect((await tokenApi(oauthToken.accessToken).get('/organization')).status).toBe(401);
    await expectServiceError(exchange({ clientId, clientSecret }), 'unauthorized');

    let input = {
      serviceAccount: archived,
      organization: fixture.organization,
      auditScope: fixture.auditScope
    };
    await expectServiceError(
      serviceAccountService.updateServiceAccount({ ...input, input: { name: 'x' } }),
      'forbidden'
    );
    await expectServiceError(serviceAccountService.archiveServiceAccount(input), 'forbidden');
    await expectServiceError(
      serviceAccountService.createServiceAccountClientSecret(input),
      'forbidden'
    );

    let active = await firstPage(
      await serviceAccountService.listServiceAccounts({ organization: fixture.organization })
    );
    expect(active.map(item => item.id)).not.toContain(serviceAccount.id);
    let archivedList = await firstPage(
      await serviceAccountService.listServiceAccounts({
        organization: fixture.organization,
        statuses: ['archived']
      })
    );
    expect(archivedList.map(item => item.id)).toContain(serviceAccount.id);

    let revokedCredentials = await firstPage(
      await serviceAccountService.listServiceAccountCredentials({
        serviceAccount,
        statuses: ['revoked']
      })
    );
    expect(revokedCredentials.map(item => item.oauthAuthorization.id)).toContain(
      oauthAuthorization.id
    );
  });

  it('fires the secret verification hook for client secrets', async () => {
    let { serviceAccount, fixture } = await createServiceAccount();
    let verification = {
      token: 'e2e-verification-token',
      dashboardSession: { userId: org.ids.userId, sessionId: 'ses_e2e', type: 'user' as const }
    };
    let events = listenToSecretRequests();

    await serviceAccountService.createServiceAccountClientSecret({
      serviceAccount,
      auditScope: fixture.auditScope,
      verification
    });
    await serviceAccountService.createServiceAccountClientSecret({
      serviceAccount,
      auditScope: fixture.auditScope
    });

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      secretType: 'service_account_client_secret',
      instance: null,
      verification
    });

    listenToSecretRequests(true);
    await expectServiceError(
      serviceAccountService.createServiceAccountClientSecret({
        serviceAccount,
        auditScope: fixture.auditScope,
        verification
      }),
      'forbidden'
    );
    expect(
      await db.oAuthApplicationClientSecret.count({
        where: { oauthApplicationOid: serviceAccount.oauthApplication.oid }
      })
    ).toBe(2);
  });

  it('isolates service accounts between organizations', async () => {
    let { serviceAccount, fixture } = await createServiceAccount();
    let other = await createServiceAccount(['organization:read'], otherOrg.ids);
    let clientSecret = await serviceAccountService.createServiceAccountClientSecret({
      serviceAccount,
      auditScope: fixture.auditScope
    });
    let { secret: otherSecret } = await serviceAccountService.createServiceAccountClientSecret(
      {
        serviceAccount: other.serviceAccount,
        auditScope: other.fixture.auditScope
      }
    );
    let otherToken = await exchange({
      clientId: other.serviceAccount.oauthApplication.clientId,
      clientSecret: otherSecret
    });

    await expectServiceError(
      serviceAccountService.getServiceAccountById({
        organization: other.fixture.organization,
        serviceAccountId: serviceAccount.id
      }),
      'not_found'
    );
    let otherList = await firstPage(
      await serviceAccountService.listServiceAccounts({
        organization: other.fixture.organization
      })
    );
    expect(otherList.map(item => item.id)).not.toContain(serviceAccount.id);

    await expectServiceError(
      serviceAccountService.getServiceAccountClientSecretById({
        serviceAccount: other.serviceAccount,
        oauthApplicationClientSecretId: clientSecret.id
      }),
      'not_found'
    );
    let otherCredential = await db.serviceAccountCredential.findUniqueOrThrow({
      where: { oauthAuthorizationOid: otherToken.oauthAuthorization.oid }
    });
    await expectServiceError(
      serviceAccountService.getServiceAccountCredentialById({
        serviceAccount,
        serviceAccountCredentialId: otherCredential.id
      }),
      'not_found'
    );
    await expectServiceError(
      exchange({
        clientId: serviceAccount.oauthApplication.clientId,
        clientSecret: otherSecret
      }),
      'unauthorized'
    );
  });
});
