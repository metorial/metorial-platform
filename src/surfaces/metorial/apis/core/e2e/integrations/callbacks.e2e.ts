import { ensureProviderType } from '@metorial-subspace/provider-utils';
import {
  createRemoteProvider,
  expectError,
  expectOk,
  expectPresented,
  listAll,
  uniqueId,
  useMcpTestServer,
  useOrganization,
  type BootstrappedOrganization,
  type RemoteProvider
} from '@metorial/e2e';
import { subspaceDb } from '@metorial/e2e/db';
import { beforeAll, describe, expect, it } from 'vitest';
import {
  createProviderDeployment,
  expectResponses,
  expectRoutesAuth,
  ids,
  invalid,
  listAuth,
  managementApi,
  notFound,
  resourceAuth
} from './_shared';

let dashboardOnlyListAuth = { ...listAuth, instance: 404 };

// Incoming webhooks are read from every provider backend, including Slates, which the e2e
// stack does not run; requests that reach the service outlive Bun's 10s idle timeout.
let incomingWebhookAuth = {
  none: 401,
  instance: 404,
  otherSession: 404,
  otherManagement: 404
};

let enableProviderTriggers = async (providerId: string) => {
  let current = await subspaceDb.provider.findUniqueOrThrow({
    where: { id: providerId },
    include: { type: true }
  });
  let type = await ensureProviderType(`${current.type.name} with triggers`, {
    ...current.type.attributes,
    triggers: { status: 'enabled', webhookRegistration: { status: 'unsupported' } }
  });
  await subspaceDb.provider.update({
    where: { oid: current.oid },
    data: { typeOid: type.oid }
  });
};

describe('api-core integrations: callbacks', () => {
  let org = useOrganization();
  let otherOrg = useOrganization();
  let server = useMcpTestServer();

  let provider: RemoteProvider;
  let triggered: RemoteProvider;
  let otherProvider: RemoteProvider;
  let deployment: any;
  let triggeredDeployment: any;
  let otherDeployment: any;

  beforeAll(async () => {
    provider = await createRemoteProvider(org.clients.instance, { url: server.url });
    triggered = await createRemoteProvider(org.clients.instance, { url: server.url });
    otherProvider = await createRemoteProvider(otherOrg.clients.instance, { url: server.url });
    await enableProviderTriggers(triggered.providerId);

    deployment = await createProviderDeployment(org.clients.instance, provider.providerId);
    triggeredDeployment = await createProviderDeployment(
      org.clients.instance,
      triggered.providerId
    );
    otherDeployment = await createProviderDeployment(
      otherOrg.clients.instance,
      otherProvider.providerId
    );
  }, 180_000);

  let setupIntegration = async (
    kind: 'plain' | 'triggered' | 'foreign' = 'triggered',
    target: BootstrappedOrganization = kind === 'foreign' ? otherOrg : org
  ) => {
    let [providerId, deploymentId] =
      kind === 'plain'
        ? [provider.providerId, deployment.id]
        : kind === 'triggered'
          ? [triggered.providerId, triggeredDeployment.id]
          : [otherProvider.providerId, otherDeployment.id];

    let integration = expectOk(
      await target.clients.instance.post('/integrations', {
        name: uniqueId('e2e-integration')
      })
    );
    let integrationProvider = expectOk(
      await target.clients.instance.post('/integration-providers', {
        integration_id: integration.id,
        provider_id: providerId,
        provider_deployment_id: deploymentId,
        description: 'Provider events'
      })
    );
    return { integration, integrationProvider };
  };

  let createCallback = async (body: Record<string, unknown> = {}) => {
    let setup = await setupIntegration();
    let callback = expectOk(
      await org.clients.instance.post('/callbacks', {
        integration_id: setup.integration.id,
        integration_provider_id: setup.integrationProvider.id,
        ...body
      })
    );
    return { ...setup, callback };
  };

  it('authenticates every callback route per credential', async () => {
    let { callback } = await createCallback();

    await expectRoutesAuth(org, otherOrg, [
      { path: '/callbacks', expected: listAuth },
      { path: '/callback-instances', expected: listAuth },
      { path: '/callback-events', expected: listAuth },
      { path: '/webhook-registrations', expected: dashboardOnlyListAuth },
      { path: '/incoming-webhooks', expected: incomingWebhookAuth },
      { path: `/incoming-webhooks/${uniqueId('iwh')}`, expected: incomingWebhookAuth },
      { path: `/callbacks/${callback.id}`, expected: resourceAuth }
    ]);
  }, 180_000);

  it('rejects invalid callback bodies and queries', async () => {
    let { integration, integrationProvider, callback } = await createCallback();
    let api = org.clients.instance;
    let management = managementApi(org);

    await expectResponses([
      invalid('callback without integration', () => api.post('/callbacks', {})),
      invalid('callback without integration provider', () =>
        api.post('/callbacks', { integration_id: integration.id })
      ),
      invalid('callback with numeric name', () =>
        api.post('/callbacks', {
          integration_id: integration.id,
          integration_provider_id: integrationProvider.id,
          name: 5
        })
      ),
      invalid('callback update with string metadata', () =>
        api.patch(`/callbacks/${callback.id}`, { metadata: 'x' })
      ),
      invalid('callback update with numeric description', () =>
        api.patch(`/callbacks/${callback.id}`, { description: 5 })
      ),
      invalid('callback list with unknown status', () =>
        api.get('/callbacks', { query: { status: 'paused' } })
      ),
      invalid('callback event list with unknown status', () =>
        api.get('/callback-events', { query: { status: 'bogus' } })
      ),
      invalid('webhook registration without provider', () =>
        management.post('/webhook-registrations', { name: 'x' })
      ),
      invalid('webhook registration without name', () =>
        management.post('/webhook-registrations', { provider_id: provider.providerId })
      ),
      invalid('webhook registration setup with string config', () =>
        management.post(`/webhook-registrations/${uniqueId('whr')}/setup`, {
          user_config: 'x'
        })
      ),
      invalid('incoming webhook list with unknown status', () =>
        management.get('/incoming-webhooks', { query: { status: 'bogus' } })
      )
    ]);
  }, 180_000);

  it('rejects callbacks for providers without trigger support', async () => {
    let { integration, integrationProvider } = await setupIntegration('plain');
    let api = org.clients.instance;

    await expectResponses([
      {
        label: 'create callback',
        call: () =>
          api.post('/callbacks', {
            integration_id: integration.id,
            integration_provider_id: integrationProvider.id
          }),
        status: 400,
        code: 'callbacks_not_supported'
      },
      {
        label: 'enable callbacks on update',
        call: () =>
          api.patch(`/integration-providers/${integrationProvider.id}`, {
            callbacks: { status: 'enabled' }
          }),
        status: 400,
        code: 'callbacks_not_supported'
      }
    ]);

    expect(
      await listAll(api, '/callbacks', {
        query: { integration_provider_id: integrationProvider.id }
      })
    ).toEqual([]);
    expect(
      expectOk(await api.get(`/integration-providers/${integrationProvider.id}`)).callbacks
    ).toMatchObject({ status: 'disabled', callback_id: null });
  }, 180_000);

  it('rejects callback references owned by other integrations or organizations', async () => {
    let { integration, integrationProvider } = await setupIntegration();
    let sibling = await setupIntegration();
    let foreign = await setupIntegration('foreign');
    let api = org.clients.instance;

    await expectResponses([
      notFound('integration provider of another integration', () =>
        api.post('/callbacks', {
          integration_id: integration.id,
          integration_provider_id: sibling.integrationProvider.id
        })
      ),
      notFound('foreign integration', () =>
        api.post('/callbacks', {
          integration_id: foreign.integration.id,
          integration_provider_id: integrationProvider.id
        })
      ),
      notFound('foreign integration provider', () =>
        api.post('/callbacks', {
          integration_id: integration.id,
          integration_provider_id: foreign.integrationProvider.id
        })
      ),
      notFound('unknown integration provider', () =>
        api.post('/callbacks', {
          integration_id: integration.id,
          integration_provider_id: uniqueId('inp')
        })
      )
    ]);

    for (let target of [integrationProvider, sibling.integrationProvider]) {
      expect(
        await listAll(api, '/callbacks', { query: { integration_provider_id: target.id } })
      ).toEqual([]);
    }
  }, 180_000);

  it('creates, serves, updates and deletes a callback', async () => {
    let { integration, integrationProvider, callback } = await createCallback({
      name: 'Provider callback',
      description: 'Receives events'
    });
    let api = org.clients.instance;

    expectPresented(callback, 'callback');
    expect(callback).toMatchObject({
      status: 'active',
      name: 'Provider callback',
      description: 'Receives events',
      integration_id: integration.id,
      integration_provider_id: integrationProvider.id
    });
    expect(callback.provider.id).toBe(triggered.providerId);

    expect(
      expectOk(await api.get(`/integration-providers/${integrationProvider.id}`)).callbacks
    ).toMatchObject({ status: 'enabled', callback_id: callback.id });
    expect(expectOk(await api.get(`/callbacks/${callback.id}`))).toMatchObject({
      id: callback.id,
      name: 'Provider callback'
    });
    expectPresented(
      expectOk(
        await org.clients.rest.get(
          `/dashboard/instances/${org.ids.instanceId}/callbacks/${callback.id}`
        )
      ),
      'callback'
    );

    await expectResponses([
      {
        label: 'second callback for the same integration provider',
        call: () =>
          api.post('/callbacks', {
            integration_id: integration.id,
            integration_provider_id: integrationProvider.id
          }),
        status: 400,
        code: 'callback_exists'
      }
    ]);

    for (let query of [
      { integration_id: integration.id },
      { integration_provider_id: integrationProvider.id },
      { id: callback.id, provider_id: triggered.providerId }
    ]) {
      expect(ids(await listAll(api, '/callbacks', { query }))).toEqual([callback.id]);
    }
    expect(
      await listAll(api, '/callbacks', {
        query: { id: callback.id, provider_id: provider.providerId }
      })
    ).toEqual([]);
    expect(
      await listAll(api, '/callback-instances', { query: { callback_id: callback.id } })
    ).toEqual([]);
    expect(
      await listAll(api, '/callback-events', { query: { callback_id: callback.id } })
    ).toEqual([]);

    let updated = expectOk(
      await api.patch(`/callbacks/${callback.id}`, {
        name: 'Renamed callback',
        description: null,
        metadata: { a: 1 }
      })
    );
    expectPresented(updated, 'callback');
    expect(updated).toMatchObject({
      name: 'Renamed callback',
      description: null,
      metadata: { a: 1 }
    });

    await expectResponses([
      notFound('read from another organization', () =>
        otherOrg.clients.instance.get(`/callbacks/${callback.id}`)
      ),
      notFound('update from another organization', () =>
        otherOrg.clients.instance.patch(`/callbacks/${callback.id}`, { name: 'x' })
      ),
      notFound('delete from another organization', () =>
        otherOrg.clients.instance.delete(`/callbacks/${callback.id}`)
      )
    ]);
    expect(expectOk(await api.get(`/callbacks/${callback.id}`)).name).toBe('Renamed callback');

    let deleted = expectOk(await api.delete(`/callbacks/${callback.id}`));
    expectPresented(deleted, 'callback');
    expect(deleted).toMatchObject({ id: callback.id, status: 'archived' });

    expect(expectOk(await api.get(`/callbacks/${callback.id}`)).status).toBe('archived');
    expect(
      await listAll(api, '/callbacks', { query: { integration_id: integration.id } })
    ).toEqual([]);
    expect(
      ids(
        await listAll(api, '/callbacks', {
          query: { integration_id: integration.id, status: 'archived' }
        })
      )
    ).toEqual([callback.id]);
    expect(
      expectOk(await api.get(`/integration-providers/${integrationProvider.id}`)).callbacks
    ).toMatchObject({ status: 'disabled', callback_id: null });

    await expectResponses([
      {
        label: 'delete archived callback',
        call: () => api.delete(`/callbacks/${callback.id}`),
        status: 400,
        code: 'callback_not_active'
      },
      {
        label: 'update archived callback',
        call: () => api.patch(`/callbacks/${callback.id}`, { name: 'x' }),
        status: 400,
        code: 'callback_not_active'
      }
    ]);

    let reenabled = expectOk(
      await api.patch(`/integration-providers/${integrationProvider.id}`, {
        callbacks: { status: 'enabled' }
      })
    );
    expect(reenabled.callbacks.status).toBe('enabled');
    expect(reenabled.callbacks.callback_id).not.toBe(callback.id);
    expect(
      ids(await listAll(api, '/callbacks', { query: { integration_id: integration.id } }))
    ).toEqual([reenabled.callbacks.callback_id]);
  }, 180_000);

  it('pages through callbacks', async () => {
    let created = [];
    for (let i = 0; i < 3; i++) created.push((await createCallback()).callback);
    let providerQuery = { provider_id: triggered.providerId };

    let paged = await listAll(org.clients.instance, '/callbacks', {
      query: providerQuery,
      limit: 2
    });
    expect(ids(paged)).toEqual(expect.arrayContaining(ids(created)));
    expect(new Set(ids(paged)).size).toBe(paged.length);
    expect(
      await listAll(otherOrg.clients.instance, '/callbacks', { query: providerQuery })
    ).toEqual([]);
  }, 180_000);

  it('returns 404 for unknown callbacks, callback instances and events', async () => {
    let api = org.clients.instance;
    let management = managementApi(org);

    await expectResponses([
      notFound('unknown callback', () => api.get(`/callbacks/${uniqueId('cb')}`)),
      notFound('update unknown callback', () =>
        api.patch(`/callbacks/${uniqueId('cb')}`, { name: 'x' })
      ),
      notFound('unknown callback instance', () =>
        api.get(`/callback-instances/${uniqueId('cbi')}`)
      ),
      notFound('unknown callback event', () => api.get(`/callback-events/${uniqueId('cbe')}`)),
      notFound('unknown webhook registration', () =>
        management.get(`/webhook-registrations/${uniqueId('whr')}`)
      )
    ]);
  });

  it('only creates webhook registrations from the dashboard API for supporting providers', async () => {
    let management = managementApi(org);
    let name = uniqueId('e2e-webhook');

    await expectResponses([
      {
        label: 'provider without webhook registration support',
        call: () =>
          management.post('/webhook-registrations', {
            provider_id: provider.providerId,
            name
          }),
        status: 400,
        code: 'webhook_registration_not_supported'
      },
      notFound('foreign provider', () =>
        management.post('/webhook-registrations', {
          provider_id: otherProvider.providerId,
          name
        })
      ),
      notFound('unknown provider', () =>
        management.post('/webhook-registrations', { provider_id: uniqueId('pro'), name })
      ),
      notFound('instance key', () =>
        org.clients.instance.post('/webhook-registrations', {
          provider_id: provider.providerId,
          name
        })
      )
    ]);

    expect(
      await listAll(management, '/webhook-registrations', {
        query: { provider_id: provider.providerId }
      })
    ).toEqual([]);

    let session = expectOk(
      await org.clients.rest.get(
        `/dashboard/instances/${org.ids.instanceId}/webhook-registrations`
      )
    );
    expect(session.items).toEqual([]);
    expectError(await org.clients.instance.get(`/webhook-registrations`), 404);
  }, 180_000);
});
