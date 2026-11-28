import {
  agentTrackingPath,
  claudeCodeEventRecord,
  expectIngested,
  sendClaudeCodeLogs,
  serviceSessions
} from '@metorial/agent-tracking-e2e';
import {
  connectSession,
  createProviderSession,
  createRemoteProvider,
  eventually,
  expectOk,
  findTool,
  uniqueId,
  useFixture,
  useMcpTestServer,
  useOrganization
} from '@metorial/e2e';
import { loadOrganizationFixture, subspaceDb } from '@metorial/e2e/db';
import { describe, expect, it } from 'vitest';
import { agentTrackingSessionService } from '../src';

describe('module-agent-tracking-query session tool calls', () => {
  let org = useOrganization();
  let server = useMcpTestServer();
  let remote = useFixture(() =>
    createRemoteProvider(org.clients.instance, { url: server.url })
  );

  it('links no Metorial call to an agent call id seen in two agent sessions', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let source = expectOk(
      await org.clients.rest.post(agentTrackingPath(org.ids.instanceId, '/ingest-sources'), {
        name: uniqueId('Usage'),
        client_family: 'claude_code'
      })
    );

    let session = await createProviderSession(org.clients.instance, [remote.providerId]);
    let client = connectSession(session.id, org.keys.instanceSecret);
    let init = await client.request('initialize', {
      protocolVersion: '2025-03-26',
      capabilities: {},
      clientInfo: { name: 'claude-code', version: '1.0.0' }
    });
    expect(init.status).toBe(200);
    await client.notify('notifications/initialized');

    let listed = await client.listTools();
    let add = findTool(listed.result.tools as { name: string }[], 'add');
    let sharedId = uniqueId('toolu');
    let ownId = uniqueId('toolu');

    for (let toolUseId of [sharedId, ownId]) {
      await client.request('tools/call', {
        name: add.name,
        arguments: { a: 1, b: 2 },
        _meta: { 'claudecode/toolUseId': toolUseId }
      });
    }

    let [shared, own] = await eventually(
      async () =>
        await Promise.all(
          [sharedId, ownId].map(clientCallId =>
            subspaceDb.toolCall.findFirstOrThrow({
              where: { session: { id: session.id }, clientCallId }
            })
          )
        ),
      { timeoutMs: 60_000, intervalMs: 500 }
    );

    let toolResult = (sessionId: string, toolUseId: string, at: Date) =>
      claudeCodeEventRecord({
        event: 'tool_result',
        sessionId,
        at,
        attributes: {
          tool_use_id: toolUseId,
          tool_name: `mcp__metorial__${add.name}`,
          success: 'true'
        }
      });

    await expectIngested(
      await sendClaudeCodeLogs({ ingestUrl: source.ingest_url, secret: source.secret }, [
        toolResult(uniqueId('session'), sharedId, shared!.createdAt),
        toolResult(uniqueId('session'), sharedId, shared!.createdAt)
      ])
    );
    let ownSession = uniqueId('session');
    await expectIngested(
      await sendClaudeCodeLogs({ ingestUrl: source.ingest_url, secret: source.secret }, [
        toolResult(ownSession, sharedId, shared!.createdAt),
        toolResult(ownSession, ownId, own!.createdAt)
      ])
    );

    let scope = {
      organization: fixture.organization,
      project: fixture.project,
      instance: fixture.instance,
      organizationActor: fixture.actor,
      canReadToolCalls: true
    };

    await eventually(
      async () => {
        let sessions = await serviceSessions(org.ids);
        expect(sessions).toHaveLength(3);

        let linked = await Promise.all(
          sessions.map(item =>
            agentTrackingSessionService.listSessionToolCalls({
              ...scope,
              sessionId: `atse_${item.sessionKey}`
            })
          )
        );
        let linkedIds = linked.flatMap(result => result.items.map(item => item.toolCall.id));

        expect(linkedIds).toEqual([own!.id]);
        expect(linked.map(result => result.unmatchedCount).sort()).toEqual([1, 1, 1]);
      },
      { timeoutMs: 120_000, intervalMs: 2_000 }
    );
  }, 300_000);
});
