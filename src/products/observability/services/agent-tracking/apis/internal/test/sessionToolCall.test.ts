import type { Organization } from '@mtsrc/agent-tracking-db';
import { describe, expect, it } from 'vitest';
import { sessionTitlesShown } from '../src/presenters/session';
import { findByToolCallsInput, listMcpToolCallsInput } from '../src/sessionToolCalls';
import {
  sessionMcpToolCallPresenter,
  toolCallRefPresenter,
  toolCallSessionPresenter
} from '../src/presenters/sessionToolCall';

let organization = (settings: Organization['settings']) => ({ settings }) as Organization;

describe('sessionMcpToolCallPresenter', () => {
  it('returns the call with its MCP names', () => {
    expect(
      sessionMcpToolCallPresenter({
        clientFamily: 'claude-code',
        toolCallId: 'toolu_1',
        occurredAt: new Date('2026-11-27T10:00:00Z'),
        durationMs: 900,
        outcome: 'ok',
        mcpServer: 'linear',
        mcpTool: 'create_issue'
      })
    ).toEqual({
      object: 'agent_tracking#session_tool_call',
      clientFamily: 'claude-code',
      toolCallId: 'toolu_1',
      occurredAt: new Date('2026-11-27T10:00:00Z'),
      durationMs: 900,
      outcome: 'ok',
      mcpServer: 'linear',
      mcpTool: 'create_issue'
    });
  });
});

describe('toolCallSessionPresenter', () => {
  it('returns the session a call belongs to', () => {
    expect(
      toolCallSessionPresenter({
        sessionKey: 'session-1',
        clientFamily: 'codex',
        toolCallId: 'call_1',
        occurredAt: new Date('2026-11-27T10:00:00Z')
      })
    ).toEqual({
      object: 'agent_tracking#tool_call_session',
      sessionKey: 'session-1',
      clientFamily: 'codex',
      toolCallId: 'call_1',
      occurredAt: new Date('2026-11-27T10:00:00Z')
    });
  });
});

describe('sessionTitlesShown', () => {
  it('shows session titles only when the organization turned them on', () => {
    expect(sessionTitlesShown(organization({}))).toBe(false);
    expect(sessionTitlesShown(organization({ desktop: { sessionTitles: true } }))).toBe(true);
  });
});

describe('toolCallRefPresenter', () => {
  it('returns an ambiguous call as it was asked for', () => {
    expect(toolCallRefPresenter({ clientFamily: 'codex', toolCallId: 'call_1' })).toEqual({
      clientFamily: 'codex',
      toolCallId: 'call_1'
    });
  });
});

describe('route input', () => {
  let scope = { organizationId: 'ator_1', instanceId: 'atin_1' };

  let lookups = (count: number, toolCallId = (index: number) => `toolu_${index}`) =>
    Array.from({ length: count }, (_, index) => ({
      clientFamily: 'claude-code',
      toolCallId: toolCallId(index)
    }));

  it('takes a session key for the MCP tool calls of a session', () => {
    expect(
      listMcpToolCallsInput.validate({ organizationId: 'ator_1', sessionKey: 'sk_1' }).success
    ).toBe(true);
    expect(listMcpToolCallsInput.validate({ organizationId: 'ator_1' }).success).toBe(false);
  });

  it('takes up to 200 tool calls to look up', () => {
    expect(findByToolCallsInput.validate({ ...scope, toolCalls: [] }).success).toBe(true);
    expect(findByToolCallsInput.validate({ ...scope, toolCalls: lookups(200) }).success).toBe(
      true
    );
    expect(findByToolCallsInput.validate({ ...scope, toolCalls: lookups(201) }).success).toBe(
      false
    );
  });

  it('accepts ids longer than ingest keeps and refuses empty ones', () => {
    expect(
      findByToolCallsInput.validate({ ...scope, toolCalls: lookups(2, () => 'x'.repeat(400)) })
        .success
    ).toBe(true);
    expect(
      findByToolCallsInput.validate({ ...scope, toolCalls: lookups(1, () => '') }).success
    ).toBe(false);
    expect(
      findByToolCallsInput.validate({
        ...scope,
        toolCalls: [{ clientFamily: '', toolCallId: 'toolu_1' }]
      }).success
    ).toBe(false);
  });

  it('needs the instance', () => {
    expect(
      findByToolCallsInput.validate({ organizationId: 'ator_1', toolCalls: lookups(1) })
        .success
    ).toBe(false);
  });
});
