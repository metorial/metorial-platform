import { generatePublicMcpToken, UnifiedApiKey } from '@metorial/api-keys';
import { expectServiceError, testContext, uniqueId, useOrganization } from '@metorial/e2e';
import { db, loadOrganizationFixture } from '@metorial/e2e/db';
import { apiKeyService } from '@metorial/module-machine-access';
import { userAuthService, userSessionService } from '@metorial/module-user';
import { describe, expect, it } from 'vitest';
import {
  accessService,
  authenticationService,
  instancePublishableTokenScopes,
  instanceSecretTokenScopes,
  orgManagementTokenScopes,
  scopes,
  sessionClientSecretReferenceService
} from '../src';

describe('module-access authentication', () => {
  let org = useOrganization();

  let authenticateKey = (apiKey: string, context = testContext()) =>
    authenticationService.authenticate({ type: 'api_key', apiKey, context });

  let createKey = async (input: {
    type:
      | 'organization_management_token'
      | 'instance_access_token_secret'
      | 'instance_access_token_publishable';
    expiresAt?: Date;
    ipFilters?: string[];
  }) => {
    let fixture = await loadOrganizationFixture(org.ids);
    let created = await apiKeyService.createApiKey({
      type: input.type,
      organization: fixture.organization,
      instance: fixture.instance,
      auditScope: fixture.auditScope,
      input: {
        name: uniqueId('e2e-key'),
        expiresAt: input.expiresAt,
        ipFilters: input.ipFilters
      }
    });

    return { fixture, apiKey: created.apiKey, secret: created.secret.secret };
  };

  it('authenticates a user session with every scope and rejects unknown or ended sessions', async () => {
    let fixture = await loadOrganizationFixture(org.ids);

    let authInfo = await authenticationService.authenticate({
      type: 'user_session',
      sessionClientSecret: org.session,
      context: testContext()
    });
    expect(authInfo.type).toBe('user');
    if (authInfo.type != 'user') return;
    expect(authInfo.user.id).toBe(org.ids.userId);
    expect(authInfo.userSession?.clientSecret).toBe(org.session);
    expect(authInfo.orgScopes).toEqual(scopes);

    await expectServiceError(
      authenticationService.authenticate({
        type: 'user_session',
        sessionClientSecret: `metorial_ses_${uniqueId('unknown')}`,
        context: testContext()
      }),
      'unauthorized'
    );

    let session = await userSessionService.createUserSession({
      user: fixture.user,
      context: testContext()
    });
    let fresh = await authenticationService.authenticate({
      type: 'user_session',
      sessionClientSecret: session.clientSecret,
      context: testContext()
    });
    expect(fresh.type == 'user' && fresh.userSession?.id).toBe(session.id);

    await userAuthService.logout({
      context: testContext(),
      session: { ...session, user: fixture.user }
    });
    await expectServiceError(
      authenticationService.authenticate({
        type: 'user_session',
        sessionClientSecret: session.clientSecret,
        context: testContext()
      }),
      'unauthorized'
    );

    let stillValid = await authenticationService.authenticate({
      type: 'user_session',
      sessionClientSecret: org.session,
      context: testContext()
    });
    expect(stillValid.type).toBe('user');
  });

  it('authenticates organization management keys with organization restrictions', async () => {
    let authInfo = await authenticateKey(org.keys.management);

    expect(authInfo.type).toBe('machine');
    if (authInfo.type != 'machine') return;
    expect(authInfo.machineAccess.type).toBe('organization_management');
    expect(authInfo.orgScopes).toEqual(orgManagementTokenScopes);
    expect(authInfo.orgScopes).not.toContain('user:read');
    expect(authInfo.restrictions.type).toBe('organization');
    expect(authInfo.restrictions.organization.id).toBe(org.ids.organizationId);
    expect(authInfo.auditScope.actor.type).toBe('org_actor');
    expect(authInfo.auditScope.actor.id).toBe(authInfo.restrictions.actor.id);

    let row = await db.apiKey.findFirstOrThrow({
      where: { machineAccessOid: authInfo.machineAccess.oid }
    });
    expect(row.lastUsedAt).toBeInstanceOf(Date);
  });

  it('authenticates instance secret and publishable keys with their instance restrictions', async () => {
    let secret = await authenticateKey(org.keys.instanceSecret);
    expect(secret.type).toBe('machine');
    if (secret.type != 'machine') return;
    expect(secret.machineAccess.type).toBe('instance_secret');
    expect(secret.orgScopes).toEqual(instanceSecretTokenScopes);
    expect(secret.restrictions.type).toBe('instance');
    if (secret.restrictions.type != 'instance') return;
    expect(secret.restrictions.instance.id).toBe(org.ids.instanceId);
    expect(secret.restrictions.instance.project.id).toBe(org.ids.projectId);
    expect(secret.restrictions.resourceActor.projectOid).toBe(
      secret.restrictions.instance.project.oid
    );
    expect(secret.restrictions.consumer).toBeUndefined();

    let created = await createKey({ type: 'instance_access_token_publishable' });
    let publishable = await authenticateKey(created.secret);
    expect(publishable.type).toBe('machine');
    if (publishable.type != 'machine') return;
    expect(publishable.machineAccess.type).toBe('instance_publishable');
    expect(publishable.apiKey?.id).toBe(created.apiKey.id);
    expect(publishable.orgScopes).toEqual(instancePublishableTokenScopes);
    expect(
      publishable.restrictions.type == 'instance' && publishable.restrictions.instance.id
    ).toBe(org.ids.instanceId);
  });

  it('enforces the scopes of each credential type in checkAccess', async () => {
    let user = await authenticationService.authenticate({
      type: 'user_session',
      sessionClientSecret: org.session,
      context: testContext()
    });
    let management = await authenticateKey(org.keys.management);
    let instance = await authenticateKey(org.keys.instanceSecret);
    let publishable = await authenticateKey(
      (await createKey({ type: 'instance_access_token_publishable' })).secret
    );

    await accessService.checkAccess({ authInfo: user, possibleScopes: ['user:write'] });
    await accessService.checkAccess({
      authInfo: management,
      possibleScopes: ['organization.access_policy:write']
    });
    await accessService.checkAccess({
      authInfo: instance,
      possibleScopes: ['instance.secret:read']
    });
    await accessService.checkAccess({
      authInfo: publishable,
      possibleScopes: ['instance.provider:read']
    });

    await expectServiceError(
      accessService.checkAccess({ authInfo: management, possibleScopes: ['user:read'] }),
      'forbidden'
    );
    await expectServiceError(
      accessService.checkAccess({
        authInfo: instance,
        possibleScopes: ['organization.team:read', 'organization.access_policy:read']
      }),
      'forbidden'
    );
    await expectServiceError(
      accessService.checkAccess({
        authInfo: publishable,
        possibleScopes: ['instance.secret:read', 'instance.session:write']
      }),
      'forbidden'
    );
    await accessService.checkAccess({
      authInfo: publishable,
      possibleScopes: ['instance.secret:read', 'instance.provider.session:read']
    });
  });

  it('rejects revoked and expired api keys', async () => {
    let revoked = await createKey({ type: 'instance_access_token_secret' });
    expect((await authenticateKey(revoked.secret)).type).toBe('machine');

    await apiKeyService.revokeApiKey({
      apiKey: revoked.apiKey,
      auditScope: revoked.fixture.auditScope
    });
    let error = await expectServiceError(authenticateKey(revoked.secret), 'unauthorized');
    expect(error.message).toMatch(/expired or has been revoked/);

    let expired = await createKey({
      type: 'organization_management_token',
      expiresAt: new Date(Date.now() - 60_000)
    });
    await expectServiceError(authenticateKey(expired.secret), 'unauthorized');

    let future = await createKey({
      type: 'organization_management_token',
      expiresAt: new Date(Date.now() + 60 * 60_000)
    });
    expect((await authenticateKey(future.secret)).type).toBe('machine');
  });

  it('retires the previous secret when an api key is rotated', async () => {
    let created = await createKey({ type: 'instance_access_token_secret' });
    expect((await authenticateKey(created.secret)).type).toBe('machine');

    let rotated = await apiKeyService.rotateApiKey({
      apiKey: created.apiKey,
      auditScope: created.fixture.auditScope,
      input: {}
    });
    expect(rotated.secret.secret).not.toBe(created.secret);

    await expectServiceError(authenticateKey(created.secret), 'unauthorized');
    let current = await authenticateKey(rotated.secret.secret);
    expect(current.type == 'machine' && current.apiKey?.id).toBe(created.apiKey.id);

    let graceful = await createKey({ type: 'instance_access_token_secret' });
    let rotatedWithGrace = await apiKeyService.rotateApiKey({
      apiKey: graceful.apiKey,
      auditScope: graceful.fixture.auditScope,
      input: { currentExpiresAt: new Date(Date.now() + 60 * 60_000) }
    });
    expect((await authenticateKey(graceful.secret)).type).toBe('machine');
    expect((await authenticateKey(rotatedWithGrace.secret.secret)).type).toBe('machine');
  });

  it('only accepts api keys from allowed IP addresses', async () => {
    let created = await createKey({
      type: 'instance_access_token_secret',
      ipFilters: ['10.20.30.0/24']
    });

    let error = await expectServiceError(
      authenticateKey(created.secret, { ip: '127.0.0.1', ua: 'metorial-e2e' }),
      'unauthorized'
    );
    expect(error.message).toMatch(/IP address/);

    let allowed = await authenticateKey(created.secret, {
      ip: '10.20.30.40',
      ua: 'metorial-e2e'
    });
    expect(allowed.type).toBe('machine');
  });

  it('rejects malformed, unknown and foreign tokens', async () => {
    await expectServiceError(authenticateKey('not-a-key'), 'unauthorized');
    await expectServiceError(authenticateKey(''), 'unauthorized');
    await expectServiceError(authenticateKey(`${org.keys.instanceSecret}x`), 'unauthorized');
    await expectServiceError(authenticateKey(org.session), 'unauthorized');

    for (let type of [
      'organization_management_token',
      'instance_access_token_secret',
      'fine_grained_token',
      'oauth_access_token',
      'user_auth_token'
    ] as const) {
      let forged = UnifiedApiKey.create({
        type,
        config: { url: 'http://127.0.0.1', instance: 'v2-ext' }
      }).toString();
      await expectServiceError(authenticateKey(forged), 'unauthorized');
    }

    let publicMcp = await expectServiceError(
      authenticateKey(generatePublicMcpToken('access')),
      'unauthorized'
    );
    expect(publicMcp.message).toMatch(/public MCP server/);

    let forgedSecret = org.keys.instanceSecret.replace(/^metorial_sk_/, 'metorial_lk_');
    await expectServiceError(authenticateKey(forgedSecret), 'unauthorized');
  });

  it('only combines consumer session secrets with publishable keys', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let { clientSecret } = await sessionClientSecretReferenceService.createForSession({
      instance: fixture.instance,
      sessionId: uniqueId('ses')
    });

    for (let apiKey of [org.keys.management, org.keys.instanceSecret, clientSecret]) {
      let error = await expectServiceError(
        authenticationService.authenticate({
          type: 'api_key',
          apiKey,
          consumerSessionClientSecret: uniqueId('consumer'),
          context: testContext()
        }),
        'unauthorized'
      );
      expect(error.message).toMatch(/publishable/);
    }
  });
});
