import {
  desktopContextId,
  validateDesktopContextPayload,
  type DesktopCommitPayload,
  type DesktopContextPayload,
  type DesktopPullRequestPayload,
  type DesktopSessionContextPayload,
  type DesktopSessionStatsPayload
} from '@mtsrc/agent-tracking-spec';
import { parseRemote, repoFromSlug } from '@mtsrc/agent-tracking-records-model';
import type { RecordDraft, RecordSource } from '@mtsrc/agent-tracking-records-model';
import { contextDraft } from '../context';
import { surfaceFromLabel } from '../otlp/common';
import type { BulkContext, BulkItemDialect, Mapped } from '../types';
import { bulkClient } from '../usageRequest';
import { cleanBranch } from '../values';
import { commitDraft, pullRequestDraft } from '../vcs';

let adapter = 'metorial-desktop';

let codeChangeType = 'code.change';

let source: RecordSource = { adapter, dialect: desktopContextId, channel: 'envelope' };

type DraftBase = Pick<RecordDraft, 'client' | 'occurredAt' | 'ctx'>;

let baseOf = (context: BulkContext, sessionId: string, surface?: string): DraftBase => ({
  client: bulkClient(context, surface),
  occurredAt: null,
  ctx: { sessionId }
});

let mapped = (draft: RecordDraft | null): Mapped[] => (draft ? [{ source, draft }] : []);

let sessionContext = (context: BulkContext, payload: DesktopSessionContextPayload) => {
  let surface = surfaceFromLabel(payload.entrypoint);
  let repo = payload.remote_url ? parseRemote(payload.remote_url) : null;
  let title = context.policy.sessionTitles ? payload.title?.trim() || undefined : undefined;

  let draft = contextDraft(baseOf(context, payload.session_id, surface), {
    source: 'probe',
    workspaceKey: payload.workspace_key?.toLowerCase(),
    repo: repo ?? undefined,
    branch: cleanBranch(payload.branch),
    head: payload.head?.toLowerCase(),
    defaultBranch: cleanBranch(payload.default_branch),
    worktree: payload.worktree,
    subPath: payload.sub_path?.replace(/\/+$/, '') || undefined,
    permissionMode: payload.permission_mode,
    title,
    parentSessionId: payload.parent_session_id,
    surface,
    tags: []
  });

  let dropped = [
    ...(payload.remote_url && !repo ? ['payload.remote_url'] : []),
    ...(payload.title && !title ? ['payload.title'] : [])
  ];

  return mapped(draft && dropped.length ? { ...draft, dropped } : draft);
};

let commit = (context: BulkContext, payload: DesktopCommitPayload) =>
  mapped(
    commitDraft(baseOf(context, payload.session_id), {
      source: 'probe',
      sha: payload.sha,
      branch: payload.branch,
      committedAt: payload.committed_at ? new Date(payload.committed_at) : undefined,
      ticketRefs: payload.ticket_refs,
      aiAuthored: payload.ai_authored
    })
  );

let pullRequest = (context: BulkContext, payload: DesktopPullRequestPayload) => {
  let repo = repoFromSlug(payload.provider, payload.repository);
  if (!repo) return [];

  return mapped(
    pullRequestDraft(baseOf(context, payload.session_id), {
      source: 'probe',
      kind: payload.relation,
      repo,
      number: payload.number
    })
  );
};

let sessionStats = (context: BulkContext, payload: DesktopSessionStatsPayload) => {
  let lines = { added: payload.lines_added ?? 0, removed: payload.lines_removed ?? 0 };

  return mapped({
    ...baseOf(context, payload.session_id),
    kind: 'event',
    type: codeChangeType,
    identity: [
      codeChangeType,
      payload.session_id,
      'cumulative',
      lines.added,
      lines.removed,
      context.observedAt?.toISOString() ?? ''
    ].join('|'),
    data: { lines, cumulative: true, source: 'probe' }
  });
};

export let desktopContext: BulkItemDialect = {
  id: desktopContextId,
  adapter,

  check: validateDesktopContextPayload,

  map: (context, validated) => {
    let payload = validated as DesktopContextPayload;

    switch (payload.kind) {
      case 'session_context':
        return sessionContext(context, payload);

      case 'commit':
        return commit(context, payload);

      case 'pull_request':
        return pullRequest(context, payload);

      case 'session_stats':
        return sessionStats(context, payload);
    }
  }
};
