import { mcp, metorialEndpoints, rest, uniqueId, useOrganization } from '@metorial/e2e';
import { describe, expect, it } from 'vitest';

let mcpEndpoint = () => {
  let url = metorialEndpoints().mcp;
  if (!url) throw new Error('The e2e stack does not expose an mcp endpoint');
  return url;
};

let initializeMessage = {
  jsonrpc: '2.0',
  id: 1,
  method: 'initialize',
  params: {
    protocolVersion: '2025-03-26',
    capabilities: {},
    clientInfo: { name: 'metorial-e2e', version: '1.0.0' }
  }
};

describe('api-connection', () => {
  let org = useOrganization();

  it('serves /ping', async () => {
    let response = await rest(mcpEndpoint()).get('/ping');
    expect(response.status).toBe(200);
    expect(response.text).toBe('OK');
  });

  it('rejects unauthenticated MCP connections', async () => {
    let response = await rest(mcpEndpoint()).post(
      `/connect/mcp/${uniqueId('ses')}`,
      initializeMessage
    );
    expect(response.status).toBe(401);
    expect(response.body.error).toBe('unauthorized');
  });

  it('rejects non-instance credentials for MCP connections', async () => {
    let management = await rest(mcpEndpoint(), { apiKey: org.keys.management }).post(
      `/connect/mcp/${uniqueId('ses')}`,
      initializeMessage
    );
    expect(management.status).toBe(403);
    expect(management.body.message).toMatch(/Instance-scoped API key required/);

    let session = await rest(mcpEndpoint(), { session: org.user.session }).post(
      `/connect/mcp/${uniqueId('ses')}`,
      initializeMessage
    );
    expect(session.status).toBe(401);
    expect(session.body.message).toMatch(/API key authentication required/);
  });

  it('returns not found when initializing an unknown session with an instance key', async () => {
    let client = mcp(`${mcpEndpoint()}/connect/mcp/${uniqueId('ses')}`, {
      apiKey: org.keys.instanceSecret
    });

    let response = await client.initialize();
    expect(response.status).toBe(404);
    expect(response.result).toBeUndefined();
    expect(response.sessionId).toBeNull();
  });
});
