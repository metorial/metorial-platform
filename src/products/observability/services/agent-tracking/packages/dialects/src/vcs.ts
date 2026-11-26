import {
  commitShaPattern,
  type SessionContextRepo,
  type SessionContextSource,
  type VcsCommitData,
  type VcsPullRequestData,
  type VcsPullRequestKind
} from '@mtsrc/agent-tracking-spec';
import type { RecordDraft } from '@mtsrc/agent-tracking-records-model';
import { normalizeTicketRefs } from '@mtsrc/agent-tracking-records-model';
import { isFieldSource } from './fields';
import { cleanBranch, cleanHex } from './values';

let maxToolParametersLength = 64 * 1024;
let maxGitParameterLength = 256;

let commitType = 'vcs.commit';
let pullRequestType = 'vcs.pull_request';

export let gitParameterKeys = ['git_commit_id', 'git_branch'] as const;

type DraftBase = Pick<RecordDraft, 'client' | 'actor' | 'occurredAt' | 'signalName' | 'ctx'>;

export let parseToolParameters = (value: unknown): Record<string, unknown> | null => {
  if (isFieldSource(value)) return value;
  if (typeof value != 'string' || value.length > maxToolParametersLength) return null;

  try {
    let parsed: unknown = JSON.parse(value);

    return isFieldSource(parsed) ? parsed : null;
  } catch {
    return null;
  }
};

export let gitParameter = (value: unknown) =>
  typeof value == 'string' && value.length > 0 && value.length <= maxGitParameterLength
    ? value
    : undefined;

let cleanCommit = (value: string | undefined) => cleanHex(value, commitShaPattern);

let linkedCtx = (base: DraftBase, sessionId: string): RecordDraft['ctx'] => ({
  sessionId,
  ...(base.ctx?.turnId ? { turnId: base.ctx.turnId } : {}),
  ...(base.ctx?.toolCallId ? { toolCallId: base.ctx.toolCallId } : {})
});

export type CommitClaims = {
  source: SessionContextSource;
  sha: string | undefined;
  branch?: string;
  committedAt?: Date;
  ticketRefs?: string[];
  aiAuthored?: boolean;
};

export let commitDraft = (base: DraftBase, claims: CommitClaims): RecordDraft | null => {
  let sessionId = base.ctx?.sessionId;
  let sha = cleanCommit(claims.sha);
  if (!sessionId || !sha) return null;

  let branch = cleanBranch(claims.branch);
  let ticketRefs = normalizeTicketRefs(claims.ticketRefs ?? []);

  let data: VcsCommitData = {
    sha,
    ...(branch ? { branch } : {}),
    ...(claims.committedAt ? { committed_at: claims.committedAt.toISOString() } : {}),
    ...(ticketRefs.length ? { ticket_refs: ticketRefs } : {}),
    ...(claims.aiAuthored !== undefined ? { ai_authored: claims.aiAuthored } : {}),
    source: claims.source
  };

  return {
    kind: 'event',
    type: commitType,
    identity: [commitType, sessionId, sha].join('|'),
    factKey: `commit:{session_key}:${sha}`,
    signalName: base.signalName,
    occurredAt: base.occurredAt,
    client: base.client,
    ...(base.actor ? { actor: base.actor } : {}),
    ctx: linkedCtx(base, sessionId),
    data
  };
};

export type PullRequestClaims = {
  source: SessionContextSource;
  kind: VcsPullRequestKind;
  repo: SessionContextRepo;
  number: number;
};

export let pullRequestDraft = (
  base: DraftBase,
  claims: PullRequestClaims
): RecordDraft | null => {
  let sessionId = base.ctx?.sessionId;
  if (!sessionId || !Number.isSafeInteger(claims.number) || claims.number <= 0) return null;

  let repository = `${claims.repo.owner}/${claims.repo.name}`;
  let ref = `${repository}#${claims.number}`;

  let data: VcsPullRequestData = {
    kind: claims.kind,
    provider: claims.repo.provider,
    repository,
    number: claims.number,
    source: claims.source
  };

  return {
    kind: 'event',
    type: pullRequestType,
    identity: [pullRequestType, sessionId, claims.repo.provider, ref, claims.kind].join('|'),
    factKey: `pr:{session_key}:${claims.repo.provider}/${ref}:${claims.kind}`,
    signalName: base.signalName,
    occurredAt: base.occurredAt,
    client: base.client,
    ...(base.actor ? { actor: base.actor } : {}),
    ctx: linkedCtx(base, sessionId),
    data
  };
};
