import {
  expectServiceError,
  firstPage,
  uniqueId,
  useMcpTestServer,
  useOrganization
} from '@metorial/e2e';
import { subspaceDb } from '@metorial/e2e/db';
import { addMinutes } from 'date-fns';
import { beforeAll, describe, expect, it } from 'vitest';
import { providerSetupSessionService, providerSetupSessionUiService } from '../src';
import {
  type AuthProvider,
  type AuthScope,
  createAuthProvider,
  importContext,
  loadAuthScope,
  type SeededAuthMethod,
  seedAuthMethod
} from './fixtures';

describe('module-auth provider setup sessions', () => {
  let org = useOrganization();
  let otherOrg = useOrganization();
  let server = useMcpTestServer();

  let scope: AuthScope;
  let configProvider: AuthProvider;
  let authProvider: AuthProvider;
  let tokenMethod: SeededAuthMethod;

  beforeAll(async () => {
    scope = await loadAuthScope(org);
    configProvider = await createAuthProvider(org, server.url);
    authProvider = await createAuthProvider(org, server.url);

    tokenMethod = await seedAuthMethod(scope, authProvider, {
      type: 'token',
      isDefault: true
    });
  });

  type SessionInput = Parameters<
    typeof providerSetupSessionService.createProviderSetupSession
  >[0]['input'];

  let createSession = (
    input: Partial<SessionInput> = {},
    provider?: AuthProvider,
    instance = scope.instance
  ) =>
    providerSetupSessionService.createProviderSetupSession({
      instance,
      provider,
      import: importContext,
      input: {
        name: uniqueId('setup-session'),
        type: 'auto',
        uiMode: 'metorial_elements',
        ...input
      }
    });

  let listSessionIds = async (
    input: Omit<
      Parameters<typeof providerSetupSessionService.listProviderSetupSessions>[0],
      'instance'
    >,
    instance = scope.instance
  ) =>
    (
      await firstPage(
        await providerSetupSessionService.listProviderSetupSessions({ instance, ...input })
      )
    ).map(item => item.id);

  let eventTypes = async (session: { oid: bigint }) =>
    (
      await subspaceDb.providerSetupSessionEvent.findMany({
        where: { sessionOid: session.oid },
        orderBy: { oid: 'asc' }
      })
    ).map(event => event.type);

  it('resolves an automatic session to config only and completes it once config is set', async () => {
    let session = await createSession({}, configProvider);

    expect(session).toMatchObject({
      typeSelected: 'auto',
      typeConcrete: 'config_only',
      status: 'pending',
      providerOid: configProvider.oid,
      authMethodOid: null,
      authConfigOid: null,
      configOid: null
    });
    expect(await eventTypes(session)).toEqual(['created']);

    expect(
      await providerSetupSessionUiService.getConfigSchema({ providerSetupSession: session })
    ).toMatchObject({
      type: 'required',
      schema: { properties: { headers: expect.anything() } }
    });

    await providerSetupSessionUiService.setConfig({
      providerSetupSession: session,
      input: { configInput: { headers: { 'x-e2e': uniqueId('header') } } },
      context: importContext
    });

    let completed = await subspaceDb.providerSetupSession.findUniqueOrThrow({
      where: { oid: session.oid }
    });
    expect(completed.status).toBe('completed');
    expect(completed.configOid).not.toBeNull();
    expect(await eventTypes(session)).toEqual(['created', 'config_set', 'completed']);

    let config = await subspaceDb.providerConfig.findUniqueOrThrow({
      where: { oid: completed.configOid! }
    });
    expect(config).toMatchObject({
      isEphemeral: true,
      tenantOid: scope.tenant.oid,
      providerOid: configProvider.oid
    });

    expect(
      await listSessionIds({ providerIds: [configProvider.id], status: ['completed'] })
    ).toContain(session.id);
    expect(await listSessionIds({ ids: [session.id], status: ['pending'] })).toEqual([]);
  });

  it('keeps an auth-only session pending until an auth config is set', async () => {
    let session = await createSession({ type: 'auth_only' }, authProvider);

    expect(session).toMatchObject({
      typeConcrete: 'auth_only',
      status: 'pending',
      authMethodOid: tokenMethod.oid,
      authConfigOid: null,
      configOid: null
    });
    expect(session.expiresAt.getTime()).toBeGreaterThan(addMinutes(new Date(), 25).getTime());
    expect(await eventTypes(session)).toEqual(['created']);

    let invalid = await expectServiceError(
      providerSetupSessionUiService.setAuthConfig({
        providerSetupSession: session,
        input: { authConfigInput: { token: uniqueId('token') } },
        context: importContext
      }),
      'bad_request'
    );
    expect(invalid.message).toMatch(/accessToken/);

    expect(
      await subspaceDb.providerSetupSession.findUniqueOrThrow({ where: { oid: session.oid } })
    ).toMatchObject({ status: 'pending', authConfigOid: null });
    expect(
      await subspaceDb.providerAuthConfig.count({ where: { providerOid: authProvider.oid } })
    ).toBe(0);
  });

  it('rejects inputs that do not match the session type', async () => {
    let name = uniqueId('rejected-session');

    let withoutProvider = await expectServiceError(
      createSession({ name, configInput: {} }),
      'bad_request'
    );
    expect(withoutProvider.message).toMatch(/without provider/);

    let configOnly = await expectServiceError(
      createSession(
        { name, type: 'config_only', authConfigInput: { accessToken: 'x' } },
        authProvider
      ),
      'bad_request'
    );
    expect(configOnly.message).toMatch(/config_only/);

    let authOnly = await expectServiceError(
      createSession({ name, type: 'auth_only', configInput: {} }, authProvider),
      'bad_request'
    );
    expect(authOnly.message).toMatch(/auth_only/);

    await expectServiceError(
      createSession(
        { name, type: 'auth_only', authMethodId: uniqueId('missing') },
        authProvider
      ),
      'invalid_auth_method'
    );
    await expectServiceError(
      createSession({ name, type: 'auth_only' }, configProvider),
      'bad_request'
    );

    expect(await subspaceDb.providerSetupSession.count({ where: { name } })).toBe(0);
  });

  it('guards UI steps on provider selection, expiry and completion', async () => {
    let unselected = await createSession();

    await expectServiceError(
      providerSetupSessionUiService.getConfigSchema({ providerSetupSession: unselected }),
      'provider_selection_required'
    );
    let setConfig = await expectServiceError(
      providerSetupSessionUiService.setConfig({
        providerSetupSession: unselected,
        input: { configInput: {} },
        context: importContext
      }),
      'bad_request'
    );
    expect(setConfig.message).toMatch(/Cannot set config/);
    await expectServiceError(
      providerSetupSessionUiService.setAuthConfig({
        providerSetupSession: unselected,
        input: { authConfigInput: { accessToken: uniqueId('token') } },
        context: importContext
      }),
      'bad_request'
    );

    let expired = await createSession(
      { type: 'auth_only', expiresAt: addMinutes(new Date(), -1) },
      authProvider
    );
    let expiredError = await expectServiceError(
      providerSetupSessionUiService.setAuthConfig({
        providerSetupSession: expired,
        input: { authConfigInput: { accessToken: uniqueId('token') } },
        context: importContext
      }),
      'bad_request'
    );
    expect(expiredError.message).toMatch(/expired/);

    let completed = await createSession({ configInput: {} }, configProvider);
    expect(completed.status).toBe('completed');
    let completedError = await expectServiceError(
      providerSetupSessionUiService.setConfig({
        providerSetupSession: completed,
        input: { configInput: {} },
        context: importContext
      }),
      'bad_request'
    );
    expect(completedError.message).toMatch(/completed/);

    expect(
      await subspaceDb.providerSetupSession.findUniqueOrThrow({
        where: { oid: completed.oid }
      })
    ).toMatchObject({ configOid: completed.configOid });
  });

  it('updates session details', async () => {
    let session = await providerSetupSessionService.getProviderSetupSessionById({
      instance: scope.instance,
      providerSetupSessionId: (await createSession({ description: 'Initial' })).id
    });

    let updated = await providerSetupSessionService.updateProviderSetupSession({
      instance: scope.instance,
      auditScope: scope.fixture.auditScope,
      providerSetupSession: session,
      input: { name: `${session.name} renamed`, metadata: { team: 'b' } }
    });
    expect(updated).toMatchObject({
      name: `${session.name} renamed`,
      description: 'Initial',
      metadata: { team: 'b' }
    });

    expect(
      await subspaceDb.providerSetupSession.findUniqueOrThrow({ where: { oid: session.oid } })
    ).toMatchObject({ name: `${session.name} renamed`, metadata: { team: 'b' } });
  });

  it('archives a session and closes it for edits and the setup UI', async () => {
    let session = await providerSetupSessionService.getProviderSetupSessionById({
      instance: scope.instance,
      providerSetupSessionId: (await createSession({}, configProvider)).id
    });

    let archived = await providerSetupSessionService.archiveProviderSetupSession({
      instance: scope.instance,
      auditScope: scope.fixture.auditScope,
      providerSetupSession: session
    });
    expect(archived).toMatchObject({ id: session.id, status: 'archived' });

    expect(
      await subspaceDb.providerSetupSession.findUniqueOrThrow({ where: { oid: session.oid } })
    ).toMatchObject({ status: 'archived', name: session.name });

    let fetched = await providerSetupSessionService.getProviderSetupSessionById({
      instance: scope.instance,
      providerSetupSessionId: session.id
    });
    expect(fetched.status).toBe('archived');
    expect(await listSessionIds({ ids: [session.id], status: ['pending'] })).toEqual([]);
    expect(await listSessionIds({ ids: [session.id], status: ['archived'] })).toEqual([
      session.id
    ]);

    await expectServiceError(
      providerSetupSessionService.archiveProviderSetupSession({
        instance: scope.instance,
        providerSetupSession: fetched
      }),
      'gone'
    );
    await expectServiceError(
      providerSetupSessionService.updateProviderSetupSession({
        instance: scope.instance,
        providerSetupSession: fetched,
        input: { name: uniqueId('too-late') }
      }),
      'gone'
    );
    await expectServiceError(
      providerSetupSessionUiService.getProviderSetupSessionByClientSecret({
        sessionId: session.id,
        clientSecret: session.clientSecret
      }),
      'not_found'
    );
  });

  it("does not expose or modify another tenant's setup sessions", async () => {
    let other = await loadAuthScope(otherOrg);
    let session = await createSession({}, configProvider);

    await expectServiceError(
      providerSetupSessionService.getProviderSetupSessionById({
        instance: other.instance,
        providerSetupSessionId: session.id
      }),
      'not_found'
    );
    expect(await listSessionIds({ ids: [session.id] }, other.instance)).toEqual([]);

    await expect(
      providerSetupSessionService.updateProviderSetupSession({
        instance: other.instance,
        providerSetupSession: session,
        input: { name: uniqueId('hijacked') }
      })
    ).rejects.toThrow('Tenant mismatch');

    await expect(
      providerSetupSessionService.archiveProviderSetupSession({
        instance: other.instance,
        providerSetupSession: session
      })
    ).rejects.toThrow('Tenant mismatch');

    expect(
      await subspaceDb.providerSetupSession.findUniqueOrThrow({ where: { oid: session.oid } })
    ).toMatchObject({ name: session.name, status: 'pending', tenantOid: scope.tenant.oid });

    let byClientSecret =
      await providerSetupSessionUiService.getProviderSetupSessionByClientSecret({
        sessionId: session.id,
        clientSecret: session.clientSecret
      });
    expect(byClientSecret.tenant.oid).toBe(scope.tenant.oid);

    let otherSession = await createSession({}, undefined, other.instance);
    await expectServiceError(
      providerSetupSessionUiService.getProviderSetupSessionByClientSecret({
        sessionId: session.id,
        clientSecret: otherSession.clientSecret
      }),
      'not_found'
    );
  });
});
