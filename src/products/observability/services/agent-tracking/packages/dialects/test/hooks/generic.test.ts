import { fullIngestPolicy } from '@mtsrc/agent-tracking-spec';
import { describe, expect, it } from 'vitest';
import { buildMapped } from '../build';
import {
  claudeCodeHooks,
  codexHooks,
  createGenericHooks,
  genericHooksId,
  hookDialectFor
} from '../../src/hooks';
import { claudeHookPayloads, hookTime, sentinel } from './fixtures';

let context = { policy: fullIngestPolicy, identityHint: 'hint-1', occurredAt: hookTime };

describe('createGenericHooks', () => {
  let dialect = createGenericHooks('cursor');

  it('describes itself', () => {
    expect([dialect.id, dialect.adapter, dialect.client]).toEqual([
      'generic.hooks.v1',
      'generic',
      'cursor'
    ]);
    expect(genericHooksId).toBe('generic.hooks.v1');
  });

  it('always produces exactly one unmapped record', () => {
    let mapped = dialect.map(context, {
      hook_event_name: 'beforeShellExecution',
      conversation_id: 'conv-1',
      command: `ls ${sentinel}`
    });

    expect(mapped).toHaveLength(1);
    expect(mapped[0]).toMatchObject({
      source: { adapter: 'generic', dialect: 'generic.hooks.v1', channel: 'hook' },
      draft: {
        kind: 'event',
        type: 'unmapped',
        identity: 'conv-1|beforeShellExecution|hint-1',
        signalName: 'beforeShellExecution',
        occurredAt: hookTime,
        client: { family: 'cursor' },
        ctx: { sessionId: 'conv-1' },
        data: { native_name: 'beforeShellExecution' }
      }
    });
    expect(JSON.stringify(mapped)).not.toContain(sentinel);
  });

  it.each([
    [{ hook_event_name: 'a' }, 'a'],
    [{ hookEventName: 'b' }, 'b'],
    [{ event_name: 'c' }, 'c'],
    [{ event: 'd' }, 'd'],
    [{}, 'unknown'],
    [{ event: 5 }, 'unknown'],
    [{ event: '' }, 'unknown']
  ])('reads the event name from %j', (payload, expected) => {
    expect(dialect.map(context, payload)[0]?.draft.signalName).toBe(expected);
  });

  it.each([
    [{ session_id: 's1' }, 's1'],
    [{ sessionId: 's2' }, 's2'],
    [{ conversation_id: 's3' }, 's3'],
    [{ conversationId: 's4' }, 's4']
  ])('reads the session id from %j', (payload, expected) => {
    expect(dialect.map(context, payload)[0]?.draft.ctx?.sessionId).toBe(expected);
  });

  it('clamps long event names to the native label limit', () => {
    let draft = dialect.map(context, { event: 'e'.repeat(500) })[0]!.draft;

    expect(draft.signalName).toHaveLength(64);
    expect(draft.data).toEqual({ native_name: 'e'.repeat(64) });
  });

  it('defaults occurredAt to null', () => {
    expect(
      dialect.map({ policy: fullIngestPolicy, identityHint: 'h' }, {})[0]?.draft.occurredAt
    ).toBeNull();
  });

  it('builds a record without a session', () => {
    let record = buildMapped(dialect.map(context, {})[0]!);

    expect(record.type).toBe('unmapped');
    expect(record.client.family).toBe('cursor');
  });
});

describe('hookDialectFor', () => {
  it('returns the dedicated dialect for known clients', () => {
    expect(hookDialectFor('claude-code')).toBe(claudeCodeHooks);
    expect(hookDialectFor('codex')).toBe(codexHooks);
  });

  it('returns a generic dialect bound to the client otherwise', () => {
    let dialect = hookDialectFor('windsurf');

    expect(dialect.id).toBe(genericHooksId);
    expect(dialect.client).toBe('windsurf');
  });

  it.each(['constructor', '__proto__', 'toString', 'hasOwnProperty'])(
    'returns a working generic dialect for the client name %s',
    client => {
      let dialect = hookDialectFor(client);

      expect(dialect.id).toBe(genericHooksId);
      expect(dialect.map(context, {})).toHaveLength(1);
    }
  );
});

describe('codex hooks use the same event mapping', () => {
  it('maps the shared events', () => {
    for (let event of [
      'SessionStart',
      'UserPromptSubmit',
      'PreToolUse',
      'PostToolUse',
      'Stop'
    ]) {
      let claude = claudeCodeHooks.map(context, claudeHookPayloads[event]!);
      let codex = codexHooks.map(context, claudeHookPayloads[event]!);

      expect(codex.map(entry => entry.draft.type)).toEqual(
        claude.map(entry => entry.draft.type)
      );
      expect(codex[0]?.draft.client.family).toBe('codex');
    }
  });
});
