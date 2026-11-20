import type { AgentTrackingClient } from '@mtsrc/agent-tracking-api-internal';
import { UsageError } from '../lib/safety';
import { readCostState, readMessageUsage } from './claude';
import { codexAsServiceTokens, readCodexRollout } from './codex';
import { compareClaudeSession, compareCodexSession } from './compare';
import {
  claudeSessionFiles,
  codexRolloutFiles,
  prepareOutputDirectory,
  readJsonLines,
  writeReport,
  type ClaudeSessionFiles
} from './files';
import {
  claudeClientRow,
  clientOnlySummary,
  clientOnlyText,
  codexClientRow,
  liveRow,
  liveSummary,
  liveText,
  localOnlyRows,
  type LiveRow
} from './report';
import {
  createSessionKeyer,
  fetchOrganization,
  fetchSessions,
  toServiceSession,
  waitForSettled,
  type RemoteSession
} from './service';
import { sumTokens } from './tokens';

let claudeFamily = 'claude-code';

let codexFamily = 'codex';

let settleIntervalMs = 2_000;

type ReconcileSelection = { claudeProjects: string[]; codexSessions?: string };

let selectedFiles = (selection: ReconcileSelection) => {
  if (!selection.claudeProjects.length && !selection.codexSessions) {
    throw new UsageError('Pass --claude-projects or --codex-sessions: there is no default.');
  }

  return {
    claude: selection.claudeProjects.flatMap(claudeSessionFiles),
    codex: selection.codexSessions ? codexRolloutFiles(selection.codexSessions) : []
  };
};

let readClaudeSession = (files: ClaudeSessionFiles) => {
  let main = readJsonLines(files.main);
  let subagents = files.subagents.map(readJsonLines);
  let all = [main, ...subagents];

  return {
    costState: readCostState(main.entries),
    messages: readMessageUsage(all.map(file => file.entries)),
    invalidLines: all.reduce((total, file) => total + file.invalidLines, 0),
    unreadableFiles: all.filter(file => file.unreadable).length
  };
};

let readCodex = (path: string) => {
  let file = readJsonLines(path);

  return {
    rollout: readCodexRollout(file.entries),
    invalidLines: file.invalidLines,
    unreadable: file.unreadable
  };
};

export let reconcileClientOnly = (d: { selection: ReconcileSelection; out: string }) => {
  let selected = selectedFiles(d.selection);
  let out = prepareOutputDirectory(d.out);
  let invalidLines = 0;
  let unreadableFiles = 0;

  let claude = selected.claude.map(files => {
    let session = readClaudeSession(files);
    invalidLines += session.invalidLines;
    unreadableFiles += session.unreadableFiles;

    return claudeClientRow({ sessionId: files.sessionId, ...session });
  });

  let codex = selected.codex.map(path => {
    let file = readCodex(path);
    invalidLines += file.invalidLines;
    if (file.unreadable) unreadableFiles++;

    return codexClientRow(file.rollout);
  });

  let summary = { ...clientOnlySummary({ claude, codex }), invalidLines, unreadableFiles };

  writeReport(out, 'reconcile-client-only', {
    text: clientOnlyText({ claude, codex, summary }),
    json: {
      mode: 'client-only',
      generatedAt: new Date().toISOString(),
      summary,
      claude,
      codex
    }
  });

  return summary;
};

export let reconcileLive = async (d: {
  selection: ReconcileSelection;
  out: string;
  client: AgentTrackingClient;
  organizationId: string;
  instanceIds?: string[];
  from?: Date;
  hashSecret: string;
  settleTimeoutMs: number;
  failUnmatched: boolean;
}) => {
  let { client, from } = d;
  let selected = selectedFiles(d.selection);
  let out = prepareOutputDirectory(d.out);

  let organization = await fetchOrganization(client, d.organizationId);
  let instanceFilter = d.instanceIds;
  let remote = await fetchSessions(client, {
    organizationId: organization.id,
    instanceIds: instanceFilter,
    from
  });

  let keyOf = createSessionKeyer({ hashSecret: d.hashSecret, organization });
  let instanceIds = [
    ...new Set([...remote.map(session => session.instanceId), ...(instanceFilter ?? [])])
  ];

  let claudeLocal = selected.claude.map(files => ({ files, ...readClaudeSession(files) }));
  let codexLocal = selected.codex.map(path => readCodex(path).rollout);

  let claudeByKey = new Map<string, (typeof claudeLocal)[number]>();
  for (let local of claudeLocal) {
    for (let instanceId of instanceIds) {
      claudeByKey.set(
        keyOf({ instanceId, family: claudeFamily, sessionId: local.files.sessionId }),
        local
      );
    }
  }

  let codexByKey = new Map<string, (typeof codexLocal)[number]>();
  for (let rollout of codexLocal) {
    for (let id of [rollout.threadId, rollout.sessionId]) {
      if (!id) continue;
      for (let instanceId of instanceIds) {
        let key = keyOf({ instanceId, family: codexFamily, sessionId: id });
        if (!codexByKey.has(key)) codexByKey.set(key, rollout);
      }
    }
  }

  let rows: LiveRow[] = [];
  let matched: {
    listed: RemoteSession;
    claude?: (typeof claudeLocal)[number];
    rollout?: (typeof codexLocal)[number];
  }[] = [];

  for (let listed of remote) {
    let claude =
      listed.client.family == claudeFamily ? claudeByKey.get(listed.sessionKey) : undefined;
    let rollout =
      listed.client.family == codexFamily ? codexByKey.get(listed.sessionKey) : undefined;

    if (claude || rollout) matched.push({ listed, claude, rollout });
    else
      rows.push(
        liveRow({ sessionId: null, service: toServiceSession(listed), comparison: null })
      );
  }

  let organizationId = organization.id;
  let settled = await waitForSettled(
    matched.map(pair => pair.listed.sessionKey),
    sessionKey => client.session.get({ organizationId, sessionKey }),
    { timeoutMs: d.settleTimeoutMs, intervalMs: settleIntervalMs }
  );

  for (let pair of matched) {
    let fresh = settled.get(pair.listed.sessionKey);
    let sessionId = pair.claude?.files.sessionId ?? pair.rollout?.threadId ?? null;

    if (!fresh) {
      rows.push(
        liveRow({
          sessionId,
          service: toServiceSession(pair.listed),
          notSettled: true,
          comparison: null
        })
      );
      continue;
    }

    let service = toServiceSession(fresh);

    if (pair.claude) {
      let { costState, messages } = pair.claude;

      rows.push(
        liveRow({
          sessionId,
          service,
          comparison: {
            family: 'claude-code',
            result: compareClaudeSession({ costState, messages, service }),
            tokens: costState
              ? sumTokens(costState.models.map(model => model.tokens))
              : messages.tokens,
            costUsd: costState?.totalCostUsd ?? null,
            models: (costState?.models ?? messages.models).map(model => model.model)
          }
        })
      );
      continue;
    }

    let rollout = pair.rollout!;
    rows.push(
      liveRow({
        sessionId,
        service,
        comparison: {
          family: 'codex',
          result: compareCodexSession({ rollout, service }),
          tokens: rollout.total ? codexAsServiceTokens(rollout.total) : null,
          models: rollout.models
        }
      })
    );
  }

  let starts = remote
    .map(session => new Date(session.startedAt).getTime())
    .filter(time => !isNaN(time));
  let windowStart = from ?? (starts.length ? new Date(Math.min(...starts)) : null);

  let localOnly = [
    ...localOnlyRows({
      family: claudeFamily,
      sessions: claudeLocal.map(local => ({
        sessionId: local.files.sessionId,
        hasUsage: local.messages.messages > 0 || !!local.costState?.models.length,
        ...local.messages.span
      })),
      matched: new Set(
        matched.flatMap(pair => (pair.claude ? [pair.claude.files.sessionId] : []))
      ),
      windowStart
    }),
    ...localOnlyRows({
      family: codexFamily,
      sessions: codexLocal.map(rollout => ({
        sessionId: rollout.threadId,
        hasUsage: !!rollout.total,
        ...rollout.span
      })),
      matched: new Set(
        matched.flatMap(pair => (pair.rollout?.threadId ? [pair.rollout.threadId] : []))
      ),
      windowStart
    })
  ];

  let summary = liveSummary({
    rows,
    localOnly,
    localSessions: claudeLocal.length + codexLocal.length,
    failUnmatched: d.failUnmatched
  });

  writeReport(out, 'reconcile-live', {
    text: liveText({ rows, localOnly, summary }),
    json: {
      mode: 'live',
      generatedAt: new Date().toISOString(),
      summary,
      sessions: rows,
      localOnly
    }
  });

  return summary;
};
