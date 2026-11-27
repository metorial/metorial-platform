import { type BootstrappedOrganization, eventually, expectOk, uniqueId } from '@metorial/e2e';
import { loadOrganizationFixture, subspaceDb } from '@metorial/e2e/db';
import { resolveMetorialFacing } from '@metorial-subspace/module-tenant';
import { ensureProviderType } from '@metorial-subspace/provider-utils';
import { expect } from 'vitest';
import { callbackInternalService } from '../src';

export let scopeOf = async (org: BootstrappedOrganization) => {
  let fixture = await loadOrganizationFixture(org.ids);
  let scope = await resolveMetorialFacing({ instance: fixture.instance });

  return {
    fixture,
    instance: fixture.instance,
    auditScope: fixture.auditScope,
    ...scope
  };
};

/**
 * Remote MCP providers report `triggers.status = 'disabled'`. Repointing the test's own provider at
 * an otherwise identical type with triggers enabled lets callbacks be enabled for it while its
 * backend stays shuttle, which implements no callbacks API.
 */
export let enableProviderTriggers = async (
  providerId: string,
  webhookRegistration: 'supported' | 'unsupported' = 'unsupported'
) => {
  let provider = await subspaceDb.provider.findUniqueOrThrow({
    where: { id: providerId },
    include: { type: true }
  });

  let type = await ensureProviderType(`${provider.type.name} with triggers`, {
    ...provider.type.attributes,
    triggers: { status: 'enabled', webhookRegistration: { status: webhookRegistration } }
  });
  await subspaceDb.provider.update({
    where: { oid: provider.oid },
    data: { typeOid: type.oid }
  });

  return type;
};

export let createIntegration = async (org: BootstrappedOrganization) =>
  expectOk(
    await org.clients.instance.post('/integrations', { name: uniqueId('integration') })
  );

export let createDeployment = async (org: BootstrappedOrganization, providerId: string) =>
  expectOk(
    await org.clients.instance.post('/provider-deployments', {
      provider_id: providerId,
      name: uniqueId('deployment')
    })
  );

export let createIntegrationProvider = async (
  org: BootstrappedOrganization,
  input: { providerId: string; callbacks?: boolean; description?: string }
) => {
  let integration = await createIntegration(org);
  let deployment = await createDeployment(org, input.providerId);
  let name = uniqueId('integration-provider');

  let response = await org.clients.instance.post('/integration-providers', {
    integration_id: integration.id,
    provider_id: input.providerId,
    provider_deployment_id: deployment.id,
    name,
    description: input.description,
    callbacks: input.callbacks ? { status: 'enabled' } : undefined
  });

  return { integration, deployment, name, response };
};

export let setCallbacks = async (
  org: BootstrappedOrganization,
  integrationProviderId: string,
  status: 'enabled' | 'disabled'
) =>
  expectOk(
    await org.clients.instance.patch(`/integration-providers/${integrationProviderId}`, {
      callbacks: { status }
    })
  );

export let createIntegrationInstance = async (
  org: BootstrappedOrganization,
  input: { integrationId: string; providerId: string }
) => {
  let integrationInstance = expectOk(
    await org.clients.instance.post('/integration-instances', {
      integration_id: input.integrationId,
      name: uniqueId('integration-instance'),
      providers: [{ provider_id: input.providerId }]
    })
  );

  let integrationInstanceProvider =
    await subspaceDb.integrationInstanceProvider.findFirstOrThrow({
      where: { integrationInstance: { id: integrationInstance.id } }
    });

  return { integrationInstance, integrationInstanceProvider };
};

export let findActiveCallbacks = (integrationProviderId: string) =>
  subspaceDb.callback.findMany({
    where: { integrationProvider: { id: integrationProviderId }, status: 'active' }
  });

export let waitForCallbackSync = (callbackId: string) =>
  eventually(
    async () => {
      let callback = await subspaceDb.callback.findUniqueOrThrow({
        where: { id: callbackId }
      });
      expect(callback.syncStatus).not.toBe('pending');
      return callback;
    },
    { timeoutMs: 60_000, intervalMs: 500 }
  );

export let markCallbackSynced = (callbackId: string) =>
  subspaceDb.callback.update({
    where: { id: callbackId },
    data: {
      syncStatus: 'synced',
      lastSyncErrorCode: null,
      lastSyncErrorMessage: null,
      lastSyncedAt: new Date()
    }
  });

export let provisionCallbackInstance = (input: {
  callbackId: string;
  integrationInstanceProviderId: string;
}) =>
  eventually(
    async () => {
      let callback = await markCallbackSynced(input.callbackId);
      await callbackInternalService.reconcileCallbackInstanceForIntegrationInstanceProvider({
        integrationInstanceProviderId: input.integrationInstanceProviderId
      });

      let callbackInstance = await subspaceDb.callbackInstance.findFirst({
        where: { callbackOid: callback.oid, status: 'active' }
      });
      if (!callbackInstance)
        throw new Error(`No callback instance for ${input.callbackId} yet`);
      return callbackInstance;
    },
    { timeoutMs: 60_000, intervalMs: 1_000 }
  );

export let waitForCallbackInstanceSync = (callbackInstanceId: string) =>
  eventually(
    async () => {
      let callbackInstance = await subspaceDb.callbackInstance.findUniqueOrThrow({
        where: { id: callbackInstanceId }
      });
      expect(callbackInstance.syncStatus).not.toBe('pending');
      return callbackInstance;
    },
    { timeoutMs: 60_000, intervalMs: 500 }
  );
