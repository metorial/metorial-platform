import { firstPage, uniqueId, useOrganization } from '@metorial/e2e';
import { loadOrganizationFixture, subspaceDb } from '@metorial/e2e/db';
import { describe, expect, it } from 'vitest';
import { agentClientService, agentInstanceService, agentService } from '../src';

describe('module-agent', () => {
  let org = useOrganization();

  it('creates, updates, lists and archives a custom agent', async () => {
    let { instance, actor, auditScope } = await loadOrganizationFixture(org.ids);
    let name = uniqueId('agent');

    let agent = await agentService.createAgent({
      instance,
      organizationActor: actor,
      auditScope,
      input: { name, description: 'E2E agent', metadata: { source: 'e2e' } }
    });
    expect(agent.name).toBe(name);
    expect(agent.type).toBe('custom');
    expect(agent.status).toBe('active');

    let fetched = await agentService.getAgentById({ instance, agentId: agent.id });
    expect(fetched.actor.oid).toBe(agent.actorOid);

    let updated = await agentService.updateAgent({
      instance,
      auditScope,
      agent: fetched,
      input: { name: `${name}-renamed` }
    });
    expect(updated.name).toBe(`${name}-renamed`);

    let agents = await firstPage(await agentService.listAgents({ instance }));
    expect(agents.map(item => item.id)).toContain(agent.id);

    let archived = await agentService.archiveAgent({ instance, auditScope, agent: updated });
    expect(archived.status).toBe('archived');

    let remaining = await firstPage(await agentService.listAgents({ instance }));
    expect(remaining.map(item => item.id)).not.toContain(agent.id);

    await expect(
      agentService.getAgentById({ instance, agentId: uniqueId('missing-agent') })
    ).rejects.toThrow(/could not be found/);
  });

  it('upserts agents idempotently by name and type', async () => {
    let { instance } = await loadOrganizationFixture(org.ids);
    let name = uniqueId('upsert-agent');

    let first = await agentService.upsertAgent({ instance, input: { name } });
    let second = await agentService.upsertAgent({ instance, input: { name } });
    expect(second.id).toBe(first.id);
  });

  it('upserts a system agent client', async () => {
    let { instance, auditScope } = await loadOrganizationFixture(org.ids);
    let foreignId = uniqueId('agent-client');

    let { agentClient } = await agentClientService.createAgentClient({
      instance,
      auditScope,
      input: { name: 'E2E Client', type: 'system_client', foreignId }
    });
    expect(agentClient.foreignId).toBe(foreignId);

    let fetched = await agentClientService.getAgentClientById({
      instance,
      agentClientId: agentClient.id
    });
    expect(fetched.type).toBe('system_client');

    let clients = await firstPage(
      await agentClientService.listAgentClients({ instance, types: ['system_client'] })
    );
    expect(clients.map(client => client.id)).toContain(agentClient.id);
  });

  it('resolves concurrent first opens of one client to a single agent client and instance', async () => {
    let { instance } = await loadOrganizationFixture(org.ids);
    let name = uniqueId('concurrent-agent');
    let foreignId = uniqueId('concurrent-client');
    let agent = await agentService.upsertAgent({
      instance,
      input: { name, type: 'mcp_client' }
    });

    let opens = await Promise.all(
      Array.from({ length: 8 }, async () => {
        let { agentClient } = await agentClientService.upsertAgentClient({
          instance,
          input: { name, type: 'system_client', foreignId }
        });
        let agentInstance = await agentInstanceService.upsertAgentInstance({
          instance,
          agent,
          agentClient,
          input: { name, version: '1.0.0', type: 'mcp_client' }
        });

        return { agentClient, agentInstance };
      })
    );

    expect(new Set(opens.map(open => open.agentClient.id)).size).toBe(1);
    expect(new Set(opens.map(open => open.agentInstance.id)).size).toBe(1);
    expect(await subspaceDb.agentInstance.count({ where: { agentOid: agent.oid } })).toBe(1);
  });
});
