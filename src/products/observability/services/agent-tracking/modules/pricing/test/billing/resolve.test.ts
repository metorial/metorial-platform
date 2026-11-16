import { describe, expect, it } from 'vitest';
import type { MatchableDeclaration } from '../../src/lib/billing/match';
import {
  createDeclarationLookup,
  defaultBillingOf,
  inferClaudeCodeOverage,
  reportedBilling,
  resolveBillings,
  sessionProviderBilling,
  type BillingEntry
} from '../../src/lib/billing/resolve';

let declaration = (overrides: Partial<MatchableDeclaration> = {}): MatchableDeclaration => ({
  id: 'atbd_1',
  organizationId: 'ator_a',
  projectId: null,
  userId: null,
  agentId: null,
  mode: 'api',
  plan: null,
  validFrom: new Date('2026-01-01T00:00:00Z'),
  validTo: null,
  archivedAt: null,
  ...overrides
});

let minute = (n: number) => new Date(Date.UTC(2026, 2, 4, 10, n));

let request = (
  n: number,
  d: {
    purpose?: string;
    ttl?: '1h' | '5m';
    mode?: BillingEntry['billing']['mode'];
    source?: BillingEntry['billing']['source'];
    type?: string;
  } = {}
): BillingEntry => ({
  occurredAt: minute(n),
  type: d.type ?? 'model.request',
  ...(d.purpose ? { purpose: d.purpose } : {}),
  tokens: {
    inputUncached: 10,
    cacheRead: 0,
    cacheWrite: d.ttl ? 100 : 0,
    output: 5,
    reasoning: 0,
    ...(d.ttl == '1h' ? { cacheWrite1h: 100 } : {}),
    ...(d.ttl == '5m' ? { cacheWrite5m: 100 } : {})
  },
  billing: {
    mode: d.mode ?? 'included',
    source: d.source ?? 'reported',
    plan: 'max'
  }
});

let modes = (entries: BillingEntry[]) =>
  entries.map(entry => `${entry.billing.mode}:${entry.billing.source}`);

describe('reportedBilling', () => {
  it('reads the billing a dialect put on the record', () => {
    expect(reportedBilling({ billing: { mode: 'included', plan: 'max' } })).toEqual({
      mode: 'included',
      source: 'reported',
      plan: 'max'
    });
    expect(reportedBilling({ billing: { mode: 'api' } })).toEqual({
      mode: 'api',
      source: 'reported'
    });
  });

  it('falls back to the client auth mode of older records', () => {
    expect(reportedBilling({ billing: undefined, authMode: 'Chatgpt' })).toEqual({
      mode: 'included',
      source: 'reported'
    });
    expect(reportedBilling({ billing: undefined, authMode: 'ChatGPT' }).mode).toBe('included');
    expect(reportedBilling({ billing: undefined, authMode: 'subscription' }).mode).toBe(
      'included'
    );
    expect(reportedBilling({ billing: undefined, authMode: 'ApiKey' })).toEqual({
      mode: 'api',
      source: 'reported'
    });
    expect(reportedBilling({ billing: undefined, authMode: 'api_key' }).mode).toBe('api');
  });

  it('is unknown without a usable signal', () => {
    expect(reportedBilling({ billing: undefined })).toEqual({ mode: 'unknown' });
    expect(reportedBilling({ billing: { mode: 'unknown' } })).toEqual({ mode: 'unknown' });
    expect(reportedBilling({ billing: { mode: 'free' } })).toEqual({ mode: 'unknown' });
    expect(reportedBilling({ billing: 'included' })).toEqual({ mode: 'unknown' });
    expect(reportedBilling({ billing: undefined, authMode: 'oauth' })).toEqual({
      mode: 'unknown'
    });
  });
});

describe('sessionProviderBilling', () => {
  it('bills Codex sessions on a third-party provider per token', () => {
    expect(sessionProviderBilling({ family: 'codex', provider: 'azure' })).toEqual({
      mode: 'api',
      source: 'client'
    });
    expect(sessionProviderBilling({ family: 'codex', provider: 'other:ollama' })).toEqual({
      mode: 'api',
      source: 'client'
    });
  });

  it('says nothing for the first-party provider, other families or no provider', () => {
    expect(sessionProviderBilling({ family: 'codex', provider: 'openai' })).toBeUndefined();
    expect(sessionProviderBilling({ family: 'codex', provider: undefined })).toBeUndefined();
    expect(
      sessionProviderBilling({ family: 'claude-code', provider: 'bedrock' })
    ).toBeUndefined();
  });
});

describe('defaultBillingOf', () => {
  it('treats subscription-only clients as included', () => {
    expect(defaultBillingOf('kiro')).toEqual({ mode: 'included', source: 'default' });
    expect(defaultBillingOf('claude-code')).toBeUndefined();
  });
});

describe('inferClaudeCodeOverage', () => {
  it('flags plan usage from a 5-minute main-thread write until the 1-hour TTL returns', () => {
    let entries = [
      request(0, { purpose: 'main', ttl: '1h' }),
      request(1, { purpose: 'subagent', ttl: '5m' }),
      request(2, { purpose: 'main' }),
      request(3, { purpose: 'main', ttl: '5m' }),
      request(4, { purpose: 'subagent', ttl: '5m' }),
      request(5, { type: 'usage.charge' }),
      request(6, { purpose: 'main', ttl: '1h' }),
      request(7, { purpose: 'subagent' })
    ];

    expect(inferClaudeCodeOverage(entries)).toBe(3);
    expect(modes(entries)).toEqual([
      'included:reported',
      'included:reported',
      'included:reported',
      'overage:inferred',
      'overage:inferred',
      'overage:inferred',
      'included:reported',
      'included:reported'
    ]);
    expect(entries[3]!.billing.plan).toBe('max');
  });

  it('walks the entries in time order', () => {
    let entries = [
      request(3, { purpose: 'subagent' }),
      request(2, { purpose: 'main', ttl: '5m' }),
      request(0, { purpose: 'main', ttl: '1h' })
    ];

    inferClaudeCodeOverage(entries);

    expect(modes(entries)).toEqual([
      'overage:inferred',
      'overage:inferred',
      'included:reported'
    ]);
  });

  it('flags nothing when the main thread never showed the 1-hour TTL', () => {
    let entries = [
      request(0, { purpose: 'main', ttl: '5m' }),
      request(1, { purpose: 'main', ttl: '5m' }),
      request(2, { purpose: 'subagent', ttl: '1h' })
    ];

    expect(inferClaudeCodeOverage(entries)).toBe(0);
    expect(modes(entries)).toEqual([
      'included:reported',
      'included:reported',
      'included:reported'
    ]);
  });

  it('ignores compaction writes and leaves API and declared usage alone', () => {
    let entries = [
      request(0, { purpose: 'main', ttl: '1h' }),
      request(1, { purpose: 'compaction', ttl: '5m' }),
      request(2, { purpose: 'main', ttl: '5m', mode: 'api' }),
      request(3, { purpose: 'main', ttl: '5m', source: 'declared' }),
      request(4, { purpose: 'main' })
    ];

    expect(inferClaudeCodeOverage(entries)).toBe(0);
    expect(modes(entries)).toEqual([
      'included:reported',
      'included:reported',
      'api:reported',
      'included:declared',
      'included:reported'
    ]);
  });
});

describe('createDeclarationLookup', () => {
  it('is null without declarations', () => {
    expect(
      createDeclarationLookup({
        declarations: [],
        organizationId: 'ator_a',
        projectId: 'atpr_a'
      })
    ).toBeNull();
  });

  it('matches in the session scope', () => {
    let lookup = createDeclarationLookup({
      declarations: [
        declaration({ id: 'atbd_org' }),
        declaration({ id: 'atbd_user', userId: 'aten_user', mode: 'included', plan: 'pro' }),
        declaration({ id: 'atbd_other', projectId: 'atpr_b', mode: 'included' })
      ],
      organizationId: 'ator_a',
      projectId: 'atpr_a'
    })!;

    expect(lookup({ at: minute(0) })?.id).toBe('atbd_org');
    expect(lookup({ at: minute(0), userId: 'aten_user' })?.id).toBe('atbd_user');
    expect(lookup({ at: new Date('2025-12-31T00:00:00Z') })).toBeUndefined();
  });
});

describe('resolveBillings', () => {
  let entry = (mode: BillingEntry['billing']['mode'], userId?: string) => ({
    ...request(0),
    billing: mode == 'unknown' ? { mode } : { mode, source: 'reported' as const },
    ...(userId ? { userId } : {})
  });

  it('fills only unknown entries from a declaration, then from the default', () => {
    let lookup = createDeclarationLookup({
      declarations: [
        declaration({ id: 'atbd_user', userId: 'aten_user', mode: 'included', plan: 'pro' }),
        declaration({ id: 'atbd_agent', agentId: 'cursor', mode: 'api' })
      ],
      organizationId: 'ator_a',
      projectId: 'atpr_a'
    });

    let entries = [entry('api', 'aten_user'), entry('unknown', 'aten_user'), entry('unknown')];
    resolveBillings({ family: 'cursor', agentId: 'cursor', entries, declarations: lookup });

    expect(entries.map(item => item.billing)).toEqual([
      { mode: 'api', source: 'reported' },
      { mode: 'included', source: 'declared', plan: 'pro' },
      { mode: 'api', source: 'declared' }
    ]);

    let fallback = [entry('unknown'), entry('unknown')];
    resolveBillings({
      family: 'kiro',
      entries: fallback,
      declarations: createDeclarationLookup({
        declarations: [declaration({ userId: 'aten_nobody' })],
        organizationId: 'ator_a',
        projectId: 'atpr_a'
      }),
      defaultBilling: defaultBillingOf('kiro')
    });
    expect(fallback.map(item => item.billing)).toEqual([
      { mode: 'included', source: 'default' },
      { mode: 'included', source: 'default' }
    ]);

    let none = [entry('unknown')];
    resolveBillings({ family: 'cursor', entries: none });
    expect(none[0]!.billing).toEqual({ mode: 'unknown' });
  });

  it('lets a third-party Codex provider override the sign-in', () => {
    let entries = [entry('included'), entry('unknown')];
    resolveBillings({ family: 'codex', sessionProvider: 'azure', entries });

    expect(entries.map(item => item.billing)).toEqual([
      { mode: 'api', source: 'client' },
      { mode: 'api', source: 'client' }
    ]);
  });

  it('infers Claude Code overage only for Claude Code', () => {
    let claude = [
      request(0, { purpose: 'main', ttl: '1h' }),
      request(1, { purpose: 'main', ttl: '5m' })
    ];
    let other = [
      request(0, { purpose: 'main', ttl: '1h' }),
      request(1, { purpose: 'main', ttl: '5m' })
    ];

    resolveBillings({ family: 'claude-code', entries: claude });
    resolveBillings({ family: 'opencode', entries: other });

    expect(modes(claude)).toEqual(['included:reported', 'overage:inferred']);
    expect(modes(other)).toEqual(['included:reported', 'included:reported']);
  });
});
