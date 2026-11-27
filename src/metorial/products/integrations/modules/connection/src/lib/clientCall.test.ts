import { describe, expect, it } from 'vitest';
import { readClientCall, stripCodexTurnMetadata } from './clientCall';

let codexTurnMetadata = {
  session_id: 'session-1',
  turn_id: 'turn-1',
  workspaces: {
    '/home/dev/project': {
      associated_remote_urls: ['git@example.com:org/repo.git'],
      latest_git_commit_hash: 'abc123',
      has_changes: true
    }
  }
};

let toolCall = (meta?: Record<string, unknown>) => ({
  jsonrpc: '2.0' as const,
  id: 1,
  method: 'tools/call',
  params: {
    name: 'search',
    arguments: { query: 'x' },
    ...(meta ? { _meta: meta } : {})
  }
});

describe('readClientCall', () => {
  it('reads the Claude Code tool use id', () => {
    expect(
      readClientCall({
        message: toolCall({ 'claudecode/toolUseId': 'toolu_01abc', progressToken: 7 }),
        clientName: 'claude-code'
      })
    ).toEqual({ id: 'toolu_01abc', source: 'claude-code' });
  });

  it('reads the Codex call id when the turn metadata marks the request as Codex', () => {
    expect(
      readClientCall({
        message: toolCall({ callId: 'call_abc', 'x-codex-turn-metadata': codexTurnMetadata }),
        clientName: 'some-client'
      })
    ).toEqual({ id: 'call_abc', source: 'codex' });
  });

  it('reads the Codex call id when the connection was initialized by Codex', () => {
    expect(
      readClientCall({
        message: toolCall({ callId: 'exec-1f2e3d4c', threadId: 'thread-1' }),
        clientName: 'codex-mcp-client'
      })
    ).toEqual({ id: 'exec-1f2e3d4c', source: 'codex' });
  });

  it('falls through to the Codex call id when the Claude Code id is invalid', () => {
    expect(
      readClientCall({
        message: toolCall({
          'claudecode/toolUseId': 'x'.repeat(300),
          callId: 'call_abc',
          'x-codex-turn-metadata': codexTurnMetadata
        })
      })
    ).toEqual({ id: 'call_abc', source: 'codex' });
  });

  it('ignores a bare call id from a client that is not Codex', () => {
    expect(
      readClientCall({ message: toolCall({ callId: 'call_abc' }), clientName: 'claude-code' })
    ).toBeNull();
    expect(readClientCall({ message: toolCall({ callId: 'call_abc' }) })).toBeNull();
  });

  it.each([
    ['an empty string', ''],
    ['a string over 256 characters', 'x'.repeat(257)],
    ['a number', 42],
    ['an object', { id: 'toolu_1' }],
    ['a null value', null],
    ['a newline', 'toolu_1\nforged'],
    ['a NUL character', 'toolu_\u0000'],
    ['a bidi override', 'toolu_\u202e1']
  ])('ignores %s', (_label, value) => {
    expect(
      readClientCall({
        message: toolCall({ 'claudecode/toolUseId': value }),
        clientName: 'claude-code'
      })
    ).toBeNull();
    expect(
      readClientCall({
        message: toolCall({ callId: value }),
        clientName: 'codex-mcp-client'
      })
    ).toBeNull();
  });

  it('accepts an id of exactly 256 characters', () => {
    let id = 'a'.repeat(256);

    expect(readClientCall({ message: toolCall({ 'claudecode/toolUseId': id }) })).toEqual({
      id,
      source: 'claude-code'
    });
  });

  it('only reads ids from tool calls', () => {
    expect(
      readClientCall({
        message: {
          jsonrpc: '2.0',
          id: 1,
          method: 'prompts/get',
          params: { name: 'p', _meta: { 'claudecode/toolUseId': 'toolu_1' } }
        },
        clientName: 'claude-code'
      })
    ).toBeNull();
  });

  it('returns null without metadata', () => {
    expect(readClientCall({ message: toolCall(), clientName: 'codex-mcp-client' })).toBeNull();
    expect(
      readClientCall({ message: { jsonrpc: '2.0', id: 1, result: {} } as any })
    ).toBeNull();
  });
});

describe('stripCodexTurnMetadata', () => {
  it('removes only the Codex turn metadata', () => {
    let message = toolCall({
      progressToken: 3,
      callId: 'call_abc',
      sessionId: 'session-1',
      threadId: 'thread-1',
      'x-codex-turn-metadata': codexTurnMetadata
    });

    let stripped = stripCodexTurnMetadata(message) as typeof message;

    expect(stripped.params._meta).toEqual({
      progressToken: 3,
      callId: 'call_abc',
      sessionId: 'session-1',
      threadId: 'thread-1'
    });
    expect(stripped.params.arguments).toEqual({ query: 'x' });
    expect(JSON.stringify(stripped)).not.toContain('/home/dev/project');
  });

  it('leaves the incoming message untouched', () => {
    let message = toolCall({ 'x-codex-turn-metadata': codexTurnMetadata });

    stripCodexTurnMetadata(message);

    expect(message.params._meta).toHaveProperty('x-codex-turn-metadata');
  });

  it('strips the metadata from every request method and from notifications', () => {
    for (let message of [
      {
        jsonrpc: '2.0' as const,
        id: 1,
        method: 'resources/list',
        params: { _meta: { 'x-codex-turn-metadata': codexTurnMetadata } }
      },
      {
        jsonrpc: '2.0' as const,
        method: 'notifications/cancelled',
        params: { requestId: 1, _meta: { 'x-codex-turn-metadata': codexTurnMetadata } }
      }
    ]) {
      expect(JSON.stringify(stripCodexTurnMetadata(message))).not.toContain(
        'x-codex-turn-metadata'
      );
    }
  });

  it('removes the metadata from a client response', () => {
    let response = {
      jsonrpc: '2.0' as const,
      id: 'smsg_1',
      result: {
        action: 'accept',
        _meta: { keep: true, 'x-codex-turn-metadata': codexTurnMetadata }
      }
    };

    expect(stripCodexTurnMetadata(response)).toEqual({
      jsonrpc: '2.0',
      id: 'smsg_1',
      result: { action: 'accept', _meta: { keep: true } }
    });
    expect(response.result._meta).toHaveProperty('x-codex-turn-metadata');
  });

  it('returns the same message when there is nothing to strip', () => {
    let withMeta = toolCall({ 'claudecode/toolUseId': 'toolu_1' });
    let response = { jsonrpc: '2.0' as const, id: 1, result: {} };

    expect(stripCodexTurnMetadata(withMeta)).toBe(withMeta);
    expect(stripCodexTurnMetadata(toolCall())).toEqual(toolCall());
    expect(stripCodexTurnMetadata(response)).toBe(response);
  });
});
