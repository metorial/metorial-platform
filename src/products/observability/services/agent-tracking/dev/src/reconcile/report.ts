import type { ClaudeCostState, ClaudeMessageUsage } from './claude';
import type { CodexRollout } from './codex';
import {
  compareCostStateWithMessages,
  explanations,
  type ClaudeComparison,
  type ClientOnlyComparison,
  type CodexComparison,
  type ExplanationKey,
  type ServiceSession
} from './compare';
import type { Tokens } from '@mtsrc/agent-tracking-cost';
import { mean, percentile } from '../lib/stats';
import { sumTokens, tokenComponents, tokenTotal, type TokenComponent } from './tokens';

type ClaudeClientRow = {
  sessionId: string;
  models: string[];
  files: number;
  lines: number;
  messages: number;
  firstAt: string | null;
  lastAt: string | null;
  costState: {
    entries: number;
    totalCostUsd: number;
    hasUnknownModelCost: boolean;
    tokens: Tokens;
    models: { model: string; tokens: Tokens; costUsd: number }[];
  } | null;
  messageTokens: Tokens;
  perLineFactor: number | null;
  withIterationsFactor: number | null;
  comparison: ClientOnlyComparison | null;
};

type CodexClientRow = {
  threadId: string | null;
  parentThreadId: string | null;
  models: string[];
  tokenCountEvents: number;
  total: CodexRollout['total'];
  firstAt: string | null;
  lastAt: string | null;
};

type LiveStatus = 'pass' | 'fail' | 'reported' | 'no_local_record' | 'not_settled';

export type LiveRow = {
  family: string;
  sessionId: string | null;
  sessionKey: string;
  status: LiveStatus;
  reference: ClaudeComparison['reference'] | 'rollout' | null;
  costStateBehind: boolean;
  findings: ClaudeComparison['findings'];
  codex: CodexComparison | null;
  service: {
    requests: number;
    toolCalls: number;
    tokens: Tokens;
    reportedCostUsd: number | null;
    computedCostUsd: number | null;
    models: string[];
    summaryStale: boolean;
    startedAt: string | null;
  };
  client: { tokens: Tokens | null; costUsd: number | null; models: string[] } | null;
};

type LocalOnlyRow = {
  family: string;
  sessionId: string;
  hasUsage: boolean;
  firstAt: string | null;
  lastAt: string | null;
};

let iso = (date: Date | null) => (date ? date.toISOString() : null);

let ratio = (value: number, base: number) => (base > 0 ? value / base : null);

let distribution = (values: number[]) => {
  let sorted = [...values].sort((a, b) => a - b);

  return {
    count: values.length,
    mean: mean(values),
    median: percentile(sorted, 50),
    p90: percentile(sorted, 90),
    max: sorted.length ? sorted[sorted.length - 1]! : null
  };
};

export let perDay = (dates: (string | null)[]) => {
  let days = new Map<string, number>();
  for (let date of dates) {
    if (!date) continue;
    let day = date.slice(0, 10);
    days.set(day, (days.get(day) ?? 0) + 1);
  }

  let counts = [...days.values()];

  return {
    days: Object.fromEntries([...days.entries()].sort(([a], [b]) => a.localeCompare(b))),
    ...distribution(counts)
  };
};

export let claudeClientRow = (d: {
  sessionId: string;
  costState: ClaudeCostState | null;
  messages: ClaudeMessageUsage;
}): ClaudeClientRow => {
  let total = tokenTotal(d.messages.tokens);
  let models = new Set([
    ...d.messages.models.map(model => model.model),
    ...(d.costState?.models.map(model => model.model) ?? [])
  ]);

  return {
    sessionId: d.sessionId,
    models: [...models].sort(),
    files: d.messages.files,
    lines: d.messages.lines,
    messages: d.messages.messages,
    firstAt: iso(d.messages.span.firstAt),
    lastAt: iso(d.messages.span.lastAt),
    costState: d.costState
      ? {
          entries: d.costState.entries,
          totalCostUsd: d.costState.totalCostUsd,
          hasUnknownModelCost: d.costState.hasUnknownModelCost,
          tokens: sumTokens(d.costState.models.map(model => model.tokens)),
          models: d.costState.models.map(model => ({
            model: model.model,
            tokens: model.tokens,
            costUsd: model.costUsd
          }))
        }
      : null,
    messageTokens: d.messages.tokens,
    perLineFactor: ratio(tokenTotal(d.messages.perLine), total),
    withIterationsFactor: ratio(tokenTotal(d.messages.withIterations), total),
    comparison: d.costState
      ? compareCostStateWithMessages({ costState: d.costState, messages: d.messages })
      : null
  };
};

export let codexClientRow = (rollout: CodexRollout): CodexClientRow => ({
  threadId: rollout.threadId,
  parentThreadId: rollout.parentThreadId,
  models: rollout.models,
  tokenCountEvents: rollout.tokenCountEvents,
  total: rollout.total,
  firstAt: iso(rollout.span.firstAt),
  lastAt: iso(rollout.span.lastAt)
});

let relativeDifferences = (rows: ClaudeClientRow[], component: TokenComponent) =>
  rows
    .filter(row => row.comparison && row.comparison.differences[component] !== undefined)
    .map(row => {
      let base = row.messageTokens[component];
      let difference = row.comparison!.differences[component]!;

      return base > 0 ? difference / base : null;
    })
    .filter((value): value is number => value !== null);

export let clientOnlySummary = (d: { claude: ClaudeClientRow[]; codex: CodexClientRow[] }) => {
  let withCostState = d.claude.filter(row => row.costState);

  return {
    claude: {
      sessions: d.claude.length,
      withCostState: withCostState.length,
      costStateEqualsMessages: withCostState.filter(row => row.comparison?.equal).length,
      costStateAboveMessages: withCostState.filter(
        row => row.comparison && !row.comparison.equal && !row.comparison.costStateBehind
      ).length,
      costStateBehindMessages: withCostState.filter(row => row.comparison?.costStateBehind)
        .length,
      hasUnknownModelCost: withCostState.filter(row => row.costState?.hasUnknownModelCost)
        .length,
      relativeDifference: Object.fromEntries(
        tokenComponents.map(component => [
          component,
          distribution(relativeDifferences(d.claude, component))
        ])
      ),
      perLineFactor: distribution(
        d.claude
          .map(row => row.perLineFactor)
          .filter((value): value is number => value !== null)
      ),
      withIterationsFactor: distribution(
        d.claude
          .map(row => row.withIterationsFactor)
          .filter((value): value is number => value !== null)
      )
    },
    codex: {
      threads: d.codex.length,
      withTokenCount: d.codex.filter(row => row.total).length,
      subagentThreads: d.codex.filter(row => row.parentThreadId).length
    },
    sizing: {
      claudeSessionsPerDay: perDay(d.claude.map(row => row.firstAt)),
      claudeLinesPerSession: distribution(d.claude.map(row => row.lines)),
      claudeMessagesPerSession: distribution(d.claude.map(row => row.messages)),
      claudeFilesPerSession: distribution(d.claude.map(row => row.files)),
      codexThreadsPerDay: perDay(d.codex.map(row => row.firstAt)),
      codexTokenCountEventsPerThread: distribution(d.codex.map(row => row.tokenCountEvents))
    }
  };
};

export let liveRow = (d: {
  sessionId: string | null;
  service: ServiceSession;
  notSettled?: boolean;
  comparison:
    | {
        family: 'claude-code';
        result: ClaudeComparison;
        tokens: Tokens | null;
        costUsd: number | null;
        models: string[];
      }
    | {
        family: 'codex';
        result: CodexComparison;
        tokens: Tokens | null;
        models: string[];
      }
    | null;
}): LiveRow => {
  let comparison = d.comparison;

  return {
    family: d.service.family,
    sessionId: d.sessionId,
    sessionKey: d.service.sessionKey,
    status: d.notSettled
      ? 'not_settled'
      : !comparison
        ? 'no_local_record'
        : comparison.family == 'codex'
          ? 'reported'
          : comparison.result.status,
    reference:
      comparison?.family == 'claude-code'
        ? comparison.result.reference
        : comparison?.family == 'codex'
          ? 'rollout'
          : null,
    costStateBehind:
      comparison?.family == 'claude-code' ? comparison.result.costStateBehind : false,
    findings: comparison?.family == 'claude-code' ? comparison.result.findings : [],
    codex: comparison?.family == 'codex' ? comparison.result : null,
    service: {
      requests: d.service.requests,
      toolCalls: d.service.toolCalls,
      tokens: d.service.tokens,
      reportedCostUsd: d.service.reportedCostUsd,
      computedCostUsd: d.service.computedCostUsd,
      models: d.service.models.map(model => model.modelId ?? model.rawIds[0] ?? 'unknown'),
      summaryStale: d.service.summaryStale,
      startedAt: iso(d.service.startedAt)
    },
    client: comparison
      ? {
          tokens: comparison.tokens,
          costUsd: comparison.family == 'claude-code' ? comparison.costUsd : null,
          models: comparison.models
        }
      : null
  };
};

// The run covers what the service was asked for: from --since, or else from the first session
// the service has. A local session that ended before that is outside the run, not missing.
export let localOnlyRows = (d: {
  family: string;
  sessions: {
    sessionId: string | null;
    hasUsage: boolean;
    firstAt: Date | null;
    lastAt: Date | null;
  }[];
  matched: Set<string>;
  windowStart: Date | null;
}): LocalOnlyRow[] =>
  d.sessions
    .filter(
      (session): session is typeof session & { sessionId: string } =>
        !!session.sessionId &&
        !d.matched.has(session.sessionId) &&
        (!d.windowStart || !session.lastAt || session.lastAt >= d.windowStart)
    )
    .map(session => ({
      family: d.family,
      sessionId: session.sessionId,
      hasUsage: session.hasUsage,
      firstAt: iso(session.firstAt),
      lastAt: iso(session.lastAt)
    }));

let failureNotes = {
  nothing_compared:
    'No Claude Code session was compared. Likely causes: the hash secret is not the one the service runs with (no session key then matches), --instance or --since leaves the sessions out, the selected project directories do not hold the sessions sent to this stack, or Claude Code did not export to this stack.',
  sessions_failed: 'At least one compared session has a difference no explanation covers.',
  unmatched_sessions:
    'With --fail-unmatched, every Claude Code session must be on both sides: a service session has no local transcript, or a local session with usage is missing in the service.'
} as const;

export let liveSummary = (d: {
  rows: LiveRow[];
  localOnly: LocalOnlyRow[];
  localSessions: number;
  failUnmatched: boolean;
}) => {
  let claude = d.rows.filter(row => row.family == 'claude-code');
  let explained = new Map<ExplanationKey, number>();
  let failedChecks = new Map<string, number>();

  for (let row of claude) {
    for (let item of row.findings) {
      if (item.explanation)
        explained.set(item.explanation, (explained.get(item.explanation) ?? 0) + 1);
      if (item.failure) failedChecks.set(item.check, (failedChecks.get(item.check) ?? 0) + 1);
    }
  }

  let counts = {
    compared: claude.filter(row => row.status == 'pass' || row.status == 'fail').length,
    pass: claude.filter(row => row.status == 'pass').length,
    fail: claude.filter(row => row.status == 'fail').length,
    notSettled: claude.filter(row => row.status == 'not_settled').length,
    serviceWithoutLocal: claude.filter(row => row.status == 'no_local_record').length,
    localWithoutService: d.localOnly.filter(row => row.family == 'claude-code' && row.hasUsage)
      .length,
    localWithoutServiceOrUsage: d.localOnly.filter(
      row => row.family == 'claude-code' && !row.hasUsage
    ).length
  };

  let failures: (keyof typeof failureNotes)[] = [];
  if (!counts.compared) failures.push('nothing_compared');
  if (counts.fail) failures.push('sessions_failed');
  if (d.failUnmatched && (counts.serviceWithoutLocal || counts.localWithoutService))
    failures.push('unmatched_sessions');

  let codex = d.rows.filter(row => row.family == 'codex');

  return {
    passed: failures.length == 0,
    failures: failures.map(key => ({ reason: key, note: failureNotes[key] })),
    failUnmatched: d.failUnmatched,
    claude: {
      serviceSessions: claude.length,
      ...counts,
      againstCostState: claude.filter(row => row.reference == 'cost_state').length,
      againstMessagesOnly: claude.filter(row => row.reference == 'messages').length,
      costStateBehind: claude.filter(row => row.costStateBehind).length,
      explained: Object.fromEntries(explained),
      failedChecks: Object.fromEntries(failedChecks)
    },
    codex: {
      serviceSessions: codex.length,
      reported: codex.filter(row => row.status == 'reported').length,
      notSettled: codex.filter(row => row.status == 'not_settled').length,
      serviceWithoutLocal: codex.filter(row => row.status == 'no_local_record').length,
      localWithoutService: d.localOnly.filter(row => row.family == 'codex' && row.hasUsage)
        .length,
      tokensMatch: codex.filter(row => row.codex?.tokensMatch).length
    },
    otherFamilies: d.rows.filter(row => row.family != 'claude-code' && row.family != 'codex')
      .length,
    localSessionsRead: d.localSessions,
    explanations: Object.fromEntries(
      Object.entries(explanations).map(([key, value]) => [key, value.description])
    ),
    sizing: {
      serviceSessionsPerDay: perDay(d.rows.map(row => row.service.startedAt)),
      modelRequestsPerSession: distribution(d.rows.map(row => row.service.requests)),
      toolCallsPerSession: distribution(d.rows.map(row => row.service.toolCalls)),
      note: 'The service gives no exact count of stored records per session over its RPC, so model requests and tool calls per session stand in for it. Stored sizes are measured by the sizing command.'
    }
  };
};

let pad = (value: unknown, width: number) => {
  let text = value === null || value === undefined ? '-' : String(value);
  return text.length >= width ? text : text + ' '.repeat(width - text.length);
};

let money = (value: number | null | undefined) =>
  value === null || value === undefined ? '-' : value.toFixed(6);

let tokensText = (tokens: Tokens | null | undefined) =>
  tokens ? tokenComponents.map(component => tokens[component]).join('/') : '-';

let tokenHeader = `tokens ${tokenComponents.join('/')}`;

export let clientOnlyText = (d: {
  claude: ClaudeClientRow[];
  codex: CodexClientRow[];
  summary: ReturnType<typeof clientOnlySummary>;
}) => {
  let lines = [
    'Claude Code sessions (client-only)',
    [
      pad('session', 38),
      pad('cost-state', 11),
      pad('cost usd', 12),
      pad('equal', 6),
      pad(`cost-state ${tokenHeader}`, 52),
      `messages ${tokenHeader}`
    ].join(' ')
  ];

  for (let row of d.claude) {
    lines.push(
      [
        pad(row.sessionId, 38),
        pad(row.costState ? row.costState.entries : 'none', 11),
        pad(money(row.costState?.totalCostUsd), 12),
        pad(row.comparison ? (row.comparison.equal ? 'yes' : 'no') : '-', 6),
        pad(tokensText(row.costState?.tokens), 52),
        tokensText(row.messageTokens)
      ].join(' ')
    );
  }

  lines.push('', 'Codex threads (client-only; no dollar figure exists)');
  lines.push(
    [
      pad('thread', 38),
      pad('events', 7),
      'total input/cached/cache-write/output/reasoning/total'
    ].join(' ')
  );

  for (let row of d.codex) {
    let total = row.total;
    lines.push(
      [
        pad(row.threadId, 38),
        pad(row.tokenCountEvents, 7),
        total
          ? [
              total.input,
              total.cachedInput,
              total.cacheWriteInput,
              total.output,
              total.reasoningOutput,
              total.total
            ].join('/')
          : '-'
      ].join(' ')
    );
  }

  lines.push('', 'Summary', JSON.stringify(d.summary, null, 2));

  return `${lines.join('\n')}\n`;
};

export let liveText = (d: {
  rows: LiveRow[];
  localOnly: LocalOnlyRow[];
  summary: ReturnType<typeof liveSummary>;
}) => {
  let { claude, codex } = d.summary;
  let lines = [
    `Result: ${d.summary.passed ? 'PASS' : 'FAIL'}`,
    `Claude Code: compared ${claude.compared} (passed ${claude.pass}, failed ${claude.fail}), not settled ${claude.notSettled}, service sessions with no local record ${claude.serviceWithoutLocal}, local sessions the service lacks ${claude.localWithoutService} (and ${claude.localWithoutServiceOrUsage} without usage)`,
    `Codex (reported, never failing): ${codex.reported} reported, ${codex.tokensMatch} with matching tokens, not settled ${codex.notSettled}, service sessions with no local record ${codex.serviceWithoutLocal}, local threads the service lacks ${codex.localWithoutService}`,
    ...d.summary.failures.map(failure => `FAIL ${failure.reason}: ${failure.note}`),
    ''
  ];

  if (d.rows.length) {
    lines.push(
      'Sessions the service has, compared with the client records',
      [
        pad('family', 12),
        pad('session', 38),
        pad('status', 16),
        pad('reference', 11),
        pad('client usd', 12),
        pad('reported', 12),
        pad('computed', 12),
        pad(`client ${tokenHeader}`, 48),
        `service ${tokenHeader}`
      ].join(' ')
    );
  }

  for (let row of d.rows) {
    lines.push(
      [
        pad(row.family, 12),
        pad(row.sessionId ?? row.sessionKey, 38),
        pad(row.status, 16),
        pad(row.reference, 11),
        pad(money(row.client?.costUsd), 12),
        pad(money(row.service.reportedCostUsd), 12),
        pad(money(row.service.computedCostUsd), 12),
        pad(tokensText(row.client?.tokens), 48),
        tokensText(row.service.tokens)
      ].join(' ')
    );

    for (let item of row.findings) {
      lines.push(
        `    ${item.failure ? 'FAIL' : 'explained'} ${item.check}${item.model ? ` ${item.model}` : ''}${item.component ? ` ${item.component}` : ''}: client ${item.client ?? '-'}, service ${item.service ?? '-'}${item.explanation ? ` (${item.explanation})` : ''}`
      );
    }
  }

  if (d.localOnly.length) {
    lines.push(
      '',
      'Local sessions the service does not have',
      [pad('family', 12), pad('session', 38), pad('usage', 6), 'last activity'].join(' ')
    );
    for (let row of d.localOnly) {
      lines.push(
        [
          pad(row.family, 12),
          pad(row.sessionId, 38),
          pad(row.hasUsage ? 'yes' : 'no', 6),
          row.lastAt ?? '-'
        ].join(' ')
      );
    }
  }

  lines.push('', 'Summary', JSON.stringify(d.summary, null, 2));

  return `${lines.join('\n')}\n`;
};
