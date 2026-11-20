import { describe, expect, it } from 'vitest';
import { readCostState, readMessageUsage } from '../../src/reconcile/claude';
import { compareClaudeSession, compareCodexSession } from '../../src/reconcile/compare';
import {
  claudeClientRow,
  clientOnlySummary,
  clientOnlyText,
  liveRow,
  liveSummary,
  liveText,
  localOnlyRows,
  perDay
} from '../../src/reconcile/report';
import {
  assistantLines,
  costState,
  secretPath,
  secretText,
  serviceSession,
  tokens,
  usage,
  userLine
} from './fixtures';

let entries = [
  userLine('2026-11-01T10:00:00.000Z'),
  ...assistantLines({
    messageId: 'msg_1',
    blocks: 2,
    at: '2026-11-01T10:00:01.000Z',
    usage: usage({ input: 10, output: 2 })
  })
];

let row = (state: ReturnType<typeof costState> | null, sessionId = 'session-a') =>
  claudeClientRow({
    sessionId,
    costState: state ? readCostState([state]) : null,
    messages: readMessageUsage([entries])
  });

describe('client-only report', () => {
  it('holds ids, model names, counts and amounts, never text or paths from the transcript', () => {
    let rows = [
      row(
        costState({
          totalCostUSD: 0.01,
          models: { 'claude-opus-4-1-20250805': { inputTokens: 10, outputTokens: 2 } }
        })
      )
    ];
    let summary = clientOnlySummary({ claude: rows, codex: [] });
    let text = clientOnlyText({ claude: rows, codex: [], summary });

    for (let output of [JSON.stringify(rows), JSON.stringify(summary), text]) {
      expect(output).not.toContain(secretText);
      expect(output).not.toContain(secretPath);
    }

    expect(rows[0]).toMatchObject({
      sessionId: 'session-a',
      models: ['claude-opus-4-1-20250805'],
      messages: 1,
      perLineFactor: 2,
      comparison: { equal: true }
    });
  });

  it('counts how often the cost-state equals the message sum, and the typical difference', () => {
    let rows = [
      row(
        costState({ totalCostUSD: 0.01, models: { m: { inputTokens: 10, outputTokens: 2 } } }),
        's1'
      ),
      row(
        costState({ totalCostUSD: 0.02, models: { m: { inputTokens: 30, outputTokens: 2 } } }),
        's2'
      ),
      row(
        costState({ totalCostUSD: 0.01, models: { m: { inputTokens: 5, outputTokens: 2 } } }),
        's3'
      ),
      row(null, 's4')
    ];

    let summary = clientOnlySummary({ claude: rows, codex: [] });

    expect(summary.claude).toMatchObject({
      sessions: 4,
      withCostState: 3,
      costStateEqualsMessages: 1,
      costStateAboveMessages: 1,
      costStateBehindMessages: 1
    });
    expect(summary.claude.relativeDifference.inputUncached).toMatchObject({
      count: 2,
      max: 2
    });
    expect(summary.sizing.claudeSessionsPerDay.days).toEqual({ '2026-11-01': 4 });
  });
});

describe('live report', () => {
  let messages = readMessageUsage([entries]);
  let state = readCostState([
    costState({
      totalCostUSD: 0.5,
      models: {
        'claude-opus-4-1-20250805': { inputTokens: 10, outputTokens: 2, costUSD: 0.5 }
      }
    })
  ]);

  let claudeRow = (service: ReturnType<typeof serviceSession>) =>
    liveRow({
      sessionId: 'session-a',
      service,
      comparison: {
        family: 'claude-code',
        result: compareClaudeSession({ costState: state, messages, service }),
        tokens: tokens({ inputUncached: 10, output: 2 }),
        costUsd: 0.5,
        models: ['claude-opus-4-1-20250805']
      }
    });

  let unmatched = liveRow({
    sessionId: null,
    service: serviceSession({ sessionKey: 'key-x', tokens: tokens({}) }),
    comparison: null
  });

  let summarize = (
    rows: ReturnType<typeof liveRow>[],
    failUnmatched = false,
    localOnly = []
  ) => liveSummary({ rows, localOnly, localSessions: 2, failUnmatched });

  it('fails the run only on a failing Claude Code session, never on Codex', () => {
    let matching = serviceSession({ tokens: tokens({ inputUncached: 10, output: 2 }) });
    let codexService = serviceSession({
      sessionKey: 'key-c',
      family: 'codex',
      tokens: tokens({ inputUncached: 99 })
    });
    let codexRollout = {
      threadId: 'thread-c',
      sessionId: null,
      parentThreadId: null,
      models: [],
      tokenCountEvents: 1,
      total: {
        input: 1,
        cachedInput: 0,
        cacheWriteInput: 0,
        output: 0,
        reasoningOutput: 0,
        total: 1
      },
      span: { firstAt: null, lastAt: null }
    };

    let rows = [
      claudeRow(matching),
      liveRow({
        sessionId: 'thread-c',
        service: codexService,
        comparison: {
          family: 'codex',
          result: compareCodexSession({ rollout: codexRollout, service: codexService }),
          tokens: null,
          models: []
        }
      }),
      unmatched
    ];

    let summary = summarize(rows);
    expect(summary).toMatchObject({
      passed: true,
      failures: [],
      claude: { serviceSessions: 2, compared: 1, pass: 1, fail: 0, serviceWithoutLocal: 1 },
      codex: { serviceSessions: 1, reported: 1, tokensMatch: 0 },
      sizing: {
        modelRequestsPerSession: { count: 3, mean: 2 },
        toolCallsPerSession: { mean: 3 }
      }
    });
    expect(JSON.stringify(summary)).not.toMatch(/bytes/i);
    expect(liveText({ rows, localOnly: [], summary })).toMatch(
      /^Result: PASS\nClaude Code: compared 1 \(passed 1, failed 0\)/
    );

    let failed = summarize([
      claudeRow(serviceSession({ tokens: tokens({ inputUncached: 11, output: 2 }) }))
    ]);
    expect(failed).toMatchObject({
      passed: false,
      failures: [{ reason: 'sessions_failed' }],
      claude: { fail: 1, failedChecks: { tokens: 1 } }
    });
  });

  it('fails a run that compared no Claude Code session and names the likely causes', () => {
    let summary = summarize([unmatched]);

    expect(summary).toMatchObject({
      passed: false,
      failures: [{ reason: 'nothing_compared' }],
      claude: { compared: 0, serviceWithoutLocal: 1 }
    });
    expect(summary.failures[0]!.note).toContain('hash secret');
    expect(liveText({ rows: [], localOnly: [], summary })).toContain('FAIL nothing_compared');
  });

  it('reports a session still settling as not settled, not as failed', () => {
    let stale = liveRow({
      sessionId: 'session-a',
      service: serviceSession({ tokens: tokens({ inputUncached: 1 }), summaryStale: true }),
      notSettled: true,
      comparison: null
    });

    expect(stale).toMatchObject({ status: 'not_settled', findings: [] });
    expect(
      summarize([
        claudeRow(serviceSession({ tokens: tokens({ inputUncached: 10, output: 2 }) })),
        stale
      ])
    ).toMatchObject({
      passed: true,
      claude: { compared: 1, notSettled: 1, fail: 0 }
    });
  });

  it('fails unmatched sessions on either side only with --fail-unmatched', () => {
    let matched = claudeRow(
      serviceSession({ tokens: tokens({ inputUncached: 10, output: 2 }) })
    );
    let missing = localOnlyRows({
      family: 'claude-code',
      sessions: [
        {
          sessionId: 'lost',
          hasUsage: true,
          firstAt: null,
          lastAt: new Date('2026-11-02T00:00:00.000Z')
        }
      ],
      matched: new Set(),
      windowStart: null
    });

    expect(summarize([matched, unmatched])).toMatchObject({ passed: true });
    expect(summarize([matched, unmatched], true)).toMatchObject({
      passed: false,
      failures: [{ reason: 'unmatched_sessions' }]
    });
    expect(
      liveSummary({
        rows: [matched],
        localOnly: missing,
        localSessions: 2,
        failUnmatched: true
      })
    ).toMatchObject({ passed: false, claude: { localWithoutService: 1 } });
    expect(
      liveSummary({
        rows: [matched],
        localOnly: missing,
        localSessions: 2,
        failUnmatched: false
      })
    ).toMatchObject({ passed: true, claude: { localWithoutService: 1 } });
  });

  it('lists local sessions the service lacks within the window the run covers', () => {
    let rows = localOnlyRows({
      family: 'claude-code',
      sessions: [
        {
          sessionId: 'seen',
          hasUsage: true,
          firstAt: null,
          lastAt: new Date('2026-11-03T00:00:00.000Z')
        },
        {
          sessionId: 'lost',
          hasUsage: true,
          firstAt: null,
          lastAt: new Date('2026-11-03T00:00:00.000Z')
        },
        {
          sessionId: 'empty',
          hasUsage: false,
          firstAt: null,
          lastAt: new Date('2026-11-03T00:00:00.000Z')
        },
        {
          sessionId: 'older',
          hasUsage: true,
          firstAt: null,
          lastAt: new Date('2026-10-01T00:00:00.000Z')
        }
      ],
      matched: new Set(['seen']),
      windowStart: new Date('2026-11-01T00:00:00.000Z')
    });

    expect(rows.map(row => [row.sessionId, row.hasUsage])).toEqual([
      ['lost', true],
      ['empty', false]
    ]);
  });
});

describe('figures', () => {
  it('counts sessions per UTC day', () => {
    expect(
      perDay([
        '2026-11-01T23:00:00.000Z',
        '2026-11-01T01:00:00.000Z',
        '2026-11-02T00:00:00.000Z',
        null
      ])
    ).toMatchObject({
      days: { '2026-11-01': 2, '2026-11-02': 1 },
      count: 2,
      mean: 1.5
    });
  });
});
