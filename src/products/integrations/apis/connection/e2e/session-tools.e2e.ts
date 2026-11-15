import {
  connectSession,
  createProviderSession,
  createRemoteProvider,
  findTool,
  useMcpTestServer,
  useOrganization
} from '@metorial/e2e';
import { describe, expect, it } from 'vitest';

describe('session tools over MCP', () => {
  let org = useOrganization();
  let server = useMcpTestServer();

  it('proxies initialize, tools/list and tools/call to a remote provider', async () => {
    let { providerId } = await createRemoteProvider(org.clients.instance, { url: server.url });
    let session = await createProviderSession(org.clients.instance, [providerId]);
    let client = connectSession(session.id, org.keys.instanceSecret);

    let init = await client.initialize();
    expect(init.status).toBe(200);
    expect(init.result.capabilities).toHaveProperty('tools');

    let tools = await client.listTools();
    let add = findTool(tools.result.tools, 'add');
    findTool(tools.result.tools, 'echo');

    let call = await client.request('tools/call', {
      name: add.name,
      arguments: { a: 2, b: 3 }
    });
    expect(call.result.content).toEqual([{ type: 'text', text: '5' }]);
    expect(server.toolCalls()).toContainEqual(
      expect.objectContaining({ name: 'add', arguments: { a: 2, b: 3 } })
    );
  }, 120_000);
});
