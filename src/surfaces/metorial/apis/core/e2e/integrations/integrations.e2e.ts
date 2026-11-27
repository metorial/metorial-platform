import {
  createRemoteProvider,
  eventually,
  expectError,
  expectOk,
  expectPresented,
  listAll,
  uniqueId,
  useMcpTestServer,
  useOrganization,
  type RemoteProvider
} from '@metorial/e2e';
import { beforeAll, describe, expect, it } from 'vitest';
import {
  createProviderDeployment,
  expectResponses,
  expectRoutesAuth,
  ids,
  inMinutes,
  invalid,
  listAuth,
  notFound,
  resourceAuth,
  workerTimeout
} from './_shared';

let echoOnly = { type: 'tool_keys', keys: ['echo'] };

describe('api-core integrations: integrations', () => {
  let org = useOrganization();
  let otherOrg = useOrganization();
  let server = useMcpTestServer();

  let provider: RemoteProvider;
  let deployment: any;
  let otherProvider: RemoteProvider;
  let otherDeployment: any;

  beforeAll(async () => {
    provider = await createRemoteProvider(org.clients.instance, { url: server.url });
    otherProvider = await createRemoteProvider(otherOrg.clients.instance, { url: server.url });

    deployment = await createProviderDeployment(org.clients.instance, provider.providerId);
    otherDeployment = await createProviderDeployment(
      otherOrg.clients.instance,
      otherProvider.providerId
    );
  }, 180_000);

  let createIntegration = async (
    body: Record<string, unknown> = {},
    client = org.clients.instance
  ) =>
    expectOk(
      await client.post('/integrations', { name: uniqueId('e2e-integration'), ...body })
    );

  let attachProvider = async (integrationId: string, body: Record<string, unknown> = {}) =>
    expectOk(
      await org.clients.instance.post('/integration-providers', {
        integration_id: integrationId,
        provider_id: provider.providerId,
        provider_deployment_id: deployment.id,
        ...body
      })
    );

  let createInstance = async (integrationId: string, body: Record<string, unknown> = {}) =>
    expectOk(
      await org.clients.instance.post('/integration-instances', {
        integration_id: integrationId,
        name: uniqueId('e2e-instance'),
        ...body
      })
    );

  let setupIntegration = async (body: Record<string, unknown> = {}) => {
    let integration = await createIntegration(body);
    let integrationProvider = await attachProvider(integration.id);
    return { integration, integrationProvider };
  };

  let setupInstance = async () => {
    let { integration, integrationProvider } = await setupIntegration();
    let integrationInstance = await createInstance(integration.id, {
      providers: [{ provider_id: integrationProvider.id }]
    });
    return {
      integration,
      integrationProvider,
      integrationInstance,
      integrationInstanceProvider: integrationInstance.providers[0]
    };
  };

  let createGroup = async (integrationInstanceProviderId: string) =>
    expectOk(
      await org.clients.instance.post('/integration-instance-groups', {
        name: uniqueId('e2e-group'),
        providers: [{ integration_instance_provider_id: integrationInstanceProviderId }]
      })
    );

  let createSetupSession = async (integrationId: string, body: Record<string, unknown> = {}) =>
    expectOk(
      await org.clients.instance.post('/integration-setup-sessions', {
        integration_id: integrationId,
        name: uniqueId('e2e-setup'),
        ...body
      })
    );

  it('authenticates every integration route per credential', async () => {
    let {
      integration,
      integrationProvider,
      integrationInstance,
      integrationInstanceProvider
    } = await setupInstance();
    let group = await createGroup(integrationInstanceProvider.id);
    let setupSession = await createSetupSession(integration.id);
    let template = expectOk(
      await org.clients.instance.post('/provider-templates', {
        name: uniqueId('e2e-template'),
        integration_id: (await setupIntegration()).integration.id
      })
    );

    let resources: [string, string][] = [
      ['integrations', integration.id],
      ['integration-providers', integrationProvider.id],
      ['integration-instances', integrationInstance.id],
      ['integration-instance-providers', integrationInstanceProvider.id],
      ['integration-instance-groups', group.id],
      ['integration-instance-group-providers', group.providers[0].id],
      ['integration-setup-sessions', setupSession.id],
      ['provider-templates', template.id]
    ];

    await expectRoutesAuth(org, otherOrg, [
      ...resources
        .filter(([path]) => path !== 'integration-setup-sessions')
        .map(([path]) => ({ path: `/${path}`, expected: listAuth })),
      ...resources.map(([path, id]) => ({ path: `/${path}/${id}`, expected: resourceAuth }))
    ]);
  }, 180_000);

  it('rejects invalid integration bodies and queries', async () => {
    let {
      integration,
      integrationProvider,
      integrationInstance,
      integrationInstanceProvider
    } = await setupInstance();
    let group = await createGroup(integrationInstanceProvider.id);
    let api = org.clients.instance;

    await expectResponses([
      invalid('integration without name', () => api.post('/integrations', {})),
      invalid('integration with numeric name', () => api.post('/integrations', { name: 1 })),
      invalid('integration with string flag', () =>
        api.post('/integrations', { name: 'x', can_override_tool_filters: 'yes' })
      ),
      invalid('integration update with string metadata', () =>
        api.patch(`/integrations/${integration.id}`, { metadata: 'x' })
      ),
      invalid('integration list with unknown status', () =>
        api.get('/integrations', { query: { status: 'bogus' } })
      ),
      invalid('integration provider without deployment', () =>
        api.post('/integration-providers', {
          integration_id: integration.id,
          provider_id: provider.providerId
        })
      ),
      invalid('integration provider with unknown tool filter', () =>
        api.post('/integration-providers', {
          integration_id: integration.id,
          provider_id: provider.providerId,
          provider_deployment_id: deployment.id,
          tool_filters: { type: 'everything' }
        })
      ),
      invalid('integration provider with unknown callback status', () =>
        api.post('/integration-providers', {
          integration_id: integration.id,
          provider_id: provider.providerId,
          provider_deployment_id: deployment.id,
          callbacks: { status: 'maybe' }
        })
      ),
      invalid('instance without name', () =>
        api.post('/integration-instances', { integration_id: integration.id })
      ),
      invalid('instance with provider missing provider_id', () =>
        api.post('/integration-instances', {
          integration_id: integration.id,
          name: 'x',
          providers: [{}]
        })
      ),
      invalid('instance list with unknown status', () =>
        api.get('/integration-instances', { query: { status: 'live' } })
      ),
      invalid('instance provider with string override flag', () =>
        api.put(
          `/integration-instances/${integrationInstance.id}/providers/${integrationProvider.id}`,
          { is_override_tool_filter: 'yes' }
        )
      ),
      invalid('group without name', () => api.post('/integration-instance-groups', {})),
      invalid('group with provider missing id', () =>
        api.post('/integration-instance-groups', { name: 'x', providers: [{}] })
      ),
      invalid('group provider with numeric tool filter', () =>
        api.put(
          `/integration-instance-groups/${group.id}/providers/${integrationInstanceProvider.id}`,
          { tool_filters: 5 }
        )
      ),
      invalid('setup session without name', () =>
        api.post('/integration-setup-sessions', { integration_id: integration.id })
      ),
      invalid('setup session with unknown layout', () =>
        api.post('/integration-setup-sessions', {
          integration_id: integration.id,
          name: 'x',
          configuration: { ui: { layout: 'grid' } }
        })
      ),
      invalid('setup session with invalid expiry', () =>
        api.post('/integration-setup-sessions', {
          integration_id: integration.id,
          name: 'x',
          expires_at: 'not-a-date'
        })
      ),
      invalid('provider template without integration', () =>
        api.post('/provider-templates', { name: 'x' })
      ),
      invalid('provider template update with numeric name', () =>
        api.patch(`/provider-templates/${uniqueId('ptl')}`, { name: 1 })
      )
    ]);
  }, 180_000);

  it('creates, updates and archives an integration', async () => {
    let name = uniqueId('e2e-integration');
    let created = await createIntegration({
      name,
      description: 'Initial',
      metadata: { a: 1 },
      can_attach_custom_tool_filters: true,
      can_override_tool_filters: false,
      use_integration_name_in_tool_names: true
    });
    expectPresented(created, 'integration');
    expect(created).toMatchObject({
      status: 'active',
      name,
      description: 'Initial',
      metadata: { a: 1 },
      providers: [],
      implementation: null,
      archived_at: null,
      configuration: {
        can_attach_custom_tool_filters: true,
        can_override_tool_filters: false,
        use_integration_name_in_tool_names: true
      }
    });
    expect(created.slug).toEqual(expect.any(String));

    let dashboard = expectOk(
      await org.clients.management.get(
        `/instances/${org.ids.instanceId}/integrations/${created.id}`
      )
    );
    expectPresented(dashboard, 'integration');
    expect(dashboard.id).toBe(created.id);

    let renamed = uniqueId('e2e-renamed');
    let updated = expectOk(
      await org.clients.instance.patch(`/integrations/${created.id}`, {
        name: renamed,
        description: null,
        metadata: { b: 2 }
      })
    );
    expect(updated).toMatchObject({
      name: renamed,
      description: null,
      metadata: { b: 2 },
      configuration: { can_attach_custom_tool_filters: true }
    });

    let archived = expectOk(await org.clients.instance.delete(`/integrations/${created.id}`));
    expect(archived.status).toBe('archived');
    expect(archived.archived_at).toEqual(expect.any(String));

    let fetched = expectOk(await org.clients.instance.get(`/integrations/${created.id}`));
    expect(fetched).toMatchObject({ status: 'archived', name: renamed });

    expect(
      ids(await listAll(org.clients.instance, '/integrations', { query: { id: created.id } }))
    ).toEqual([]);
    expect(
      ids(
        await listAll(org.clients.instance, '/integrations', {
          query: { id: created.id, status: 'archived' }
        })
      )
    ).toEqual([created.id]);

    await expectResponses([
      {
        label: 'update archived integration',
        call: () => org.clients.instance.patch(`/integrations/${created.id}`, { name: 'x' }),
        status: 410,
        code: 'gone'
      },
      {
        label: 'archive archived integration',
        call: () => org.clients.instance.delete(`/integrations/${created.id}`),
        status: 410,
        code: 'gone'
      },
      {
        label: 'attach provider to archived integration',
        call: () =>
          org.clients.instance.post('/integration-providers', {
            integration_id: created.id,
            provider_id: provider.providerId,
            provider_deployment_id: deployment.id
          }),
        status: 400,
        code: 'use_after_delete'
      },
      {
        label: 'create instance of archived integration',
        call: () =>
          org.clients.instance.post('/integration-instances', {
            integration_id: created.id,
            name: 'x'
          }),
        status: 400,
        code: 'use_after_delete'
      }
    ]);
  }, 180_000);

  it('pages through integrations and filters them by provider', async () => {
    let first = await setupIntegration();
    let second = await setupIntegration();
    let plain = await createIntegration();

    let paged = await listAll(org.clients.instance, '/integrations', {
      query: { provider_id: provider.providerId },
      limit: 2
    });
    let pagedIds = ids(paged);
    expect(pagedIds).toEqual(
      expect.arrayContaining([first.integration.id, second.integration.id])
    );
    expect(pagedIds).not.toContain(plain.id);
    expect(new Set(pagedIds).size).toBe(pagedIds.length);
    for (let item of paged) expectPresented(item, 'integration');

    let byIntegrationProvider = await listAll(org.clients.instance, '/integrations', {
      query: { integration_provider_id: first.integrationProvider.id }
    });
    expect(ids(byIntegrationProvider)).toEqual([first.integration.id]);

    let all = await listAll(org.clients.instance, '/integrations', { limit: 3 });
    expect(ids(all)).toEqual(
      expect.arrayContaining([first.integration.id, second.integration.id, plain.id])
    );

    expect(
      await listAll(otherOrg.clients.instance, '/integrations', {
        query: { id: first.integration.id }
      })
    ).toEqual([]);
    let foreignFilter = await otherOrg.clients.instance.get('/integrations', {
      query: { integration_provider_id: first.integrationProvider.id }
    });
    expect(
      foreignFilter.status === 404 ||
        (foreignFilter.status === 200 && foreignFilter.body.items.length === 0)
    ).toBe(true);
  }, 180_000);

  it('attaches providers and rejects duplicates and foreign references', async () => {
    let integration = await createIntegration();
    let integrationProvider = await attachProvider(integration.id, {
      name: 'Attached',
      metadata: { a: 1 }
    });
    expectPresented(integrationProvider, 'integration.provider');
    expect(integrationProvider).toMatchObject({
      status: 'active',
      integration_id: integration.id,
      provider_id: provider.providerId,
      deployment_id: deployment.id,
      name: 'Attached',
      metadata: { a: 1 },
      tool_filter: { type: 'allow_all', ignore_parent_filters: false },
      callbacks: {
        object: 'integration.provider.callbacks',
        status: 'disabled',
        callback_id: null
      }
    });

    let fetchedIntegration = expectOk(
      await org.clients.instance.get(`/integrations/${integration.id}`)
    );
    expect(ids(fetchedIntegration.providers)).toEqual([integrationProvider.id]);

    let filtered = expectOk(
      await org.clients.instance.patch(`/integration-providers/${integrationProvider.id}`, {
        name: 'Renamed',
        tool_filters: echoOnly
      })
    );
    expect(filtered.name).toBe('Renamed');
    expect(filtered.tool_filter).toMatchObject({ type: 'filter' });

    for (let query of [
      { integration_id: integration.id },
      { provider_id: provider.providerId, integration_id: integration.id },
      { provider_deployment_id: deployment.id, integration_id: integration.id },
      { id: integrationProvider.id }
    ]) {
      expect(
        ids(await listAll(org.clients.instance, '/integration-providers', { query }))
      ).toEqual([integrationProvider.id]);
    }

    let otherIntegration = await createIntegration({}, otherOrg.clients.instance);

    await expectResponses([
      {
        label: 'duplicate provider',
        call: () =>
          org.clients.instance.post('/integration-providers', {
            integration_id: integration.id,
            provider_id: provider.providerId,
            provider_deployment_id: deployment.id
          }),
        status: 400,
        code: 'integration_provider_exists'
      },
      notFound('foreign integration', () =>
        org.clients.instance.post('/integration-providers', {
          integration_id: otherIntegration.id,
          provider_id: provider.providerId,
          provider_deployment_id: deployment.id
        })
      ),
      notFound('foreign provider', () =>
        org.clients.instance.post('/integration-providers', {
          integration_id: integration.id,
          provider_id: otherProvider.providerId,
          provider_deployment_id: deployment.id
        })
      ),
      notFound('foreign deployment', () =>
        org.clients.instance.post('/integration-providers', {
          integration_id: integration.id,
          provider_id: provider.providerId,
          provider_deployment_id: otherDeployment.id
        })
      ),
      notFound('foreign deployment on update', () =>
        org.clients.instance.patch(`/integration-providers/${integrationProvider.id}`, {
          provider_deployment_id: otherDeployment.id
        })
      )
    ]);

    let archived = expectOk(
      await org.clients.instance.delete(`/integration-providers/${integrationProvider.id}`)
    );
    expect(archived.status).toBe('archived');
    expect(
      expectOk(await org.clients.instance.get(`/integrations/${integration.id}`)).providers
    ).toEqual([]);
    expectError(
      await org.clients.instance.patch(`/integration-providers/${integrationProvider.id}`, {
        name: 'x'
      }),
      410,
      'gone'
    );
  }, 180_000);

  it('creates instances that become active once every provider is set', async () => {
    let { integration, integrationProvider } = await setupIntegration();

    let draft = await createInstance(integration.id, {
      description: 'Draft',
      metadata: { a: 1 }
    });
    expectPresented(draft, 'integration.instance');
    expect(draft).toMatchObject({
      status: 'draft',
      integration_id: integration.id,
      description: 'Draft',
      metadata: { a: 1 },
      providers: [],
      identity_actor_id: null,
      identity_id: null
    });

    let instanceProvider = expectOk(
      await org.clients.instance.put(
        `/integration-instances/${draft.id}/providers/${integrationProvider.id}`,
        { tool_filters: echoOnly }
      )
    );
    expectPresented(instanceProvider, 'integration.instance.provider');
    expect(instanceProvider).toMatchObject({
      status: 'active',
      integration_id: integration.id,
      integration_instance_id: draft.id,
      is_override_tool_filter: false
    });
    expect(instanceProvider.provider.id).toBe(provider.providerId);

    let activated = expectOk(
      await org.clients.instance.get(`/integration-instances/${draft.id}`)
    );
    expect(activated.status).toBe('active');
    expect(ids(activated.providers)).toEqual([instanceProvider.id]);

    let inline = await createInstance(integration.id, {
      providers: [{ provider_id: provider.providerId }]
    });
    expect(inline.status).toBe('active');
    expect(inline.providers).toHaveLength(1);

    let both = [draft.id, inline.id].sort();
    expect(
      ids(
        await listAll(org.clients.instance, '/integration-instances', {
          query: { integration_id: integration.id },
          limit: 1
        })
      ).sort()
    ).toEqual(both);
    expect(
      ids(
        await listAll(org.clients.instance, '/integration-instances', {
          query: { integration_id: integration.id, status: 'draft' }
        })
      )
    ).toEqual([]);
    expect(
      ids(
        await listAll(org.clients.instance, '/integration-instances', {
          query: { integration_provider_id: integrationProvider.id }
        })
      ).sort()
    ).toEqual(both);
    expect(
      ids(
        await listAll(org.clients.instance, '/integration-instance-providers', {
          query: { integration_instance_id: draft.id }
        })
      )
    ).toEqual([instanceProvider.id]);

    let renamed = uniqueId('e2e-renamed');
    let updated = expectOk(
      await org.clients.instance.patch(`/integration-instances/${draft.id}`, {
        name: renamed,
        metadata: { b: 2 }
      })
    );
    expect(updated).toMatchObject({ name: renamed, description: 'Draft', metadata: { b: 2 } });

    let template = expectOk(
      await org.clients.instance.post(`/integration-instances/${draft.id}/session-template`, {
        name: uniqueId('e2e-template')
      })
    );
    expectPresented(template, 'session.template');

    let archived = expectOk(
      await org.clients.instance.delete(`/integration-instances/${draft.id}`)
    );
    expect(archived.status).toBe('archived');
    expectError(
      await org.clients.instance.patch(`/integration-instances/${draft.id}`, { name: 'x' }),
      410,
      'gone'
    );
  }, 180_000);

  it('rejects instance providers from other integrations and organizations', async () => {
    let { integration, integrationProvider } = await setupIntegration();
    let { integrationProvider: siblingProvider } = await setupIntegration();
    let otherIntegration = await createIntegration({}, otherOrg.clients.instance);
    let otherIntegrationProvider = expectOk(
      await otherOrg.clients.instance.post('/integration-providers', {
        integration_id: otherIntegration.id,
        provider_id: otherProvider.providerId,
        provider_deployment_id: otherDeployment.id
      })
    );
    let name = uniqueId('e2e-rejected');

    await expectResponses([
      {
        label: 'provider of a sibling integration',
        call: () =>
          org.clients.instance.post('/integration-instances', {
            integration_id: integration.id,
            name,
            providers: [{ provider_id: siblingProvider.id }]
          }),
        status: 400,
        code: 'integration_instance_provider_mismatch'
      },
      {
        label: 'same provider twice',
        call: () =>
          org.clients.instance.post('/integration-instances', {
            integration_id: integration.id,
            name,
            providers: [
              { provider_id: integrationProvider.id },
              { provider_id: provider.providerId }
            ]
          }),
        status: 400,
        code: 'duplicate_integration_instance_provider'
      },
      notFound('foreign integration', () =>
        org.clients.instance.post('/integration-instances', {
          integration_id: otherIntegration.id,
          name
        })
      ),
      notFound('foreign integration provider', () =>
        org.clients.instance.post('/integration-instances', {
          integration_id: integration.id,
          name,
          providers: [{ provider_id: otherIntegrationProvider.id }]
        })
      ),
      notFound('foreign catalog provider', () =>
        org.clients.instance.post('/integration-instances', {
          integration_id: integration.id,
          name,
          providers: [{ provider_id: otherProvider.providerId }]
        })
      )
    ]);

    expect(
      await listAll(org.clients.instance, '/integration-instances', {
        query: { integration_id: integration.id }
      })
    ).toEqual([]);
  }, 180_000);

  it('groups instance providers and manages group providers', async () => {
    let { integrationInstance, integrationInstanceProvider } = await setupInstance();
    let second = await setupInstance();

    let empty = expectOk(
      await org.clients.instance.post('/integration-instance-groups', {
        name: uniqueId('e2e-group')
      })
    );
    expectPresented(empty, 'integration.instance.group');
    expect(empty).toMatchObject({ status: 'draft', providers: [] });

    let group = await createGroup(integrationInstanceProvider.id);
    expectPresented(group, 'integration.instance.group');
    expect(group.status).toBe('active');
    let [groupProvider] = group.providers;
    expect(groupProvider).toMatchObject({
      object: 'integration.instance.group.provider',
      integration_instance_group_id: group.id,
      integration_instance_id: integrationInstance.id,
      integration_instance_provider_id: integrationInstanceProvider.id
    });

    let fetched = expectOk(
      await org.clients.instance.get(
        `/integration-instance-group-providers/${groupProvider.id}`
      )
    );
    expectPresented(fetched, 'integration.instance.group.provider');

    let added = expectOk(
      await org.clients.instance.put(
        `/integration-instance-groups/${group.id}/providers/${second.integrationInstanceProvider.id}`,
        { tool_filters: echoOnly }
      )
    );
    expectPresented(added, 'integration.instance.group.provider');
    expect(added.tool_filter).not.toBeNull();

    expect(
      ids(
        await listAll(org.clients.instance, '/integration-instance-group-providers', {
          query: { integration_instance_group_id: group.id },
          limit: 1
        })
      ).sort()
    ).toEqual([groupProvider.id, added.id].sort());
    expect(
      ids(
        await listAll(org.clients.instance, '/integration-instance-groups', {
          query: { integration_instance_id: second.integrationInstance.id }
        })
      )
    ).toEqual([group.id]);

    let removed = expectOk(
      await org.clients.instance.delete(`/integration-instance-group-providers/${added.id}`)
    );
    expect(removed.status).toBe('archived');
    expect(
      ids(
        await listAll(org.clients.instance, '/integration-instance-group-providers', {
          query: { integration_instance_group_id: group.id }
        })
      )
    ).toEqual([groupProvider.id]);

    let otherSetup = await (async () => {
      let otherIntegration = await createIntegration({}, otherOrg.clients.instance);
      let otherIntegrationProvider = expectOk(
        await otherOrg.clients.instance.post('/integration-providers', {
          integration_id: otherIntegration.id,
          provider_id: otherProvider.providerId,
          provider_deployment_id: otherDeployment.id
        })
      );
      return expectOk(
        await otherOrg.clients.instance.post('/integration-instances', {
          integration_id: otherIntegration.id,
          name: uniqueId('e2e-other'),
          providers: [{ provider_id: otherIntegrationProvider.id }]
        })
      );
    })();

    await expectResponses([
      notFound('group with foreign instance provider', () =>
        org.clients.instance.post('/integration-instance-groups', {
          name: uniqueId('e2e-group'),
          providers: [{ integration_instance_provider_id: otherSetup.providers[0].id }]
        })
      ),
      notFound('foreign instance provider added to group', () =>
        org.clients.instance.put(
          `/integration-instance-groups/${group.id}/providers/${otherSetup.providers[0].id}`,
          {}
        )
      ),
      {
        label: 'duplicate instance provider',
        call: () =>
          org.clients.instance.post('/integration-instance-groups', {
            name: uniqueId('e2e-group'),
            providers: [
              { integration_instance_provider_id: integrationInstanceProvider.id },
              { integration_instance_provider_id: integrationInstanceProvider.id }
            ]
          }),
        status: 400,
        code: 'duplicate_integration_instance_group_provider'
      }
    ]);

    let renamed = expectOk(
      await org.clients.instance.patch(`/integration-instance-groups/${group.id}`, {
        name: 'Renamed group'
      })
    );
    expect(renamed).toMatchObject({ name: 'Renamed group', status: 'active' });

    let archived = expectOk(
      await org.clients.instance.delete(`/integration-instance-groups/${group.id}`)
    );
    expect(archived.status).toBe('archived');
    expectError(
      await org.clients.instance.patch(`/integration-instance-groups/${group.id}`, {
        name: 'x'
      }),
      410,
      'gone'
    );
  }, 180_000);

  it('creates setup sessions for integrations with providers', async () => {
    let { integration, integrationProvider } = await setupIntegration();
    let providerless = await createIntegration();
    let otherIntegration = await createIntegration({}, otherOrg.clients.instance);

    let setupSession = await createSetupSession(integration.id, {
      description: 'Setup',
      metadata: { a: 1 },
      redirect_url: 'https://example.com/done',
      configuration: { ui: { layout: 'side' }, tool_filters: { enabled: true } }
    });
    expectPresented(setupSession, 'integration.setup_session');
    expect(setupSession).toMatchObject({
      status: 'pending',
      integration_id: integration.id,
      description: 'Setup',
      metadata: { a: 1 },
      redirect_url: 'https://example.com/done'
    });
    expect(setupSession.url).toContain(setupSession.id);
    expect(setupSession.integration_instance).toMatchObject({
      object: 'integration.instance',
      status: 'draft',
      integration_id: integration.id
    });
    expect(new Date(setupSession.expires_at).getTime()).toBeGreaterThan(Date.now());

    let dashboard = expectOk(
      await org.clients.rest.get(
        `/dashboard/instances/${org.ids.instanceId}/integration-setup-sessions/${setupSession.id}`
      )
    );
    expect(dashboard.integration_instance_id).toBe(setupSession.integration_instance.id);
    expect(dashboard.steps.map((step: any) => step.integration_provider_id)).toEqual([
      integrationProvider.id
    ]);

    let expired = await createSetupSession(integration.id, { expires_at: inMinutes(-5) });
    expect(expired.status).toBe('expired');

    let reused = await createSetupSession(integration.id, {
      integration_instance_id: setupSession.integration_instance.id
    });
    expect(reused.integration_instance.id).toBe(setupSession.integration_instance.id);

    let sibling = await setupIntegration();
    let siblingInstance = await createInstance(sibling.integration.id);

    await expectResponses([
      {
        label: 'integration without providers',
        call: () =>
          org.clients.instance.post('/integration-setup-sessions', {
            integration_id: providerless.id,
            name: 'x'
          }),
        status: 400,
        code: 'integration_provider_required'
      },
      {
        label: 'instance of another integration',
        call: () =>
          org.clients.instance.post('/integration-setup-sessions', {
            integration_id: integration.id,
            integration_instance_id: siblingInstance.id,
            name: 'x'
          }),
        status: 400,
        code: 'integration_instance_mismatch'
      },
      notFound('foreign integration', () =>
        org.clients.instance.post('/integration-setup-sessions', {
          integration_id: otherIntegration.id,
          name: 'x'
        })
      )
    ]);
  }, 180_000);

  it('lists and filters setup sessions', async () => {
    let { integration } = await setupIntegration();
    let pending = await createSetupSession(integration.id);
    let expired = await createSetupSession(integration.id, { expires_at: inMinutes(-5) });

    await expectRoutesAuth(org, otherOrg, [
      { path: '/integration-setup-sessions', expected: listAuth }
    ]);

    let listed = await listAll(org.clients.instance, '/integration-setup-sessions', {
      query: { integration_id: integration.id },
      limit: 1
    });
    expect(ids(listed).sort()).toEqual([pending.id, expired.id].sort());
    expect(
      ids(
        await listAll(org.clients.instance, '/integration-setup-sessions', {
          query: { integration_id: integration.id, status: 'pending' }
        })
      )
    ).toEqual([pending.id]);
  }, 180_000);

  it('manages provider templates of an integration', async () => {
    let { integration } = await setupIntegration();
    let otherIntegration = await createIntegration({}, otherOrg.clients.instance);
    let name = uniqueId('e2e-template');

    let template = expectOk(
      await org.clients.instance.post('/provider-templates', {
        name,
        description: 'Template',
        metadata: { a: 1 },
        integration_id: integration.id
      })
    );
    expectPresented(template, 'provider.template');
    expect(template).toMatchObject({
      status: 'active',
      name,
      description: 'Template',
      metadata: { a: 1 }
    });
    expect(template.integration_id).toEqual(expect.any(String));

    let again = expectOk(
      await org.clients.instance.post('/provider-templates', {
        name: uniqueId('e2e-template'),
        integration_id: integration.id
      })
    );
    expect(again.id).toBe(template.id);

    expect(
      ids(
        await listAll(org.clients.instance, '/provider-templates', {
          query: { id: template.id }
        })
      )
    ).toEqual([template.id]);

    let renamed = expectOk(
      await org.clients.instance.patch(`/provider-templates/${template.id}`, {
        name: 'Renamed template'
      })
    );
    expect(renamed).toMatchObject({ name: 'Renamed template', description: 'Template' });

    expectError(
      await org.clients.instance.post('/provider-templates', {
        name: 'x',
        integration_id: otherIntegration.id
      }),
      404
    );

    let archived = expectOk(
      await org.clients.instance.delete(`/provider-templates/${template.id}`)
    );
    expect(archived.status).toBe('archived');
    expect(
      expectOk(await org.clients.instance.get(`/provider-templates/${template.id}`)).status
    ).toBe('archived');

    await expectResponses([
      {
        label: 'update archived template',
        call: () =>
          org.clients.instance.patch(`/provider-templates/${template.id}`, { name: 'x' }),
        status: 412
      },
      {
        label: 'archive archived template',
        call: () => org.clients.instance.delete(`/provider-templates/${template.id}`),
        status: 412
      }
    ]);
  }, 180_000);

  it('cascades an integration archive to its providers and instances', async () => {
    let {
      integration,
      integrationProvider,
      integrationInstance,
      integrationInstanceProvider
    } = await setupInstance();

    expectOk(await org.clients.instance.delete(`/integrations/${integration.id}`));

    await eventually(async () => {
      let [fetchedProvider, fetchedInstance, fetchedInstanceProvider] = await Promise.all([
        org.clients.instance.get(`/integration-providers/${integrationProvider.id}`),
        org.clients.instance.get(`/integration-instances/${integrationInstance.id}`),
        org.clients.instance.get(
          `/integration-instance-providers/${integrationInstanceProvider.id}`
        )
      ]);
      expect(expectOk(fetchedProvider).status).toBe('archived');
      expect(expectOk(fetchedInstance).status).toBe('archived');
      expect(expectOk(fetchedInstanceProvider).status).toBe('archived');
    }, workerTimeout);

    expect(
      await listAll(org.clients.instance, '/integration-instances', {
        query: { integration_id: integration.id }
      })
    ).toEqual([]);
  }, 180_000);

  it('does not let another organization read or change integration resources', async () => {
    let {
      integration,
      integrationProvider,
      integrationInstance,
      integrationInstanceProvider
    } = await setupInstance();
    let group = await createGroup(integrationInstanceProvider.id);
    let other = otherOrg.clients.instance;

    await expectResponses([
      notFound('update integration', () =>
        other.patch(`/integrations/${integration.id}`, { name: 'x' })
      ),
      notFound('archive integration', () => other.delete(`/integrations/${integration.id}`)),
      notFound('update integration provider', () =>
        other.patch(`/integration-providers/${integrationProvider.id}`, { name: 'x' })
      ),
      notFound('archive integration provider', () =>
        other.delete(`/integration-providers/${integrationProvider.id}`)
      ),
      notFound('update instance', () =>
        other.patch(`/integration-instances/${integrationInstance.id}`, { name: 'x' })
      ),
      notFound('set instance provider', () =>
        other.put(
          `/integration-instances/${integrationInstance.id}/providers/${integrationProvider.id}`,
          {}
        )
      ),
      notFound('create instance session', () =>
        other.post(`/integration-instances/${integrationInstance.id}/session`, {})
      ),
      notFound('archive instance', () =>
        other.delete(`/integration-instances/${integrationInstance.id}`)
      ),
      notFound('update group', () =>
        other.patch(`/integration-instance-groups/${group.id}`, { name: 'x' })
      ),
      notFound('archive group provider', () =>
        other.delete(`/integration-instance-group-providers/${group.providers[0].id}`)
      ),
      notFound('setup session for integration', () =>
        other.post('/integration-setup-sessions', {
          integration_id: integration.id,
          name: 'x'
        })
      )
    ]);

    expect(
      expectOk(await org.clients.instance.get(`/integrations/${integration.id}`)).status
    ).toBe('active');
  }, 180_000);
});
