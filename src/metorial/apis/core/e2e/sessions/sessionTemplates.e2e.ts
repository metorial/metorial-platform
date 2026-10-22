import {
  createRemoteProvider,
  eventually,
  expectAuthMatrix,
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
  createProviderConfig,
  createProviderDeployment,
  crossTenantClients,
  discoverProviderTools,
  ids,
  instancePathFor,
  providerToolKeys
} from './_shared';

describe('api-core sessions: session templates', () => {
  let org = useOrganization();
  let otherOrg = useOrganization();
  let server = useMcpTestServer();

  let provider: RemoteProvider;
  let deployment: any;
  let secondDeployment: any;
  let config: any;
  let otherDeployment: any;

  beforeAll(async () => {
    provider = await createRemoteProvider(org.clients.instance, { url: server.url });
    let otherProvider = await createRemoteProvider(otherOrg.clients.instance, {
      url: server.url
    });

    deployment = await createProviderDeployment(org.clients.instance, provider.providerId);
    secondDeployment = await createProviderDeployment(
      org.clients.instance,
      provider.providerId
    );
    config = await createProviderConfig(org.clients.instance, {
      providerId: provider.providerId,
      deploymentId: deployment.id
    });
    otherDeployment = await createProviderDeployment(
      otherOrg.clients.instance,
      otherProvider.providerId
    );
    await discoverProviderTools(org, provider.providerId);
  }, 180_000);

  let createTemplate = async (body: Record<string, unknown> = {}) =>
    expectOk(
      await org.clients.instance.post('/session-templates', {
        name: uniqueId('e2e-template'),
        providers: [{ provider_deployment_id: deployment.id }],
        ...body
      })
    );

  it('authenticates session template routes per credential', async () => {
    let template = await createTemplate();
    let clients = crossTenantClients(org, otherOrg);

    await expectAuthMatrix(
      clients,
      (client, name) =>
        client.get(instancePathFor(org, name, `/session-templates/${template.id}`)),
      {
        none: 401,
        session: 200,
        management: 200,
        instance: 200,
        otherSession: 404,
        otherManagement: 404,
        otherInstance: 404
      }
    );

    let templateProviderId = template.providers[0].id;
    await expectAuthMatrix(
      clients,
      (client, name) =>
        client.get(
          instancePathFor(org, name, `/session-template-providers/${templateProviderId}`)
        ),
      {
        none: 401,
        session: 200,
        management: 200,
        instance: 200,
        otherSession: 404,
        otherManagement: 404,
        otherInstance: 404
      }
    );
  });

  it('runs the session template lifecycle', async () => {
    let name = uniqueId('e2e-template');
    let template = await createTemplate({
      name,
      description: 'Created by e2e',
      metadata: { env: 'e2e' },
      providers: [
        { provider_deployment_id: deployment.id, provider_config_id: config.id },
        { provider_deployment_id: secondDeployment.id }
      ]
    });
    expectPresented(template, 'session.template');
    expect(template).toMatchObject({
      status: 'active',
      name,
      description: 'Created by e2e',
      metadata: { env: 'e2e' }
    });
    expect(template.providers).toHaveLength(2);
    for (let item of template.providers) {
      expectPresented(item, 'session.template.provider');
      expect(item.session_template_id).toBe(template.id);
      expect(item.provider_id).toBe(provider.providerId);
    }
    let withConfig = template.providers.find(
      (item: any) => item.deployment.id === deployment.id
    );
    expect(withConfig.config.id).toBe(config.id);

    let empty = await createTemplate({ providers: undefined });
    expect(empty.providers).toEqual([]);

    let fetched = expectOk(
      await org.clients.instance.get(`/session-templates/${template.id}`)
    );
    expect(fetched.id).toBe(template.id);

    let updated = expectOk(
      await org.clients.instance.patch(`/session-templates/${template.id}`, {
        name: 'Renamed template',
        metadata: { env: 'renamed' }
      })
    );
    expect(updated).toMatchObject({
      name: 'Renamed template',
      description: 'Created by e2e',
      metadata: { env: 'renamed' }
    });

    let deleted = expectOk(
      await org.clients.instance.delete(`/session-templates/${template.id}`)
    );
    expect(deleted.status).toBe('archived');

    let active = await listAll(org.clients.instance, '/session-templates');
    expect(ids(active)).toContain(empty.id);
    expect(ids(active)).not.toContain(template.id);

    let archived = await listAll(org.clients.instance, '/session-templates', {
      query: { status: 'archived' }
    });
    expect(ids(archived)).toContain(template.id);

    expectError(
      await org.clients.instance.patch(`/session-templates/${template.id}`, { name: 'Late' }),
      410,
      'gone'
    );
  });

  it('creates sessions from a template', async () => {
    let template = await createTemplate({
      providers: [
        { provider_deployment_id: deployment.id },
        { provider_deployment_id: secondDeployment.id }
      ]
    });

    let session = expectOk(
      await org.clients.instance.post('/sessions', {
        providers: [{ session_template_id: template.id }]
      })
    );
    expect(session.from_template_ids).toEqual([template.id]);
    expect(session.providers).toHaveLength(2);
    for (let item of session.providers) {
      expect(item.from_template_id).toBe(template.id);
      expect(ids(template.providers)).toContain(item.from_template_provider_id);
    }

    let mixed = expectOk(
      await org.clients.instance.post('/sessions', {
        providers: [
          { session_template_id: template.id },
          { provider_deployment: { provider_id: provider.providerId } }
        ]
      })
    );
    expect(mixed.providers).toHaveLength(3);
    expect(mixed.from_template_ids).toEqual([template.id]);

    let sessions = await listAll(org.clients.instance, '/sessions', {
      query: { session_template_id: template.id }
    });
    expect(ids(sessions).sort()).toEqual([session.id, mixed.id].sort());

    let templates = await listAll(org.clients.instance, '/session-templates', {
      query: { session_id: session.id }
    });
    expect(ids(templates)).toEqual([template.id]);

    expectOk(await org.clients.instance.delete(`/session-templates/${template.id}`));
    let missing = expectError(
      await org.clients.instance.post('/sessions', {
        providers: [{ session_template_id: template.id }]
      }),
      404,
      'not_found'
    );
    expect(missing.entity).toBe('session.template');
  });

  it('manages the providers of a template', async () => {
    let template = await createTemplate({ providers: [] });
    let add = (body: Record<string, unknown>) =>
      org.clients.instance.post('/session-template-providers', {
        session_template_id: template.id,
        ...body
      });

    let first = expectOk(
      await add({
        provider_deployment_id: deployment.id,
        tool_filters: { type: 'tool_keys', keys: ['echo'] }
      })
    );
    expectPresented(first, 'session.template.provider');
    expect(first).toMatchObject({
      status: 'active',
      session_template_id: template.id,
      provider_id: provider.providerId,
      deployment: { id: deployment.id }
    });
    expect(JSON.stringify(first.tool_filter)).toContain('echo');

    let second = expectOk(await add({ provider_deployment_id: secondDeployment.id }));
    let configured = expectOk(await add({ provider_config_id: config.id }));
    expect(configured.deployment.id).toBe(deployment.id);
    expect(configured.config.id).toBe(config.id);

    let listed = await listAll(org.clients.instance, '/session-template-providers', {
      query: { session_template_id: template.id },
      limit: 1
    });
    expect(ids(listed).sort()).toEqual([first.id, second.id, configured.id].sort());

    let byDeployment = await listAll(org.clients.instance, '/session-template-providers', {
      query: { session_template_id: template.id, provider_deployment_id: secondDeployment.id }
    });
    expect(ids(byDeployment)).toEqual([second.id]);

    let updated = expectOk(
      await org.clients.instance.patch(`/session-template-providers/${first.id}`, {
        tool_filters: { type: 'tool_keys', keys: ['add'] }
      })
    );
    expect(JSON.stringify(updated.tool_filter)).toContain('add');

    let archived = expectOk(
      await org.clients.instance.delete(`/session-template-providers/${second.id}`)
    );
    expect(archived.status).toBe('archived');

    let refreshed = expectOk(
      await org.clients.instance.get(`/session-templates/${template.id}`)
    );
    expect(ids(refreshed.providers).sort()).toEqual([first.id, configured.id].sort());

    let session = expectOk(
      await org.clients.instance.post('/sessions', {
        providers: [{ session_template_id: template.id }]
      })
    );
    expect(
      session.providers.map((item: any) => item.from_template_provider_id).sort()
    ).toEqual([first.id, configured.id].sort());
  });

  it('lists the tools of a template', async () => {
    let template = await createTemplate();

    let tools = await eventually(
      async () => {
        let body = expectOk(
          await org.clients.instance.get(`/session-templates/${template.id}/tools`)
        );
        expect(body.object).toBe('provider.tools');
        let keys = body.items.map((item: any) => item.key);
        expect(keys).toEqual(expect.arrayContaining(providerToolKeys));
        return body;
      },
      { timeoutMs: 45_000, intervalMs: 1_000 }
    );
    for (let { input_schema, output_schema, ...tool } of tools.items) {
      expectPresented(tool, 'provider.tool');
      expect(input_schema).toEqual(expect.any(Object));
    }

    expectError(
      await org.clients.instance.get(`/session-templates/${uniqueId('stpl')}/tools`),
      404,
      'not_found'
    );
  }, 90_000);

  it('validates template bodies and queries', async () => {
    for (let body of [
      {},
      { name: 42 },
      { name: 'x', metadata: 'x' },
      { name: 'x', providers: 'x' },
      { name: 'x', providers: [{ provider_deployment_id: 42 }] },
      { name: 'x', providers: [{ provider_config_id: 42 }] },
      { name: 'x', providers: [{ tool_filters: { type: 'unknown' } }] }
    ]) {
      expectError(
        await org.clients.instance.post('/session-templates', body),
        400,
        'invalid_data'
      );
    }

    let template = await createTemplate();
    expectError(
      await org.clients.instance.patch(`/session-templates/${template.id}`, { name: 42 }),
      400,
      'invalid_data'
    );

    for (let body of [
      {},
      { session_template_id: 42 },
      { session_template_id: template.id, provider_deployment_id: 42 },
      { session_template_id: template.id, tool_filters: { type: 'prompt_regex' } }
    ]) {
      expectError(
        await org.clients.instance.post('/session-template-providers', body),
        400,
        'invalid_data'
      );
    }

    let missingTemplate = expectError(
      await org.clients.instance.post('/session-template-providers', {
        session_template_id: uniqueId('stpl'),
        provider_deployment_id: deployment.id
      }),
      404,
      'not_found'
    );
    expect(missingTemplate.entity).toBe('session.template');

    for (let query of [{ status: 'deleted' }, { limit: 0 }]) {
      expectError(
        await org.clients.instance.get('/session-templates', { query }),
        400,
        'invalid_data'
      );
      expectError(
        await org.clients.instance.get('/session-template-providers', { query }),
        400,
        'invalid_data'
      );
    }
  });

  it.fails(
    'rejects an unknown provider_config_id on a template provider (bug: providerCombination maps unknown config ids to null and falls back to the default config)',
    async () => {
      let error = expectError(
        await org.clients.instance.post('/session-templates', {
          name: uniqueId('e2e-template'),
          providers: [
            { provider_deployment_id: deployment.id, provider_config_id: 'pcf_nope' }
          ]
        }),
        404,
        'not_found'
      );
      expect(error.entity).toBe('provider.config');
    }
  );

  it('pages through templates', async () => {
    let created = [await createTemplate(), await createTemplate(), await createTemplate()];

    let paged = await listAll(org.clients.instance, '/session-templates', { limit: 1 });
    expect(new Set(ids(paged)).size).toBe(paged.length);
    expect(ids(paged)).toEqual(expect.arrayContaining(ids(created)));

    let byId = await listAll(org.clients.instance, '/session-templates', {
      query: { id: created[0].id }
    });
    expect(ids(byId)).toEqual([created[0].id]);

    let byDeployment = await listAll(org.clients.instance, '/session-templates', {
      query: { provider_deployment_id: secondDeployment.id }
    });
    expect(ids(byDeployment)).not.toContain(created[0].id);
  });

  it('hides templates and template providers from other organizations', async () => {
    let template = await createTemplate();
    let templateProviderId = template.providers[0].id;
    let other = otherOrg.clients.instance;

    expectError(await other.get(`/session-templates/${template.id}`), 404, 'not_found');
    expectError(
      await other.patch(`/session-templates/${template.id}`, { name: 'x' }),
      404,
      'not_found'
    );
    expectError(await other.delete(`/session-templates/${template.id}`), 404, 'not_found');
    expectError(await other.get(`/session-templates/${template.id}/tools`), 404, 'not_found');
    expectError(
      await other.get(`/session-template-providers/${templateProviderId}`),
      404,
      'not_found'
    );
    expectError(
      await other.delete(`/session-template-providers/${templateProviderId}`),
      404,
      'not_found'
    );
    expectError(
      await other.post('/session-template-providers', {
        session_template_id: template.id,
        provider_deployment_id: otherDeployment.id
      }),
      404,
      'not_found'
    );
    expectError(
      await other.post('/sessions', { providers: [{ session_template_id: template.id }] }),
      404,
      'not_found'
    );

    expect(ids(await listAll(other, '/session-templates'))).not.toContain(template.id);

    let foreign = await org.clients.instance.post('/session-templates', {
      name: uniqueId('e2e-template'),
      providers: [{ provider_deployment_id: otherDeployment.id }]
    });
    expectError(foreign, 400, 'bad_request');
  });
});
