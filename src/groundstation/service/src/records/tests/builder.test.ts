import { describe, expect, it } from 'vitest';
import { recordSpecVersion } from '@metorial/groundstation-spec';
import { contentHash, recordId, sessionKey } from '../../crypto/keys';
import {
  buildNow,
  buildDraft,
  unitContext,
  unitPrincipal,
  unitTenantKey
} from '../../test/build';
import { buildRecord, isPlausibleTime, safeLabel } from '../builder';
import type { RecordDraft } from '../draft';

let draft = (overrides: Partial<RecordDraft> = {}): RecordDraft => ({
  kind: 'event',
  type: 'session.start',
  identity: 'id-1',
  client: { family: 'claude-code' },
  ...overrides
});

let iso = (value: string) => new Date(value);

describe('isPlausibleTime', () => {
  it('accepts dates inside the plausible window', () => {
    expect(isPlausibleTime(iso('2015-01-01T00:00:00Z'))).toBe(true);
    expect(isPlausibleTime(iso('2099-12-31T23:59:59Z'))).toBe(true);
  });

  it.each([
    null,
    undefined,
    iso('2014-12-31T23:59:59Z'),
    iso('2100-01-01T00:00:00Z'),
    new Date(NaN)
  ])('rejects %s', value => {
    expect(isPlausibleTime(value)).toBe(false);
  });

  it('rejects epoch zero', () => {
    expect(isPlausibleTime(new Date(0))).toBe(false);
  });
});

describe('safeLabel', () => {
  it('passes labels made of safe characters', () => {
    expect(safeLabel('claude-code/1.2.3+build@x')).toBe('claude-code/1.2.3+build@x');
    expect(safeLabel('  trimmed  ')).toBe('trimmed');
  });

  it.each([
    '',
    '   ',
    'a\nb',
    'semi;colon',
    '<script>',
    'ünï',
    'a'.repeat(129),
    5,
    null,
    undefined
  ])('falls back for %j', value => {
    expect(safeLabel(value)).toBe('unknown');
  });

  it('accepts the maximum length and honors the fallback', () => {
    expect(safeLabel('a'.repeat(128))).toHaveLength(128);
    expect(safeLabel('!', 'none')).toBe('none');
  });
});

describe('buildRecord shape', () => {
  it('builds a complete record', () => {
    let record = buildDraft(
      draft({
        type: 'tool.call',
        signalName: 'PostToolUse',
        nativeVersion: '2.1.0',
        occurredAt: new Date('2026-06-15T11:59:00Z'),
        durationMs: 12.6,
        client: { family: 'claude-code', version: '2.1.0', surface: 'cli' },
        actor: { identity_source: 'client_claim', user: { id: 'u1' } },
        workspace: { os: 'darwin' },
        ctx: {
          sessionId: 's1',
          turnId: 't1',
          requestId: 'r1',
          toolCallId: 'c1',
          agent: { id: 'a1', parentId: 'a0' },
          trace: { traceId: 'tr', spanId: 'sp' }
        },
        data: { tool: 'Bash' },
        extras: { plan: 'max' }
      }),
      { batchId: 'batch_1', agent: { name: 'cli', version: '1', install_id: 'inst' } }
    );

    let key = unitTenantKey();

    expect(record).toMatchObject({
      spec: recordSpecVersion,
      id: recordId(key, 'test/hook', 'id-1'),
      kind: 'event',
      type: 'tool.call',
      occurred_at: '2026-06-15T11:59:00.000Z',
      duration_ms: 13,
      observed_at: buildNow.toISOString(),
      ingest: {
        tenant_id: 'gst_unit',
        credential_id: 'itk_unit',
        route: 'hook',
        request_id: 'req_unit',
        backfill: false,
        batch_id: 'batch_1',
        principal: { ref: 'user_1' },
        agent: { name: 'cli', version: '1', install_id: 'inst' }
      },
      source: {
        adapter: 'test',
        dialect: 'test.v1',
        channel: 'hook',
        signal_name: 'PostToolUse',
        role: 'primary',
        fact_key: null,
        native_version: '2.1.0'
      },
      client: { family: 'claude-code', version: '2.1.0', surface: 'cli' },
      actor: { identity_source: 'client_claim', user: { id: 'u1' } },
      workspace: { os: 'darwin' },
      ctx: {
        session_id: 's1',
        session_key: sessionKey(key, 'claude-code', 's1'),
        turn_id: 't1',
        request_id: 'r1',
        tool_call_id: 'c1',
        agent: { id: 'a1', parent_id: 'a0' },
        trace: { trace_id: 'tr', span_id: 'sp' }
      },
      data: { tool: 'Bash' },
      content: [],
      extras: { 'x.claude-code.plan': 'max' },
      quality: {
        coerced: [],
        derived: [],
        dropped: [],
        warnings: [],
        time_source: 'client'
      }
    });
  });

  it('omits optional blocks that were not provided', () => {
    let record = buildDraft(draft());

    expect(record).not.toHaveProperty('duration_ms');
    expect(record).not.toHaveProperty('actor');
    expect(record).not.toHaveProperty('workspace');
    expect(record.ingest).not.toHaveProperty('batch_id');
    expect(record.ingest).not.toHaveProperty('agent');
    expect(record.ctx).toEqual({});
    expect(record.data).toEqual({});
    expect(record.source).not.toHaveProperty('signal_name');
    expect(record.source).not.toHaveProperty('native_version');
  });

  it('serializes without undefined values', () => {
    let record = buildDraft(
      draft({
        ctx: { sessionId: 's', turnId: undefined, agent: {} },
        client: { family: 'codex', version: undefined }
      })
    );

    let roundTripped = JSON.parse(JSON.stringify(record));

    expect(roundTripped).toEqual(record);
    expect(Object.values(record.client)).not.toContain(undefined);
  });

  it('records a null principal when the token has none', () => {
    let record = buildDraft(draft(), { principal: unitPrincipal({ principalRef: null }) });

    expect(record.ingest.principal).toBeNull();
  });

  it('marks backfill-lane records', () => {
    expect(buildDraft(draft(), { lane: 'backfill' }).ingest.backfill).toBe(true);
    expect(buildDraft(draft(), { lane: 'live' }).ingest.backfill).toBe(false);
  });

  it('keeps an explicit role', () => {
    expect(buildDraft(draft({ role: 'supplemental' })).source.role).toBe('supplemental');
  });

  it('does not alias the draft arrays', () => {
    let source = draft({ warnings: ['w'], coerced: ['c'], derived: ['d'], dropped: ['x'] });
    let record = buildDraft(source, { itemObservedAt: null });

    record.quality.warnings.push('mutated');

    expect(source.warnings).toEqual(['w']);
    expect(record.quality).toMatchObject({ coerced: ['c'], derived: ['d'], dropped: ['x'] });
  });

  it.each([-5, 0, 0.4, 0.5, 1.5, 999.49])('rounds duration %s', value => {
    let record = buildDraft(draft({ durationMs: value }));

    expect(record.duration_ms).toBe(Math.max(0, Math.round(value)));
  });

  it.each([NaN, Infinity, -Infinity])('omits a non-finite duration (%s)', value => {
    expect(buildDraft(draft({ durationMs: value }))).not.toHaveProperty('duration_ms');
  });
});

describe('buildRecord time rules', () => {
  let near = new Date(buildNow.getTime() - 60_000);

  it('prefers a plausible client time', () => {
    let record = buildDraft(draft({ occurredAt: near }), {
      itemObservedAt: iso('2026-06-15T11:00:00Z')
    });

    expect(record.occurred_at).toBe(near.toISOString());
    expect(record.quality.time_source).toBe('client');
    expect(record.quality.warnings).toEqual([]);
  });

  it('uses the agent-observed time when the draft has none', () => {
    let observed = iso('2026-06-15T11:58:00Z');
    let record = buildDraft(draft(), { itemObservedAt: observed });

    expect(record.occurred_at).toBe(observed.toISOString());
    expect(record.quality.time_source).toBe('agent_observed');
    expect(record.quality.warnings).toEqual([]);
    expect(record.quality.dropped).toEqual([]);
  });

  it('falls back to agent time and flags an invalid client time', () => {
    let observed = iso('2026-06-15T11:58:00Z');
    let record = buildDraft(draft({ occurredAt: new Date(NaN) }), {
      itemObservedAt: observed
    });

    expect(record.quality.time_source).toBe('agent_observed');
    expect(record.quality.dropped).toContain('occurred_at');
    expect(record.quality.warnings).toContain('invalid_time');
  });

  it('flags an implausible client time and uses arrival time', () => {
    let record = buildDraft(draft({ occurredAt: iso('1999-01-01T00:00:00Z') }));

    expect(record.occurred_at).toBe(buildNow.toISOString());
    expect(record.quality.time_source).toBe('observed');
    expect(record.quality.dropped).toEqual(['occurred_at']);
    expect(record.quality.warnings).toEqual(['invalid_time']);
  });

  it('uses arrival time with time_unknown when nothing carries a time', () => {
    let record = buildDraft(draft());

    expect(record.occurred_at).toBe(buildNow.toISOString());
    expect(record.quality.time_source).toBe('observed');
    expect(record.quality.warnings).toEqual(['time_unknown']);
  });

  it('does not warn when arrival is the event time', () => {
    let record = buildDraft(draft(), { arrivalIsEventTime: true });

    expect(record.quality.time_source).toBe('observed');
    expect(record.quality.warnings).toEqual([]);
  });

  it('ignores an implausible agent-observed time', () => {
    let record = buildDraft(draft(), { itemObservedAt: new Date(0) });

    expect(record.quality.time_source).toBe('observed');
    expect(record.quality.warnings).toEqual(['time_unknown']);
  });

  it('flags clock skew beyond the tenant bound in either direction', () => {
    let past = new Date(buildNow.getTime() - 301_000);
    let future = new Date(buildNow.getTime() + 301_000);

    expect(buildDraft(draft({ occurredAt: past })).quality.warnings).toEqual(['clock_skew']);
    expect(buildDraft(draft({ occurredAt: future })).quality.warnings).toEqual(['clock_skew']);
  });

  it('allows skew exactly at the bound', () => {
    let edge = new Date(buildNow.getTime() - 300_000);

    expect(buildDraft(draft({ occurredAt: edge })).quality.warnings).toEqual([]);
  });

  it('respects a custom skew bound', () => {
    let principal = unitPrincipal({ skewBoundSeconds: 10 });
    let occurredAt = new Date(buildNow.getTime() - 11_000);

    expect(buildDraft(draft({ occurredAt }), { principal }).quality.warnings).toEqual([
      'clock_skew'
    ]);
  });

  it('flags skew on agent-observed times too', () => {
    let observed = new Date(buildNow.getTime() - 3_600_000);

    expect(buildDraft(draft(), { itemObservedAt: observed }).quality.warnings).toEqual([
      'clock_skew'
    ]);
  });

  it('never flags skew in the backfill lane', () => {
    let old = iso('2026-01-01T00:00:00Z');
    let record = buildDraft(draft({ occurredAt: old }), { lane: 'backfill' });

    expect(record.quality.warnings).toEqual([]);
    expect(record.occurred_at).toBe(old.toISOString());
  });

  it('never flags skew for arrival-derived time', () => {
    expect(buildDraft(draft()).quality.warnings).not.toContain('clock_skew');
  });

  it('preserves draft warnings alongside time warnings', () => {
    let record = buildDraft(draft({ warnings: ['custom'] }));

    expect(record.quality.warnings).toEqual(['custom', 'time_unknown']);
  });
});

describe('buildRecord identity', () => {
  it('derives ids deterministically from adapter, channel and identity', () => {
    let a = buildDraft(draft());
    let b = buildDraft(draft());

    expect(a.id).toBe(b.id);
    expect(a.id).toMatch(/^[0-9a-f]{32}$/);
  });

  it('changes the id with the identity, adapter or channel', () => {
    let base = buildDraft(draft()).id;

    expect(buildDraft(draft({ identity: 'id-2' })).id).not.toBe(base);
    expect(
      buildDraft(draft(), {}, { adapter: 'other', dialect: 'test.v1', channel: 'hook' }).id
    ).not.toBe(base);
    expect(
      buildDraft(draft(), {}, { adapter: 'test', dialect: 'test.v1', channel: 'otlp.logs' }).id
    ).not.toBe(base);
  });

  it('does not depend on time, request, lane or dialect version', () => {
    let a = buildDraft(draft({ occurredAt: iso('2026-06-15T11:00:00Z') }));
    let b = buildRecord(
      unitContext({
        requestId: 'req_other',
        lane: 'backfill',
        observedAt: iso('2026-06-16T00:00:00Z')
      }),
      { adapter: 'test', dialect: 'test.v2', channel: 'hook' },
      draft({ occurredAt: iso('2026-06-14T11:00:00Z') })
    );

    expect(a.id).toBe(b.id);
  });

  it('isolates tenants', () => {
    let other = unitPrincipal();
    other.tenant.id = 'gst_other';

    expect(buildDraft(draft(), { principal: other }).id).not.toBe(buildDraft(draft()).id);
  });

  it('hashes the session id with the client family', () => {
    let a = buildDraft(draft({ ctx: { sessionId: 's' } }));
    let b = buildDraft(draft({ ctx: { sessionId: 's' }, client: { family: 'codex' } }));

    expect(a.ctx.session_key).not.toBe(b.ctx.session_key);
  });

  it('omits the session key without a session id', () => {
    expect(buildDraft(draft({ ctx: { sessionId: '' } })).ctx).toEqual({});
  });
});

describe('buildRecord fact keys', () => {
  it('substitutes the session key', () => {
    let record = buildDraft(
      draft({ factKey: 'tool:{session_key}:t1', ctx: { sessionId: 's1' } })
    );

    expect(record.source.fact_key).toBe(`tool:${record.ctx.session_key}:t1`);
  });

  it('nulls a templated fact key without a session', () => {
    expect(buildDraft(draft({ factKey: 'tool:{session_key}:t1' })).source.fact_key).toBeNull();
  });

  it('passes literal fact keys through', () => {
    expect(buildDraft(draft({ factKey: 'literal' })).source.fact_key).toBe('literal');
    expect(buildDraft(draft({ factKey: null })).source.fact_key).toBeNull();
  });

  it('is identical for duplicates of the same logical event', () => {
    let a = buildDraft(
      draft({ identity: 'hook-1', factKey: 'k:{session_key}', ctx: { sessionId: 's' } })
    );
    let b = buildDraft(
      draft({ identity: 'otlp-1', factKey: 'k:{session_key}', ctx: { sessionId: 's' } }),
      {},
      { adapter: 'other', dialect: 'x', channel: 'otlp.logs' }
    );

    expect(a.source.fact_key).toBe(b.source.fact_key);
    expect(a.id).not.toBe(b.id);
  });
});

describe('buildRecord id clamping', () => {
  it('truncates long ids and records a warning per field', () => {
    let long = 'x'.repeat(1000);

    let record = buildDraft(
      draft({
        ctx: {
          sessionId: long,
          turnId: long,
          requestId: long,
          toolCallId: long,
          agent: { id: long, parentId: long }
        }
      })
    );

    expect(record.ctx.session_id).toHaveLength(256);
    expect(record.ctx.turn_id).toHaveLength(256);
    expect(record.ctx.request_id).toHaveLength(256);
    expect(record.ctx.tool_call_id).toHaveLength(256);
    expect(record.ctx.agent?.id).toHaveLength(256);
    expect(record.ctx.agent?.parent_id).toHaveLength(256);

    expect(record.quality.warnings).toEqual([
      'time_unknown',
      'truncated:ctx.session_id',
      'truncated:ctx.turn_id',
      'truncated:ctx.request_id',
      'truncated:ctx.tool_call_id',
      'truncated:ctx.agent.id',
      'truncated:ctx.agent.parent_id'
    ]);
  });

  it('keeps ids at exactly the limit', () => {
    let record = buildDraft(draft({ ctx: { sessionId: 'x'.repeat(256) } }));

    expect(record.ctx.session_id).toHaveLength(256);
    expect(record.quality.warnings).toEqual(['time_unknown']);
  });

  it('derives the session key from the truncated id', () => {
    let a = buildDraft(draft({ ctx: { sessionId: 'x'.repeat(300) } }));
    let b = buildDraft(draft({ ctx: { sessionId: 'x'.repeat(256) } }));

    expect(a.ctx.session_key).toBe(b.ctx.session_key);
  });
});

describe('buildRecord content and extras', () => {
  it('builds content entries under the principal policy and drops empty ones', () => {
    let principal = unitPrincipal({ contentPolicy: { defaultMode: 'full' } });

    let record = buildDraft(
      draft({
        content: [
          { role: 'prompt', value: 'hello' },
          { role: 'response' },
          { role: 'tool_output', clientLength: 10 }
        ]
      }),
      { principal }
    );

    expect(record.content).toHaveLength(2);
    expect(record.content[0]).toMatchObject({ role: 'prompt', mode: 'full', text: 'hello' });
    expect(record.content[0]?.hash?.value).toBe(
      contentHash(unitTenantKey(principal), 'prompt', 'hello')
    );
    expect(record.content[1]).toMatchObject({ role: 'tool_output', state: 'length_only' });
  });

  it('stores no text under the default policy', () => {
    let record = buildDraft(draft({ content: [{ role: 'prompt', value: 'secret text' }] }));

    expect(JSON.stringify(record)).not.toContain('secret text');
  });

  it('sanitizes extras and reports what was dropped', () => {
    let record = buildDraft(
      draft({ extras: { plan: 'max', user_prompt: 'x', nope: null }, dropped: ['a'] })
    );

    expect(record.extras).toEqual({ 'x.claude-code.plan': 'max' });
    expect(record.quality.dropped).toEqual(['a', 'extras.content_key', 'extras.nope']);
  });
});
