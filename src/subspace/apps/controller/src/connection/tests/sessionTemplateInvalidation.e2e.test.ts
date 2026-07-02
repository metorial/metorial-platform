import { delay } from '@lowerdeck/delay';
import { getId } from '@metorial-subspace/db';
import { providerDeploymentConfigPairInternalService } from '@metorial-subspace/module-provider-internal';
import { enqueueSessionTemplateSyncHash } from '@metorial-subspace/module-session/src/queues/lifecycle/sessionTemplateProvider';
import { McpConnection } from '../../../../../modules/connection/src/mcp/connection';
import { describe, expect, it } from 'vitest';
import { fixtures } from '../../test/fixtures';
import { setupMcpE2ELifecycle } from '../../test/helpers/mcpE2ELifecycle';
import { testDb } from '../../test/setup';

let lifecycle = setupMcpE2ELifecycle();

let defaultToolFilter = {
  type: 'v1.filter',
  filters: [{ type: 'tool_keys', keys: ['echo'] }]
} as const;

let updatedToolFilter = {
  type: 'v1.filter',
  filters: [{ type: 'tool_keys', keys: ['add'] }]
} as const;

let waitFor = async <T>(
  load: () => Promise<T | null>,
  predicate: (value: T) => boolean,
  message: string
) => {
  for (let attempt = 0; attempt < 60; attempt++) {
    let value = await load();
    if (value && predicate(value)) return value;
    await delay(100);
  }

  throw new Error(message);
};

let createTemplateRuntimeContext = async () => {
  let f = fixtures(testDb);
  let tenant = await f.tenant.default();
  let solution = await f.solution.default();
  let environment = await f.environment.default({ tenant });
  let providerSetup = await f.remoteMcpProvider.complete({
    tenant,
    solution,
    environment,
    remoteUrl: `${lifecycle.getRemoteServerBaseUrl()}/full/mcp`,
    protocol: 'streamable_http'
  });
  let pair = await providerDeploymentConfigPairInternalService.useDeploymentConfigPair({
    deployment: providerSetup.providerDeployment,
    config: providerSetup.providerConfig,
    authConfig: null,
    version: providerSetup.providerVersion
  });

  let sessionTemplate = await testDb.sessionTemplate.create({
    data: {
      ...getId('sessionTemplate'),
      status: 'active',
      isInternal: false,
      name: 'Managed session template',
      tenantOid: tenant.oid,
      solutionOid: solution.oid,
      environmentOid: environment.oid
    }
  });
  let sessionTemplateProvider = await testDb.sessionTemplateProvider.create({
    data: {
      ...getId('sessionTemplateProvider'),
      status: 'active',
      toolFilter: defaultToolFilter as any,
      sessionTemplateOid: sessionTemplate.oid,
      providerOid: providerSetup.provider.oid,
      deploymentOid: providerSetup.providerDeployment.oid,
      configOid: providerSetup.providerConfig.oid,
      authConfigOid: null,
      tenantOid: tenant.oid,
      solutionOid: solution.oid,
      environmentOid: environment.oid
    }
  });

  await enqueueSessionTemplateSyncHash(sessionTemplate.id);

  let hashedTemplate = await waitFor(
    async () =>
      await testDb.sessionTemplate.findUnique({
        where: { oid: sessionTemplate.oid }
      }),
    value => !!value.hash,
    'Timed out waiting for initial session template hash'
  );

  let initialWillRotateAt = new Date(Date.now() + 60 * 60 * 1000);
  let ephemeralManagedSession = await testDb.ephemeralManagedSession.create({
    data: {
      ...getId('ephemeralManagedSession'),
      status: 'active',
      maxSessionDurationInMinutes: 60,
      templateHash: hashedTemplate.hash,
      willRotateAt: initialWillRotateAt,
      sessionTemplateOid: sessionTemplate.oid,
      tenantOid: tenant.oid,
      solutionOid: solution.oid,
      environmentOid: environment.oid
    }
  });
  let session = await testDb.session.create({
    data: {
      ...getId('session'),
      status: 'active',
      isEphemeral: true,
      name: 'Managed backing session',
      tenantOid: tenant.oid,
      solutionOid: solution.oid,
      environmentOid: environment.oid,
      ephemeralManagedSessionOid: ephemeralManagedSession.oid
    }
  });
  ephemeralManagedSession = await testDb.ephemeralManagedSession.update({
    where: { oid: ephemeralManagedSession.oid },
    data: {
      currentSessionOid: session.oid
    }
  });

  let sessionProvider = await testDb.sessionProvider.create({
    data: {
      ...getId('sessionProvider'),
      status: 'active',
      isEphemeral: true,
      isParentDeleted: false,
      tag: 'primary',
      toolFilter: defaultToolFilter as any,
      sessionOid: session.oid,
      providerOid: providerSetup.provider.oid,
      deploymentOid: providerSetup.providerDeployment.oid,
      configOid: providerSetup.providerConfig.oid,
      authConfigOid: null,
      tenantOid: tenant.oid,
      solutionOid: solution.oid,
      environmentOid: environment.oid,
      fromTemplateOid: sessionTemplate.oid,
      fromTemplateProviderOid: sessionTemplateProvider.oid
    }
  });

  let initialExpiresAt = new Date(Date.now() + 60 * 60 * 1000);
  let sessionProviderInstance = await testDb.sessionProviderInstance.create({
    data: {
      ...getId('sessionProviderInstance'),
      sessionOid: session.oid,
      sessionProviderOid: sessionProvider.oid,
      pairOid: pair.pair.oid,
      pairVersionOid: pair.version!.oid,
      expiresAt: initialExpiresAt
    }
  });

  return {
    tenant,
    solution,
    environment,
    session,
    sessionTemplate,
    sessionTemplateProvider,
    ephemeralManagedSession,
    sessionProviderInstance,
    initialHash: hashedTemplate.hash!,
    initialWillRotateAt,
    initialExpiresAt
  };
};

describe('sessionTemplateInvalidation.e2e', () => {
  it(
    'forces managed-session rotation and provider-instance expiry when the template hash changes',
    { timeout: 120_000 },
    async () => {
      let ctx = await createTemplateRuntimeContext();

      await testDb.sessionTemplateProvider.update({
        where: { oid: ctx.sessionTemplateProvider.oid },
        data: {
          toolFilter: updatedToolFilter as any
        }
      });

      await enqueueSessionTemplateSyncHash(ctx.sessionTemplate.id);

      let updatedTemplate = await waitFor(
        async () =>
          await testDb.sessionTemplate.findUnique({
            where: { oid: ctx.sessionTemplate.oid }
          }),
        value => value.hash !== ctx.initialHash,
        'Timed out waiting for the session template hash to change'
      );
      let rotatedManagedSession = await waitFor(
        async () =>
          await testDb.ephemeralManagedSession.findUnique({
            where: { oid: ctx.ephemeralManagedSession.oid }
          }),
        value =>
          !!value.willRotateAt &&
          value.willRotateAt.getTime() < ctx.initialWillRotateAt.getTime(),
        'Timed out waiting for EphemeralManagedSession.willRotateAt to expire'
      );
      let expiredProviderInstance = await waitFor(
        async () =>
          await testDb.sessionProviderInstance.findUnique({
            where: { oid: ctx.sessionProviderInstance.oid }
          }),
        value => value.expiresAt.getTime() < ctx.initialExpiresAt.getTime(),
        'Timed out waiting for SessionProviderInstance.expiresAt to expire'
      );

      expect(updatedTemplate.hash).not.toBe(ctx.initialHash);
      expect(rotatedManagedSession.willRotateAt).toBeTruthy();
      expect(rotatedManagedSession.willRotateAt!.getTime()).toBeLessThan(
        ctx.initialWillRotateAt.getTime()
      );
      expect(expiredProviderInstance.expiresAt.getTime()).toBeLessThan(
        ctx.initialExpiresAt.getTime()
      );
    }
  );

  it(
    'does not invalidate runtime state when the template hash stays the same',
    { timeout: 120_000 },
    async () => {
      let ctx = await createTemplateRuntimeContext();
      let initialTemplate = await testDb.sessionTemplate.findUniqueOrThrow({
        where: { oid: ctx.sessionTemplate.oid }
      });

      await enqueueSessionTemplateSyncHash(ctx.sessionTemplate.id);

      await waitFor(
        async () =>
          await testDb.sessionTemplate.findUnique({
            where: { oid: ctx.sessionTemplate.oid }
          }),
        value =>
          value.hash === ctx.initialHash && value.updatedAt.getTime() > initialTemplate.updatedAt.getTime(),
        'Timed out waiting for the no-op session template sync'
      );

      let managedSession = await testDb.ephemeralManagedSession.findUniqueOrThrow({
        where: { oid: ctx.ephemeralManagedSession.oid }
      });
      let providerInstance = await testDb.sessionProviderInstance.findUniqueOrThrow({
        where: { oid: ctx.sessionProviderInstance.oid }
      });

      expect(managedSession.willRotateAt?.getTime()).toBe(ctx.initialWillRotateAt.getTime());
      expect(providerInstance.expiresAt.getTime()).toBe(ctx.initialExpiresAt.getTime());
    }
  );

  it(
    'reuses the incoming connection token on a fresh connection when an ephemeral managed session rotates',
    { timeout: 120_000 },
    async () => {
      let ctx = await createTemplateRuntimeContext();
      let oldConnectionToken = 'session-connection-token';
      let oldConnection = await testDb.sessionConnection.create({
        data: {
          ...getId('sessionConnection'),
          token: oldConnectionToken,
          isEphemeral: true,
          status: 'active',
          transport: 'mcp',
          state: 'connected',
          initState: 'pending',
          isManuallyDisabled: false,
          isReplaced: false,
          mcpTransport: 'streamable_http',
          mcpProtocolVersion: null,
          mcpData: {},
          sessionOid: ctx.session.oid,
          tenantOid: ctx.tenant.oid,
          solutionOid: ctx.solution.oid,
          environmentOid: ctx.environment.oid,
          expiresAt: new Date(Date.now() + 60 * 60 * 1000),
          lastPingAt: new Date()
        }
      });

      await testDb.ephemeralManagedSession.update({
        where: { oid: ctx.ephemeralManagedSession.oid },
        data: {
          willRotateAt: new Date(Date.now() - 1000)
        }
      });

      let mcpConnection = await McpConnection.create({
        sessionId: ctx.session.id,
        solutionId: ctx.solution.id,
        tenantId: ctx.tenant.id,
        connectionToken: oldConnectionToken,
        mcpTransport: 'streamable_http'
      });

      let refreshedOldConnection = await testDb.sessionConnection.findUniqueOrThrow({
        where: { oid: oldConnection.oid }
      });
      let activeTokenConnection = await testDb.sessionConnection.findUniqueOrThrow({
        where: { token: oldConnectionToken }
      });

      expect(mcpConnection.session.id).not.toBe(ctx.session.id);
      expect(mcpConnection.connection?.token).toBe(oldConnectionToken);
      expect(mcpConnection.connection?.oid).toBe(activeTokenConnection.oid);
      expect(activeTokenConnection.sessionOid).toBe(mcpConnection.session.oid);
      expect(refreshedOldConnection.token).not.toBe(oldConnectionToken);
      expect(refreshedOldConnection.isReplaced).toBe(true);
      expect(activeTokenConnection.oid).not.toBe(oldConnection.oid);
    }
  );
});
