import type {
  SessionContextRepo,
  SessionContextSource,
  SessionContextTag
} from '@metorial/groundstation-spec';
import { contextFingerprint, sessionContextType } from '../context/record';
import { parseRemote, repoFromParts } from '../context/remote';
import { normalizeRoot } from '../context/roots';
import { configTags, dedupeTags, envTags, namespacedTags } from '../context/tags';
import { ticketRefsFromBranch } from '../context/tickets';
import type { RecordDraft } from '../records/draft';
import { readFields, type FieldReader, type FieldSource } from './fields';
import type { Mapped } from './types';

let maxBranchLength = 256;

let headPattern = /^[0-9a-f]{7,64}$/i;
let ownerNamePattern = /^[\w.-]+\/[\w.-]+$/;

// Hooks carry cwd on every event; context is taken at the points where it can change, or whenever
// the probe enriched the payload, so a session gets one context record per change.
let hookContextEvents = new Set([
  'sessionstart',
  'cwdchanged',
  'worktreecreate',
  'directoryadded',
  'subagentstart'
]);

export type ContextClaims = {
  source: SessionContextSource;
  root?: string;
  repo?: SessionContextRepo;
  branch?: string;
  head?: string;
  tags: SessionContextTag[];
};

let cleanBranch = (value: string | undefined) => {
  let branch = value?.replace(/[\u0000-\u001f\u007f]/g, '').trim();

  return branch && branch.length <= maxBranchLength ? branch : undefined;
};

let cleanHead = (value: string | undefined) =>
  value && headPattern.test(value.trim()) ? value.trim().toLowerCase() : undefined;

let firstString = (value: unknown) => {
  if (typeof value == 'string') return value || undefined;
  if (!Array.isArray(value)) return undefined;

  return value.find((entry): entry is string => typeof entry == 'string' && entry.length > 0);
};

let hasContext = (claims: ContextClaims) =>
  !!(
    normalizeRoot(claims.root) ||
    claims.repo ||
    claims.branch ||
    claims.head ||
    claims.tags.length
  );

export let contextDraft = (
  base: Pick<RecordDraft, 'client' | 'actor' | 'occurredAt' | 'signalName' | 'ctx'>,
  claims: ContextClaims
): RecordDraft | null => {
  let sessionId = base.ctx?.sessionId;
  if (!sessionId || !hasContext(claims)) return null;

  let root = normalizeRoot(claims.root);
  let ticketRefs = ticketRefsFromBranch(claims.branch);

  let data: Record<string, unknown> = {
    source: claims.source,
    ...(claims.repo ? { repo: claims.repo } : {}),
    ...(claims.branch ? { branch: claims.branch } : {}),
    ...(claims.head ? { head: claims.head } : {}),
    ...(claims.tags.length ? { tags: claims.tags } : {}),
    ...(ticketRefs.length ? { ticket_refs: ticketRefs } : {})
  };

  return {
    kind: 'event',
    type: sessionContextType,
    identity: [
      sessionContextType,
      sessionId,
      contextFingerprint({ ...data, source: undefined, root })
    ].join('|'),
    signalName: base.signalName,
    occurredAt: base.occurredAt,
    client: base.client,
    ...(base.actor ? { actor: base.actor } : {}),
    ctx: { sessionId },
    data,
    content: root ? [{ role: 'path', value: root }] : []
  };
};

let repoFromGit = (git: FieldReader) =>
  parseRemote(git.str('remote_url', 'remoteUrl', 'remote', 'url')) ?? undefined;

export let hookContextClaims = (fields: FieldReader, event: string): ContextClaims | null => {
  let envelope = fields.obj('metorial');
  if (!envelope && !hookContextEvents.has(event.toLowerCase())) return null;

  let probe = readFields(envelope ?? {}, 'payload.metorial.');
  let git = readFields(probe.obj('git') ?? {}, 'payload.metorial.git.');
  let pathInfo = readFields(fields.obj('path') ?? {}, 'payload.path.');

  let root =
    git.str('toplevel', 'root') ??
    firstString(fields.raw('workspace_roots', 'workspaceRoots')) ??
    fields.str('cwd') ??
    pathInfo.str('root', 'cwd');

  let source: SessionContextSource = !envelope
    ? 'hook'
    : probe.str('source') == 'plugin'
      ? 'plugin'
      : 'probe';

  return {
    source,
    root,
    repo: repoFromGit(git),
    branch: cleanBranch(git.str('branch') ?? fields.str('git_branch', 'gitBranch')),
    head: cleanHead(git.str('head', 'commit', 'sha')),
    tags: dedupeTags([
      ...configTags(probe.obj('config') ?? {}),
      ...envTags(probe.obj('env') ?? {}),
      ...namespacedTags(probe.obj('resource_attributes') ?? {}, 'environment')
    ])
  };
};

export let withHookContext = (
  mapped: Mapped[],
  fields: FieldReader,
  event: string
): Mapped[] => {
  let base = mapped.find(entry => entry.draft.ctx?.sessionId);
  if (!base) return mapped;

  let claims = hookContextClaims(fields, event);
  let draft = claims ? contextDraft(base.draft, claims) : null;

  return draft ? [...mapped, { source: base.source, draft }] : mapped;
};

type OtlpContextPart = Omit<ContextClaims, 'source'>;

let copilotRepo = (value: string | undefined) => {
  if (!value) return undefined;

  let parsed = parseRemote(value);
  if (parsed) return parsed;

  if (!ownerNamePattern.test(value.trim())) return undefined;

  let [owner, name] = value.trim().split('/');
  return repoFromParts({ provider: 'github', owner, name }) ?? undefined;
};

export let readOtlpContext = (attributes: FieldSource): OtlpContextPart => {
  let fields = readFields(attributes, '');

  let headType = fields.str('vcs.ref.head.type');
  let vcsBranch =
    !headType || headType == 'branch' ? fields.str('vcs.ref.head.name') : undefined;

  let repo =
    parseRemote(fields.str('vcs.repository.url.full', 'vcs.repository.url')) ??
    repoFromParts({
      provider: fields.str('vcs.provider.name'),
      owner: fields.str('vcs.owner.name'),
      name: fields.str('vcs.repository.name')
    }) ??
    copilotRepo(fields.str('github.copilot.git.repository', 'copilot_chat.repo.remote_url'));

  return {
    root: firstString(fields.raw('workspace.host_paths')),
    repo: repo ?? undefined,
    branch: cleanBranch(
      vcsBranch ??
        fields.str('github.copilot.git.branch', 'copilot_chat.repo.head_branch_name')
    ),
    head: cleanHead(
      fields.str(
        'vcs.ref.head.revision',
        'github.copilot.git.commit_sha',
        'copilot_chat.repo.head_commit_hash'
      )
    ),
    tags: dedupeTags(namespacedTags(attributes, 'environment'))
  };
};

export let mergeOtlpContext = (
  item: OtlpContextPart,
  resource: OtlpContextPart
): ContextClaims => ({
  source: 'otel',
  root: item.root ?? resource.root,
  repo: item.repo ?? resource.repo,
  branch: item.branch ?? resource.branch,
  head: item.head ?? resource.head,
  tags: dedupeTags([...item.tags, ...resource.tags])
});

export let withOtlpContext = (
  mapped: Mapped[],
  attributes: FieldSource,
  resource: OtlpContextPart
): Mapped[] => {
  let base = mapped.find(entry => entry.draft.ctx?.sessionId);
  if (!base) return mapped;

  let draft = contextDraft(
    base.draft,
    mergeOtlpContext(readOtlpContext(attributes), resource)
  );

  return draft ? [...mapped, { source: base.source, draft }] : mapped;
};
