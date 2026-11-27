import { uniqueId, useOrganization } from '@metorial/e2e';
import { loadOrganizationFixture } from '@metorial/e2e/db';
import { sessionService } from '@metorial-subspace/module-session';
import { resolveMetorialFacing } from '@metorial-subspace/module-tenant';
import { describe, expect, it } from 'vitest';
import { checkConduitSelfHealth, checkNatsHealth, SenderManager } from '../src';

describe('module-connection', () => {
  let org = useOrganization();

  it('reaches NATS and reports that no connection receiver runs in-process', async () => {
    await expect(checkNatsHealth()).resolves.toBeUndefined();
    await expect(checkConduitSelfHealth()).rejects.toThrow(/no local receiver is running/);
  });

  it('opens a sender for a provider-less session and lists only synthetic tools', async () => {
    let { instance, actor, auditScope } = await loadOrganizationFixture(org.ids);
    let { tenant, solution } = await resolveMetorialFacing({ instance });

    let session = await sessionService.createSession({
      instance,
      organizationActor: actor,
      auditScope,
      input: { name: uniqueId('connection-session'), providers: [] }
    });

    let manager = await SenderManager.create({
      sessionId: session.id,
      tenantId: tenant.id,
      solutionId: solution.id,
      transport: 'tool_call'
    });
    expect(manager.session.id).toBe(session.id);
    expect(await manager.listProviders()).toEqual([]);

    let { tools } = await manager.listTools();
    expect(tools.map(tool => tool.key)).toContain('metorial_connection_status');
  });

  it('rejects senders for unknown sessions', async () => {
    let { instance } = await loadOrganizationFixture(org.ids);
    let { tenant, solution } = await resolveMetorialFacing({ instance });

    await expect(
      SenderManager.create({
        sessionId: uniqueId('missing-session'),
        tenantId: tenant.id,
        solutionId: solution.id,
        transport: 'tool_call'
      })
    ).rejects.toThrow(/could not be found/);
  });
});
