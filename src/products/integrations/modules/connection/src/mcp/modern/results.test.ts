import { describe, expect, it } from 'vitest';
import { decorateModernResponse, getModernHttpStatus, modernMethodNotFound } from './results';

let serverInfo = {
  name: 'UnifiedProvider',
  title: 'Slack, GitHub',
  version: '1.0.0',
  description: ''
};

describe('decorateModernResponse', () => {
  it('adds resultType, cache hints and serverInfo to list results', () => {
    let decorated = decorateModernResponse({
      method: 'tools/list',
      message: { jsonrpc: '2.0', id: 1, result: { tools: [] } },
      serverInfo
    });

    expect(decorated).toEqual({
      jsonrpc: '2.0',
      id: 1,
      result: {
        tools: [],
        resultType: 'complete',
        ttlMs: 60_000,
        cacheScope: 'private',
        _meta: { 'io.modelcontextprotocol/serverInfo': serverInfo }
      }
    });
  });

  it('does not cache resources/read or server/discover results', () => {
    for (let method of ['resources/read', 'server/discover']) {
      let decorated = decorateModernResponse({
        method,
        message: { jsonrpc: '2.0', id: 1, result: {} },
        serverInfo
      }) as any;

      expect(decorated.result.ttlMs).toBe(0);
      expect(decorated.result.cacheScope).toBe('private');
    }
  });

  it('adds no cache hints to tool calls and keeps existing _meta', () => {
    let decorated = decorateModernResponse({
      method: 'tools/call',
      message: { jsonrpc: '2.0', id: 1, result: { content: [], _meta: { trace: 'a' } } },
      serverInfo
    }) as any;

    expect(decorated.result.resultType).toBe('complete');
    expect(decorated.result.ttlMs).toBeUndefined();
    expect(decorated.result._meta).toEqual({
      trace: 'a',
      'io.modelcontextprotocol/serverInfo': serverInfo
    });
  });

  it('leaves error responses untouched', () => {
    let error = modernMethodNotFound(1);

    expect(decorateModernResponse({ method: 'foo', message: error, serverInfo })).toBe(error);
  });
});

describe('getModernHttpStatus', () => {
  it('maps protocol errors to HTTP status codes', () => {
    expect(getModernHttpStatus(modernMethodNotFound(1))).toBe(404);
    expect(
      getModernHttpStatus({ jsonrpc: '2.0', id: 1, error: { code: -32020, message: '' } })
    ).toBe(400);
  });

  it('keeps tool and application errors at 200', () => {
    expect(getModernHttpStatus({ jsonrpc: '2.0', id: 1, result: {} })).toBe(200);
    expect(
      getModernHttpStatus({ jsonrpc: '2.0', id: 1, error: { code: -32000, message: '' } })
    ).toBe(200);
  });
});
