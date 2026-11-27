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
  eventuallyWithCron,
  expectOk,
  findTool,
  uniqueId,
  useFixture,
  useMcpTestServer,
  useOrganization
} from '@metorial/e2e';
import { loadOrganizationFixture, subspaceDb } from '@metorial/e2e/db';
import { describe, expect, it } from 'vitest';
import { pushToolCallsCron, toolCallCheckpoint } from '../src/queues/pushToolCalls';

let cronOptions = { timeoutMs: 180_000, intervalMs: 2_000 };

describe('module-agent-tracking-sync tool calls', () => {
  let org = useOrganization();
  let server = useMcpTestServer();
  let remote = useFixture(() =>
    createRemoteProvider(org.clients.instance, { url: server.url })
  );

  it('tells agent tracking which provider a Claude Code tool call reached', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let source = expectOk(
      await org.clients.rest.post(agentTrackingPath(org.ids.instanceId, '/ingest-sources'), {
        name: uniqueId('Usage'),
        client_family: 'claude_code'
      })
    );

    await eventuallyWithCron(
      pushToolCallsCron,
      async () => expect(await toolCallCheckpoint(fixture.instance).since()).toBeDefined(),
      cronOptions
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
    let toolUseId = uniqueId('toolu');

    await client.request('tools/call', {
      name: add.name,
      arguments: { a: 1, b: 2 },
      _meta: { 'claudecode/toolUseId': toolUseId }
    });

    let toolCall = await eventually(
      async () =>
        await subspaceDb.toolCall.findFirstOrThrow({
          where: { session: { id: session.id }, clientCallId: toolUseId }
        }),
      { timeoutMs: 60_000, intervalMs: 500 }
    );

    let agentSessionId = uniqueId('session');
    await expectIngested(
      await sendClaudeCodeLogs({ ingestUrl: source.ingest_url, secret: source.secret }, [
        claudeCodeEventRecord({
          event: 'tool_result',
          sessionId: agentSessionId,
          at: toolCall.createdAt,
          attributes: {
            tool_use_id: toolUseId,
            tool_name: `mcp__metorial__${add.name}`,
            success: 'true'
          }
        })
      ])
    );

    await eventuallyWithCron(
      pushToolCallsCron,
      async () => {
        let sessions = await serviceSessions(org.ids);
        expect(sessions.map(item => item.summary?.metorial.providerIds)).toContainEqual([
          remote.providerId
        ]);
      },
      cronOptions
    );
  }, 420_000);
});
