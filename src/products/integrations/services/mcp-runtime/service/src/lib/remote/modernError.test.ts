import { describe, expect, it } from 'vitest';
import { parseJsonRpcError, parseModernMcpError } from './modernError';

describe('parseJsonRpcError', () => {
  it('parses JSON-RPC error bodies', () => {
    expect(
      parseJsonRpcError(
        JSON.stringify({ jsonrpc: '2.0', id: 1, error: { code: -32601, message: 'nope' } })
      )
    ).toEqual({ jsonrpc: '2.0', id: 1, error: { code: -32601, message: 'nope' } });
  });

  it.each(['', 'not json', '{"error":{"code":1}}', '{"jsonrpc":"2.0","result":{}}'])(
    'returns null for %j',
    body => {
      expect(parseJsonRpcError(body)).toBe(null);
    }
  );
});

describe('parseModernMcpError', () => {
  it.each([-32020, -32021, -32022])('recognizes code %i', code => {
    expect(
      parseModernMcpError(JSON.stringify({ jsonrpc: '2.0', error: { code, message: 'x' } }))
    ).not.toBe(null);
  });

  it('ignores errors that legacy servers also return', () => {
    expect(
      parseModernMcpError(
        JSON.stringify({ jsonrpc: '2.0', error: { code: -32600, message: 'Bad Request' } })
      )
    ).toBe(null);
  });
});
