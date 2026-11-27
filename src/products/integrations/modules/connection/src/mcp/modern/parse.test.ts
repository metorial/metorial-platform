import { describe, expect, it } from 'vitest';
import { isModernMcpRequest, parseModernMcpRequest } from './parse';

let modernMeta = {
  'io.modelcontextprotocol/protocolVersion': '2026-07-28',
  'io.modelcontextprotocol/clientCapabilities': {},
  'io.modelcontextprotocol/clientInfo': { name: 'ExampleClient', version: '1.0.0' }
};

let headerReader = (headers: Record<string, string>) => (name: string) =>
  Object.entries(headers).find(([key]) => key.toLowerCase() === name.toLowerCase())?.[1];

let toolCall = (meta: Record<string, any> = modernMeta) => ({
  jsonrpc: '2.0',
  id: 1,
  method: 'tools/call',
  params: {
    name: 'search',
    arguments: { query: 'mcp' },
    _meta: { ...meta, progressToken: 'p1' }
  }
});

let toolCallHeaders = {
  'MCP-Protocol-Version': '2026-07-28',
  'Mcp-Method': 'tools/call',
  'Mcp-Name': 'search'
};

describe('isModernMcpRequest', () => {
  it('detects modern requests by _meta protocol version', () => {
    expect(isModernMcpRequest({ body: toolCall(), getHeader: headerReader({}) })).toBe(true);
  });

  it('detects modern requests by the protocol version header', () => {
    expect(
      isModernMcpRequest({
        body: { jsonrpc: '2.0', id: 1, method: 'tools/list' },
        getHeader: headerReader({ 'MCP-Protocol-Version': '2026-07-28' })
      })
    ).toBe(true);
  });

  it('treats batches with a modern header as modern so they can be rejected', () => {
    expect(
      isModernMcpRequest({
        body: [toolCall()],
        getHeader: headerReader({ 'MCP-Protocol-Version': '2026-07-28' })
      })
    ).toBe(true);
  });

  it('keeps initialize on the legacy path', () => {
    expect(
      isModernMcpRequest({
        body: { jsonrpc: '2.0', id: 0, method: 'initialize', params: { _meta: modernMeta } },
        getHeader: headerReader({ 'MCP-Protocol-Version': '2026-07-28' })
      })
    ).toBe(false);
  });

  it('keeps legacy protocol versions and plain requests on the legacy path', () => {
    let plain = { jsonrpc: '2.0', id: 1, method: 'tools/list' };

    expect(isModernMcpRequest({ body: plain, getHeader: headerReader({}) })).toBe(false);
    expect(
      isModernMcpRequest({
        body: plain,
        getHeader: headerReader({ 'MCP-Protocol-Version': '2025-11-25' })
      })
    ).toBe(false);
    expect(
      isModernMcpRequest({
        body: plain,
        getHeader: headerReader({ 'MCP-Protocol-Version': 'draft' })
      })
    ).toBe(false);
  });
});

describe('parseModernMcpRequest', () => {
  it('returns the canonical message and request context', () => {
    let parsed = parseModernMcpRequest({
      body: toolCall(),
      getHeader: headerReader(toolCallHeaders)
    });

    expect(parsed).toEqual({
      type: 'request',
      id: 1,
      method: 'tools/call',
      message: {
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/call',
        params: { name: 'search', arguments: { query: 'mcp' }, _meta: { progressToken: 'p1' } }
      },
      context: {
        protocolVersion: '2026-07-28',
        clientCapabilities: {},
        clientInfo: { name: 'ExampleClient', version: '1.0.0' }
      }
    });
  });

  it('removes _meta entirely when only modern keys were present', () => {
    let parsed = parseModernMcpRequest({
      body: { jsonrpc: '2.0', id: 2, method: 'tools/list', params: { _meta: modernMeta } },
      getHeader: headerReader({
        'MCP-Protocol-Version': '2026-07-28',
        'Mcp-Method': 'tools/list'
      })
    });

    expect(parsed.type === 'request' && parsed.message.params).toEqual({});
  });

  it('decodes base64-encoded header values', () => {
    let parsed = parseModernMcpRequest({
      body: toolCall(),
      getHeader: headerReader({
        ...toolCallHeaders,
        'Mcp-Name': `=?base64?${Buffer.from('search').toString('base64')}?=`
      })
    });

    expect(parsed.type).toBe('request');
  });

  it('rejects batches with -32600', () => {
    let parsed = parseModernMcpRequest({ body: [toolCall()], getHeader: headerReader({}) });

    expect(parsed).toMatchObject({
      type: 'error',
      error: { status: 400, body: { error: { code: -32600 } } }
    });
  });

  it('ignores notifications', () => {
    let parsed = parseModernMcpRequest({
      body: { jsonrpc: '2.0', method: 'notifications/cancelled', params: {} },
      getHeader: headerReader({})
    });

    expect(parsed).toEqual({ type: 'notification' });
  });

  it('rejects missing required metadata with -32602', () => {
    let { 'io.modelcontextprotocol/clientCapabilities': _, ...meta } = modernMeta;
    let parsed = parseModernMcpRequest({
      body: toolCall(meta),
      getHeader: headerReader(toolCallHeaders)
    });

    expect(parsed).toMatchObject({
      type: 'error',
      error: { status: 400, body: { id: 1, error: { code: -32602 } } }
    });
  });

  it('rejects unsupported protocol versions with -32022', () => {
    let parsed = parseModernMcpRequest({
      body: toolCall({
        ...modernMeta,
        'io.modelcontextprotocol/protocolVersion': '2027-01-01'
      }),
      getHeader: headerReader({ ...toolCallHeaders, 'MCP-Protocol-Version': '2027-01-01' })
    });

    expect(parsed).toMatchObject({
      type: 'error',
      error: {
        status: 400,
        body: {
          error: {
            code: -32022,
            data: { supported: ['2026-07-28'], requested: '2027-01-01' }
          }
        }
      }
    });
  });

  it.each([
    ['MCP-Protocol-Version', { 'Mcp-Method': 'tools/call', 'Mcp-Name': 'search' }],
    ['Mcp-Method', { ...toolCallHeaders, 'Mcp-Method': 'tools/list' }],
    ['Mcp-Name', { ...toolCallHeaders, 'Mcp-Name': 'other' }],
    ['Mcp-Name', { 'MCP-Protocol-Version': '2026-07-28', 'Mcp-Method': 'tools/call' }]
  ])('rejects a missing or mismatched %s header with -32020', (header, headers) => {
    let parsed = parseModernMcpRequest({ body: toolCall(), getHeader: headerReader(headers) });

    expect(parsed).toMatchObject({
      type: 'error',
      error: { status: 400, body: { error: { code: -32020, data: { header } } } }
    });
  });
});
