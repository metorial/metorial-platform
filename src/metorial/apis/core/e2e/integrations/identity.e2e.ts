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
  type BootstrappedOrganization
} from '@metorial/e2e';
import { subspaceDb } from '@metorial/e2e/db';
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

describe('api-core integrations: identity', () => {
  let org = useOrganization();
  let otherOrg = useOrganization();
  let server = useMcpTestServer();

  let providerId: string;
  let deployment: any;
  let secondDeployment: any;
  let otherDeployment: any;

  beforeAll(async () => {
    let provider = await createRemoteProvider(org.clients.instance, { url: server.url });
    let otherProvider = await createRemoteProvider(otherOrg.clients.instance, {
      url: server.url
    });

    providerId = provider.providerId;
    deployment = await createProviderDeployment(org.clients.instance, providerId);
    secondDeployment = await createProviderDeployment(org.clients.instance, providerId);
    otherDeployment = await createProviderDeployment(
      otherOrg.clients.instance,
      otherProvider.providerId
    );
  }, 180_000);

  let createActor = async (
    body: Record<string, unknown> = {},
    target: BootstrappedOrganization = org
  ) =>
    expectOk(
      await target.clients.instance.post('/identity-actors', {
        type: 'person',
        name: uniqueId('e2e-actor'),
        ...body
      })
    );

  let createIdentity = async (
    body: Record<string, unknown> = {},
    target: BootstrappedOrganization = org
  ) => {
    let actorId = (body.actor_id as string) ?? (await createActor({}, target)).id;
    return expectOk(
      await target.clients.instance.post('/identities', {
        name: uniqueId('e2e-identity'),
        ...body,
        actor_id: actorId
      })
    );
  };

  let createConfig = async (
    body: Record<string, unknown> = {},
    target: BootstrappedOrganization = org
  ) =>
    expectOk(
      await target.clients.instance.post('/identity-delegation-configs', {
        name: uniqueId('e2e-config'),
        sub_delegation_behavior: 'deny',
        ...body
      })
    );

  let delegate = async (identityId: string, delegateeActorId: string) =>
    expectOk(
      await org.clients.instance.post('/identity-delegations', {
        identity_id: identityId,
        delegatee_actor_id: delegateeActorId,
        permissions: ['provider:read']
      })
    );

  let waitForReconciliation = (identityId: string) =>
    eventually(async () => {
      let identity = await subspaceDb.identity.findUniqueOrThrow({
        where: { id: identityId }
      });
      expect(identity.needsReconciliation).toBe(false);
    }, workerTimeout);

  let requestDelegation = async (identityId: string, requesterActorId: string) => {
    await waitForReconciliation(identityId);
    return expectOk(
      await org.clients.instance.post('/identity-delegation-requests', {
        identity_id: identityId,
        requester_actor_id: requesterActorId,
        permissions: ['provider:call'],
        expires_at: inMinutes(60),
        note: 'Needs to call tools'
      })
    );
  };

  it('authenticates every identity route per credential', async () => {
    let agentActor = await createActor({ type: 'agent' });
    let identity = await createIdentity({ credentials: [{ deployment_id: deployment.id }] });
    let config = await createConfig();
    let delegation = await delegate(identity.id, (await createActor()).id);
    let request = await requestDelegation(identity.id, (await createActor()).id);

    let resources: [string, string][] = [
      ['identity-actors', agentActor.id],
      ['identities', identity.id],
      ['identity-credentials', identity.credentials[0].id],
      ['identity-delegation-configs', config.id],
      ['identity-delegations', delegation.id],
      ['identity-delegation-requests', request.id],
      ['agents', agentActor.agent_id]
    ];

    await expectRoutesAuth(org, otherOrg, [
      ...resources.map(([path]) => ({ path: `/${path}`, expected: listAuth })),
      ...resources.map(([path, id]) => ({ path: `/${path}/${id}`, expected: resourceAuth })),
      { path: `/agents/${agentActor.agent_id}/instances`, expected: resourceAuth }
    ]);
  }, 180_000);

  it('rejects invalid identity bodies and queries', async () => {
    let actor = await createActor();
    let identity = await createIdentity({ actor_id: actor.id });
    let api = org.clients.instance;

    await expectResponses([
      invalid('actor without type', () => api.post('/identity-actors', { name: 'x' })),
      invalid('actor with unknown type', () =>
        api.post('/identity-actors', { type: 'robot', name: 'x' })
      ),
      invalid('actor without name', () => api.post('/identity-actors', { type: 'person' })),
      invalid('actor update with string metadata', () =>
        api.patch(`/identity-actors/${actor.id}`, { metadata: 'x' })
      ),
      invalid('identity without actor', () => api.post('/identities', { name: 'x' })),
      invalid('identity with string credentials', () =>
        api.post('/identities', { actor_id: actor.id, credentials: 'all' })
      ),
      invalid('credential without identity', () =>
        api.post('/identity-credentials', { deployment_id: deployment.id })
      ),
      invalid('credential update without delegation config', () =>
        api.patch(`/identity-credentials/${uniqueId('icr')}`, {})
      ),
      invalid('config without behavior', () =>
        api.post('/identity-delegation-configs', { name: 'x' })
      ),
      invalid('config with unknown behavior', () =>
        api.post('/identity-delegation-configs', { sub_delegation_behavior: 'sometimes' })
      ),
      invalid('config with string depth', () =>
        api.post('/identity-delegation-configs', {
          sub_delegation_behavior: 'allow',
          sub_delegation_depth: 'deep'
        })
      ),
      invalid('delegation without delegatee', () =>
        api.post('/identity-delegations', { identity_id: identity.id })
      ),
      invalid('delegation with unknown permission', () =>
        api.post('/identity-delegations', {
          identity_id: identity.id,
          delegatee_actor_id: actor.id,
          permissions: ['provider:write']
        })
      ),
      invalid('delegation with invalid expiry', () =>
        api.post('/identity-delegations', {
          identity_id: identity.id,
          delegatee_actor_id: actor.id,
          expires_at: 'soon'
        })
      ),
      invalid('request without expiry', () =>
        api.post('/identity-delegation-requests', {
          identity_id: identity.id,
          requester_actor_id: actor.id
        })
      ),
      invalid('delegation list with unknown status', () =>
        api.get('/identity-delegations', { query: { status: 'pending' } })
      ),
      invalid('agent list with unknown type', () =>
        api.get('/agents', { query: { type: 'robot' } })
      )
    ]);
  }, 180_000);

  it('creates, updates and archives person and agent actors', async () => {
    let person = await createActor({ description: 'Person', metadata: { a: 1 } });
    expectPresented(person, 'identity.actor');
    expect(person).toMatchObject({
      type: 'person',
      status: 'active',
      description: 'Person',
      metadata: { a: 1 },
      agent_id: null,
      consumer_id: null
    });

    let agentActor = await createActor({ type: 'agent', description: 'Agent' });
    expect(agentActor.type).toBe('agent');
    expect(agentActor.agent_id).toEqual(expect.any(String));

    let agent = expectOk(await org.clients.instance.get(`/agents/${agentActor.agent_id}`));
    expectPresented(agent, 'agent');
    expect(agent).toMatchObject({
      status: 'active',
      name: agentActor.name,
      description: 'Agent',
      actor_id: agentActor.id
    });

    expect(
      ids(
        await listAll(org.clients.instance, '/identity-actors', {
          query: { agent_id: agent.id }
        })
      )
    ).toEqual([agentActor.id]);
    expect(
      ids(
        await listAll(org.clients.instance, '/agents', {
          query: { id: agent.id, type: agent.type }
        })
      )
    ).toEqual([agent.id]);
    expect(await listAll(org.clients.instance, `/agents/${agent.id}/instances`)).toEqual([]);

    let renamed = uniqueId('e2e-agent');
    let updated = expectOk(
      await org.clients.instance.patch(`/identity-actors/${agentActor.id}`, {
        name: renamed,
        metadata: { b: 2 }
      })
    );
    expect(updated).toMatchObject({ name: renamed, description: 'Agent', metadata: { b: 2 } });
    expect(expectOk(await org.clients.instance.get(`/agents/${agent.id}`)).name).toBe(renamed);

    let archived = expectOk(
      await org.clients.instance.delete(`/identity-actors/${person.id}`)
    );
    expect(archived.status).toBe('archived');
    expect(
      expectOk(await org.clients.instance.get(`/identity-actors/${person.id}`)).status
    ).toBe('archived');
    expect(
      ids(
        await listAll(org.clients.instance, '/identity-actors', { query: { id: person.id } })
      )
    ).toEqual([]);
    expect(
      ids(
        await listAll(org.clients.instance, '/identity-actors', {
          query: { id: person.id, status: 'archived' }
        })
      )
    ).toEqual([person.id]);

    await expectResponses([
      {
        label: 'update archived actor',
        call: () => org.clients.instance.patch(`/identity-actors/${person.id}`, { name: 'x' }),
        status: 410,
        code: 'gone'
      },
      {
        label: 'archive archived actor',
        call: () => org.clients.instance.delete(`/identity-actors/${person.id}`),
        status: 410,
        code: 'gone'
      },
      {
        label: 'identity for archived actor',
        call: () => org.clients.instance.post('/identities', { actor_id: person.id }),
        status: 400,
        code: 'use_after_delete'
      }
    ]);
  }, 180_000);

  it('pages through actors', async () => {
    let created = [await createActor(), await createActor(), await createActor()];
    let listed = await listAll(org.clients.instance, '/identity-actors', { limit: 1 });
    expect(ids(listed)).toEqual(expect.arrayContaining(ids(created)));
    expect(new Set(ids(listed)).size).toBe(listed.length);
    for (let item of listed) expectPresented(item, 'identity.actor');
  }, 180_000);

  it('manages identities and their credentials', async () => {
    let actor = await createActor();
    let identity = await createIdentity({
      actor_id: actor.id,
      description: 'Identity',
      metadata: { a: 1 },
      credentials: [{ deployment_id: deployment.id }]
    });
    expectPresented(identity, 'identity');
    expect(identity).toMatchObject({
      status: 'active',
      description: 'Identity',
      metadata: { a: 1 },
      owner: { type: 'actor', actor: { id: actor.id } }
    });
    let [credential] = identity.credentials;
    expect(credential).toMatchObject({
      object: 'identity.credential',
      status: 'active',
      identity_id: identity.id,
      provider_id: providerId,
      deployment_id: deployment.id,
      auth_config_id: null,
      delegation_config_id: null
    });
    expect(credential.config_id).toEqual(expect.any(String));

    expect(
      ids(
        await listAll(org.clients.instance, '/identities', { query: { actor_id: actor.id } })
      )
    ).toEqual([identity.id]);

    let added = expectOk(
      await org.clients.instance.post('/identity-credentials', {
        identity_id: identity.id,
        deployment_id: secondDeployment.id
      })
    );
    expectPresented(added, 'identity.credential');
    expect(added).toMatchObject({
      identity_id: identity.id,
      deployment_id: secondDeployment.id
    });

    for (let query of [
      { identity_id: identity.id },
      { identity_id: identity.id, provider_id: providerId },
      { actor_id: actor.id }
    ]) {
      expect(
        ids(
          await listAll(org.clients.instance, '/identity-credentials', { query, limit: 1 })
        ).sort()
      ).toEqual([credential.id, added.id].sort());
    }
    expect(
      ids(
        await listAll(org.clients.instance, '/identity-credentials', {
          query: { provider_deployment_id: secondDeployment.id }
        })
      )
    ).toEqual([added.id]);

    let config = await createConfig();
    let reassigned = expectOk(
      await org.clients.instance.patch(`/identity-credentials/${added.id}`, {
        delegation_config_id: config.id
      })
    );
    expect(reassigned.delegation_config_id).toBe(config.id);

    let archivedCredential = expectOk(
      await org.clients.instance.delete(`/identity-credentials/${added.id}`)
    );
    expect(archivedCredential.status).toBe('archived');
    expect(
      ids(
        await listAll(org.clients.instance, '/identity-credentials', {
          query: { identity_id: identity.id }
        })
      )
    ).toEqual([credential.id]);
    expectError(
      await org.clients.instance.patch(`/identity-credentials/${added.id}`, {
        delegation_config_id: config.id
      }),
      410,
      'gone'
    );

    let renamed = uniqueId('e2e-identity');
    let updated = expectOk(
      await org.clients.instance.patch(`/identities/${identity.id}`, {
        name: renamed,
        metadata: { b: 2 }
      })
    );
    expect(updated).toMatchObject({
      name: renamed,
      description: 'Identity',
      metadata: { b: 2 }
    });

    let archived = expectOk(await org.clients.instance.delete(`/identities/${identity.id}`));
    expect(archived.status).toBe('archived');

    await expectResponses([
      {
        label: 'update archived identity',
        call: () => org.clients.instance.patch(`/identities/${identity.id}`, { name: 'x' }),
        status: 410,
        code: 'gone'
      },
      {
        label: 'credential for archived identity',
        call: () =>
          org.clients.instance.post('/identity-credentials', {
            identity_id: identity.id,
            deployment_id: deployment.id
          }),
        status: 400,
        code: 'use_after_delete'
      }
    ]);
  }, 180_000);

  it('rejects identity references owned by another organization', async () => {
    let actor = await createActor();
    let identity = await createIdentity({ actor_id: actor.id });
    let delegatee = await createActor();
    let otherActor = await createActor({}, otherOrg);
    let otherIdentity = await createIdentity({}, otherOrg);
    let otherConfig = await createConfig({}, otherOrg);
    let api = org.clients.instance;

    await expectResponses([
      notFound('identity for foreign actor', () =>
        api.post('/identities', { actor_id: otherActor.id })
      ),
      notFound('identity with foreign deployment', () =>
        api.post('/identities', {
          actor_id: actor.id,
          credentials: [{ deployment_id: otherDeployment.id }]
        })
      ),
      notFound('credential for foreign identity', () =>
        api.post('/identity-credentials', {
          identity_id: otherIdentity.id,
          deployment_id: deployment.id
        })
      ),
      notFound('credential with foreign deployment', () =>
        api.post('/identity-credentials', {
          identity_id: identity.id,
          deployment_id: otherDeployment.id
        })
      ),
      notFound('credential with foreign delegation config', () =>
        api.post('/identity-credentials', {
          identity_id: identity.id,
          deployment_id: deployment.id,
          delegation_config_id: otherConfig.id
        })
      ),
      notFound('delegation of foreign identity', () =>
        api.post('/identity-delegations', {
          identity_id: otherIdentity.id,
          delegatee_actor_id: actor.id,
          permissions: ['provider:read']
        })
      ),
      notFound('delegation to foreign actor', () =>
        api.post('/identity-delegations', {
          identity_id: identity.id,
          delegatee_actor_id: otherActor.id,
          permissions: ['provider:read']
        })
      ),
      notFound('delegation with foreign config', () =>
        api.post('/identity-delegations', {
          identity_id: identity.id,
          delegatee_actor_id: delegatee.id,
          permissions: ['provider:read'],
          delegation_config_id: otherConfig.id
        })
      ),
      notFound('request for foreign identity', () =>
        api.post('/identity-delegation-requests', {
          identity_id: otherIdentity.id,
          requester_actor_id: actor.id,
          expires_at: inMinutes(60)
        })
      ),
      notFound('request by foreign actor', () =>
        api.post('/identity-delegation-requests', {
          identity_id: identity.id,
          requester_actor_id: otherActor.id,
          expires_at: inMinutes(60)
        })
      ),
      notFound('update foreign actor', () =>
        api.patch(`/identity-actors/${otherActor.id}`, { name: 'x' })
      ),
      notFound('archive foreign identity', () =>
        api.delete(`/identities/${otherIdentity.id}`)
      ),
      notFound('update foreign config', () =>
        api.patch(`/identity-delegation-configs/${otherConfig.id}`, { name: 'x' })
      )
    ]);

    expect(
      expectOk(await otherOrg.clients.instance.get(`/identities/${otherIdentity.id}`)).status
    ).toBe('active');
  }, 180_000);

  it('manages delegation configs', async () => {
    let defaultConfig = expectOk(
      await org.clients.instance.get('/identity-delegation-configs/default')
    );
    expectPresented(defaultConfig, 'identity.delegation_config');
    expect(defaultConfig).toMatchObject({ is_default: true, status: 'active' });

    let config = await createConfig({
      description: 'Config',
      metadata: { a: 1 },
      sub_delegation_behavior: 'allow',
      sub_delegation_depth: 2
    });
    expectPresented(config, 'identity.delegation_config');
    expect(config).toMatchObject({
      is_default: false,
      status: 'active',
      description: 'Config',
      metadata: { a: 1 },
      sub_delegation_behavior: 'allow',
      sub_delegation_depth: 2
    });

    let updated = expectOk(
      await org.clients.instance.patch(`/identity-delegation-configs/${config.id}`, {
        name: 'Renamed config',
        sub_delegation_behavior: 'require_consent'
      })
    );
    expect(updated).toMatchObject({
      name: 'Renamed config',
      description: 'Config',
      sub_delegation_behavior: 'require_consent'
    });

    let listed = await listAll(org.clients.instance, '/identity-delegation-configs', {
      limit: 1
    });
    expect(ids(listed)).toEqual(expect.arrayContaining([defaultConfig.id, config.id]));

    let archived = expectOk(
      await org.clients.instance.delete(`/identity-delegation-configs/${config.id}`)
    );
    expect(archived.status).toBe('archived');
    expect(
      ids(
        await listAll(org.clients.instance, '/identity-delegation-configs', {
          query: { id: config.id }
        })
      )
    ).toEqual([]);

    await expectResponses([
      {
        label: 'update archived config',
        call: () =>
          org.clients.instance.patch(`/identity-delegation-configs/${config.id}`, {
            name: 'x'
          }),
        status: 410,
        code: 'gone'
      },
      {
        label: 'archive archived config',
        call: () => org.clients.instance.delete(`/identity-delegation-configs/${config.id}`),
        status: 410,
        code: 'gone'
      }
    ]);
  }, 180_000);

  it('creates, lists and revokes delegations', async () => {
    let owner = await createActor();
    let identity = await createIdentity({ actor_id: owner.id });
    let delegatee = await createActor();
    let config = await createConfig();

    let delegation = expectOk(
      await org.clients.instance.post('/identity-delegations', {
        identity_id: identity.id,
        delegatee_actor_id: delegatee.id,
        permissions: ['provider:read'],
        delegation_config_id: config.id,
        note: 'Read access',
        metadata: { ticket: 'E2E-1' }
      })
    );
    expectPresented(delegation, 'identity.delegation');
    expect(delegation).toMatchObject({
      status: 'active',
      delegation_level: 0,
      permissions: ['provider:read'],
      note: 'Read access',
      metadata: { ticket: 'E2E-1' },
      delegation_config_id: config.id,
      identity: { id: identity.id },
      request: null
    });
    let roles = Object.fromEntries(
      delegation.parties.map((party: any) => [party.actor.id, [...party.roles].sort()])
    );
    expect(roles).toEqual({
      [owner.id]: ['delegator', 'owner'],
      [delegatee.id]: ['delegatee']
    });

    for (let query of [
      { identity_id: identity.id },
      { identity_id: identity.id, delegatee_actor_id: delegatee.id },
      { identity_id: identity.id, owner_actor_id: owner.id },
      { identity_id: identity.id, permissions: 'provider:read' },
      { identity_id: identity.id, status: 'active' }
    ]) {
      expect(
        ids(await listAll(org.clients.instance, '/identity-delegations', { query }))
      ).toEqual([delegation.id]);
    }
    expect(
      await listAll(org.clients.instance, '/identity-delegations', {
        query: { identity_id: identity.id, permissions: 'provider:call' }
      })
    ).toEqual([]);

    await expectResponses([
      {
        label: 'delegate to the owner',
        call: () =>
          org.clients.instance.post('/identity-delegations', {
            identity_id: identity.id,
            delegatee_actor_id: owner.id,
            permissions: ['provider:read']
          }),
        status: 400,
        code: 'bad_request'
      },
      {
        label: 'delegate nothing',
        call: () =>
          org.clients.instance.post('/identity-delegations', {
            identity_id: identity.id,
            delegatee_actor_id: delegatee.id,
            permissions: []
          }),
        status: 400,
        code: 'bad_request'
      },
      {
        label: 'delegate with past expiry',
        call: () =>
          org.clients.instance.post('/identity-delegations', {
            identity_id: identity.id,
            delegatee_actor_id: delegatee.id,
            permissions: ['provider:read'],
            expires_at: inMinutes(-1)
          }),
        status: 400,
        code: 'bad_request'
      }
    ]);

    let revoked = expectOk(
      await org.clients.instance.post(`/identity-delegations/${delegation.id}/revoke`)
    );
    expect(revoked.status).toBe('revoked');
    expectError(
      await org.clients.instance.post(`/identity-delegations/${delegation.id}/revoke`),
      400,
      'bad_request'
    );
    expectError(
      await otherOrg.clients.instance.post(`/identity-delegations/${delegation.id}/revoke`),
      404
    );
  }, 180_000);

  it('approves and denies delegation requests', async () => {
    let owner = await createActor();
    let identity = await createIdentity({ actor_id: owner.id });
    let requester = await createActor();

    let request = await requestDelegation(identity.id, requester.id);
    expectPresented(request, 'identity.delegation_request');
    expect(request).toMatchObject({
      status: 'pending',
      identity_id: identity.id,
      requester: { id: requester.id },
      delegation: { status: 'waiting_for_consent', permissions: ['provider:call'] }
    });

    expectError(
      await otherOrg.clients.instance.post(
        `/identity-delegation-requests/${request.id}/approve`
      ),
      404
    );

    let approved = expectOk(
      await org.clients.instance.post(`/identity-delegation-requests/${request.id}/approve`)
    );
    expect(approved).toMatchObject({ status: 'approved', delegation: { status: 'active' } });

    await waitForReconciliation(identity.id);
    await expectResponses([
      {
        label: 'approve twice',
        call: () =>
          org.clients.instance.post(`/identity-delegation-requests/${request.id}/approve`),
        status: 400,
        code: 'bad_request'
      },
      {
        label: 'deny approved',
        call: () =>
          org.clients.instance.post(`/identity-delegation-requests/${request.id}/deny`),
        status: 400,
        code: 'bad_request'
      },
      {
        label: 'request from the owner',
        call: () =>
          org.clients.instance.post('/identity-delegation-requests', {
            identity_id: identity.id,
            requester_actor_id: owner.id,
            permissions: ['provider:call'],
            expires_at: inMinutes(60)
          }),
        status: 400,
        code: 'bad_request'
      },
      {
        label: 'request with past expiry',
        call: () =>
          org.clients.instance.post('/identity-delegation-requests', {
            identity_id: identity.id,
            requester_actor_id: requester.id,
            permissions: ['provider:read'],
            expires_at: inMinutes(-1)
          }),
        status: 400,
        code: 'bad_request'
      }
    ]);

    let second = await requestDelegation(identity.id, (await createActor()).id);
    let denied = expectOk(
      await org.clients.instance.post(`/identity-delegation-requests/${second.id}/deny`)
    );
    expect(denied).toMatchObject({ status: 'denied', delegation: { status: 'denied' } });

    expect(
      ids(
        await listAll(org.clients.instance, '/identity-delegation-requests', {
          query: { identity_id: identity.id },
          limit: 1
        })
      ).sort()
    ).toEqual([request.id, second.id].sort());
    expect(
      ids(
        await listAll(org.clients.instance, '/identity-delegation-requests', {
          query: { identity_id: identity.id, status: 'denied' }
        })
      )
    ).toEqual([second.id]);
  }, 180_000);
});
