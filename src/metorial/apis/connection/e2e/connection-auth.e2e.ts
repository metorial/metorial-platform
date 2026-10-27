import {
  createProviderSession,
  createRemoteProvider,
  expectError,
  expectOk,
  findTool,
  mcp,
  rest,
  uniqueId,
  useMcpTestServer,
  useOrganization
} from '@metorial/e2e';
import { beforeAll, describe, expect, it } from 'vitest';
import { bearer, connectionUrl, initializeMessage, mcpEndpoint, rawMcp } from './_connection';

describe('api-connection: connection authentication', () => {
  let org = useOrganization();
  let otherOrg = useOrganization();
  let server = useMcpTestServer();

  let providerId: string;
  let session: any;

  beforeAll(async () => {
    ({ providerId } = await createRemoteProvider(org.clients.instance, { url: server.url }));
    session = await createProviderSession(org.clients.instance, [providerId]);
  }, 120_000);

  let initializeWith = (url: string, headers: Record<string, string> = {}) =>
    rawMcp(url, { headers, body: initializeMessage() });

  it('accepts the instance secret key and identifies the session in the response', async () => {
    let response = await initializeWith(
      connectionUrl(session.id),
      bearer(org.keys.instanceSecret)
    );

    expect(response.status).toBe(200);
    expect(response.messages[0]?.result?.capabilities).toHaveProperty('tools');
    expect(response.headers.get('metorial-session-id')).toBe(session.id);
    expect(response.headers.get('mcp-session-id')).toBeTruthy();
    expect(response.headers.get('metorial-connection-token')).toBe(
      response.headers.get('mcp-session-id')
    );
    expect(response.headers.get('metorial-connection-id')).toBeTruthy();
  });

  it('accepts the session client secret as a bearer token and as a query parameter', async () => {
    expect(session.client_secret).toMatch(/^metorial_fk_/);
    expect(session.connection_url).toMatch(new RegExp(`/connect/mcp/${session.id}$`));

    let viaHeader = mcp(connectionUrl(session.id), { apiKey: session.client_secret });
    let init = await viaHeader.initialize();
    expect(init.status).toBe(200);
    expect(init.sessionId).toBeTruthy();

    let tools = await viaHeader.listTools();
    expect(tools.status).toBe(200);
    findTool(tools.result.tools, 'echo');

    for (let param of ['key', 'token']) {
      let viaQuery = mcp(`${connectionUrl(session.id)}?${param}=${session.client_secret}`);
      let response = await viaQuery.initialize();
      expect(response.status, `?${param}=`).toBe(200);
      expect(response.result.serverInfo).toBeDefined();
    }
  });

  it('rejects a session client secret on another session', async () => {
    let otherSession = await createProviderSession(org.clients.instance, [providerId]);

    let response = await rest(mcpEndpoint(), { apiKey: session.client_secret }).post(
      `/connect/mcp/${otherSession.id}`,
      initializeMessage()
    );
    let error = expectError(response, 403, 'forbidden');
    expect(error.message).toMatch(/not authorized for this session/);

    let unknownSession = await rest(mcpEndpoint(), { apiKey: session.client_secret }).post(
      `/connect/mcp/${uniqueId('ses')}`,
      initializeMessage()
    );
    expectError(unknownSession, 403, 'forbidden');
  });

  it('rejects missing and invalid credentials', async () => {
    let none = await rest(mcpEndpoint()).post(
      `/connect/mcp/${session.id}`,
      initializeMessage()
    );
    expectError(none, 401, 'unauthorized');

    let invalid = await rest(mcpEndpoint(), {
      apiKey: `metorial_sk_${uniqueId('invalid').replace(/-/g, '')}`
    }).post(`/connect/mcp/${session.id}`, initializeMessage());
    expectError(invalid, 401);

    let unknownFineGrained = await rest(mcpEndpoint(), {
      apiKey: `metorial_fk_${uniqueId('invalid').replace(/-/g, '')}`
    }).post(`/connect/mcp/${session.id}`, initializeMessage());
    expectError(unknownFineGrained, 401);
  });

  it("does not resolve another organization's session", async () => {
    let response = await rest(mcpEndpoint(), { apiKey: otherOrg.keys.instanceSecret }).post(
      `/connect/mcp/${session.id}`,
      initializeMessage()
    );
    expectError(response, 404, 'not_found');
    expect(response.headers.get('mcp-session-id')).toBeNull();
  });

  it('rejects an instance publishable key', async () => {
    let publishable = expectOk(
      await org.clients.management.post('/organization/api-keys', {
        type: 'instance_access_token_publishable',
        instance_id: org.ids.instanceId,
        name: uniqueId('e2e-publishable')
      })
    );
    expect(publishable.secret).toBeTruthy();

    let response = await rest(mcpEndpoint(), { apiKey: publishable.secret }).post(
      `/connect/mcp/${session.id}`,
      initializeMessage()
    );
    let error = expectError(response, 403, 'forbidden');
    expect(error.message).toMatch(/Secret API key required/);
    expect(response.headers.get('mcp-session-id')).toBeNull();
  });

  it('rejects connections to an archived session, including existing connections', async () => {
    let deletable = await createProviderSession(org.clients.instance, [providerId]);
    let client = mcp(connectionUrl(deletable.id), { apiKey: org.keys.instanceSecret });
    expect((await client.initialize()).status).toBe(200);
    let connectionToken = client.sessionId!;

    let deleted = expectOk(await org.clients.instance.delete(`/sessions/${deletable.id}`));
    expect(deleted.status).toBe('archived');

    let fresh = await rest(mcpEndpoint(), { apiKey: org.keys.instanceSecret }).post(
      `/connect/mcp/${deletable.id}`,
      initializeMessage()
    );
    expectError(fresh, 410, 'gone');

    let existing = await rest(mcpEndpoint(), {
      apiKey: org.keys.instanceSecret,
      headers: { 'mcp-session-id': connectionToken }
    }).post(`/connect/mcp/${deletable.id}`, { jsonrpc: '2.0', id: 2, method: 'tools/list' });
    expectError(existing, 410, 'gone');

    let viaClientSecret = await rest(mcpEndpoint(), { apiKey: deletable.client_secret }).post(
      `/connect/mcp/${deletable.id}`,
      initializeMessage()
    );
    expect([401, 410]).toContain(viaClientSecret.status);
    expect(viaClientSecret.body.object).toBe('error');
  });
});
