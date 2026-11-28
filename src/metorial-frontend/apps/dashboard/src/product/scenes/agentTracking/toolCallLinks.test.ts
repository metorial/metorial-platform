import { describe, expect, it } from 'vitest';
import {
  agentSessionsByToolCall,
  agentSessionSummary,
  maxToolCallSessionLookups,
  sessionToolCallNotes,
  toolCallSessionLookupIds
} from './toolCallLinks';

let session = (context: Record<string, unknown> = {}) =>
  ({
    client: { family: 'claude_code', name: 'Claude Code', surface: 'cli', version: null },
    context: {
      repositories: [{ id: 'aten_repo', host: 'github.com', owner: 'acme', name: 'api' }],
      branch: 'ada/eng-12-login',
      tickets: [
        { key: 'ENG-12', url: null },
        { key: 'ENG-13', url: null }
      ],
      ...context
    }
  }) as any;

describe('tool call links', () => {
  it('asks for one page of tool calls at most', () => {
    let items = Array.from({ length: maxToolCallSessionLookups + 5 }, (_, i) => ({
      id: `tcl_${i}`
    }));

    expect(toolCallSessionLookupIds(items)).toHaveLength(maxToolCallSessionLookups);
    expect(toolCallSessionLookupIds([{ id: 'tcl_a' }])).toEqual(['tcl_a']);
  });

  it('maps tool call ids to their agent session and tolerates a failed lookup', () => {
    let found = agentSessionsByToolCall([
      { object: 'agent_tracking.tool_call_session', toolCallId: 'tcl_a', session: session() }
    ]);

    expect(found.get('tcl_a')?.client.name).toBe('Claude Code');
    expect(found.get('tcl_b')).toBeUndefined();
    expect(agentSessionsByToolCall(undefined).size).toBe(0);
  });

  it('summarizes a session by client, repository, branch and first ticket', () => {
    expect(agentSessionSummary(session())).toEqual({
      client: 'Claude Code',
      details: 'acme/api · ada/eng-12-login · ENG-12'
    });
    expect(
      agentSessionSummary(session({ repositories: [], branch: null, tickets: [] }))
    ).toEqual({ client: 'Claude Code', details: null });
    expect(
      agentSessionSummary({
        ...session(),
        client: { family: 'codex', name: null, surface: null, version: null }
      }).client
    ).toBe('codex');
  });

  it('notes calls not linked to a visible Metorial tool call and a cut-off list', () => {
    expect(sessionToolCallNotes({ unmatchedCount: 0, hasMore: false })).toEqual([]);
    expect(sessionToolCallNotes({ unmatchedCount: null, hasMore: false })).toEqual([]);
    expect(sessionToolCallNotes({ unmatchedCount: 1, hasMore: false })).toEqual([
      '1 other MCP tool call of this session is not linked to a Metorial tool call you can see.'
    ]);
    expect(sessionToolCallNotes({ unmatchedCount: 1200, hasMore: true })).toEqual([
      '1,200 other MCP tool calls of this session are not linked to a Metorial tool call you can see.',
      'This list is cut off, so some tool calls of this session are not shown.'
    ]);
  });
});
