import type {
  SessionContextRepo,
  SessionContextSource,
  SessionContextTag
} from '@mtsrc/agent-tracking-spec';
import { contextFingerprint, sessionContextType } from '@mtsrc/agent-tracking-records-model';
import { parseRemote, repoFromParts, repoFromSlug } from '@mtsrc/agent-tracking-records-model';
import { normalizeRoot } from '@mtsrc/agent-tracking-records-model';
import {
  configTags,
  dedupeTags,
  envTags,
  namespacedTags
} from '@mtsrc/agent-tracking-records-model';
import { ticketRefsFromBranch } from '@mtsrc/agent-tracking-records-model';
import type { RecordDraft } from '@mtsrc/agent-tracking-records-model';
import { readFields, type FieldReader, type FieldSource } from './fields';
import type { Mapped } from './types';
import { cleanBranch, cleanHex } from './values';

let headPattern = /^[0-9a-f]{7,64}$/i;
let ownerNamePattern = /^[\w.-]+\/[\w.-]+$/;

let otlpContextPrefixes = ['vcs.', 'github.copilot.git.', 'copilot_chat.repo.'];
let otlpContextKeys = new Set(['workspace.host_paths']);

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
  workspaceKey?: string;
  repo?: SessionContextRepo;
  branch?: string;
  head?: string;
  defaultBranch?: string;
  worktree?: boolean;
  subPath?: string;
  permissionMode?: string;
  title?: string;
  parentSessionId?: string;
  surface?: string;
  tags: SessionContextTag[];
};

let cleanHead = (value: string | undefined) => cleanHex(value, headPattern);

let firstString = (value: unknown) => {
  if (typeof value == 'string') return value || undefined;
  if (!Array.isArray(value)) return undefined;

  return value.find((entry): entry is string => typeof entry == 'string' && entry.length > 0);
};

export let contextDraft = (
  base: Pick<RecordDraft, 'client' | 'actor' | 'occurredAt' | 'signalName' | 'ctx'>,
  claims: ContextClaims
): RecordDraft | null => {
  let sessionId = base.ctx?.sessionId;
  let root = normalizeRoot(claims.root);
  let ticketRefs = ticketRefsFromBranch(claims.branch);
  let { parentSessionId, surface } = claims;

  let data: Record<string, unknown> = {
    source: claims.source,
    ...(claims.repo ? { repo: claims.repo } : {}),
    ...(claims.branch ? { branch: claims.branch } : {}),
    ...(claims.head ? { head: claims.head } : {}),
    ...(claims.defaultBranch ? { default_branch: claims.defaultBranch } : {}),
    ...(claims.worktree !== undefined ? { worktree: claims.worktree } : {}),
    ...(claims.subPath ? { sub_path: claims.subPath } : {}),
    ...(claims.permissionMode ? { permission_mode: claims.permissionMode } : {}),
    ...(claims.title ? { title: claims.title } : {}),
    ...(claims.workspaceKey ? { workspace_key: claims.workspaceKey } : {}),
    ...(claims.tags.length ? { tags: claims.tags } : {}),
    ...(ticketRefs.length ? { ticket_refs: ticketRefs } : {})
  };

  let empty = !root && !parentSessionId && !surface && Object.keys(data).length == 1;
  if (!sessionId || empty) return null;

  return {
    kind: 'event',
    type: sessionContextType,
    identity: [
      sessionContextType,
      sessionId,
      contextFingerprint({ ...data, source: undefined, root, parentSessionId, surface })
    ].join('|'),
    signalName: base.signalName,
    occurredAt: base.occurredAt,
    client: base.client,
    ...(base.actor ? { actor: base.actor } : {}),
    ctx: { sessionId, ...(parentSessionId ? { parentSessionId } : {}) },
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
    branch: cleanBranch(git.str('branch') ?? fields.str('atit_branch', 'gitBranch')),
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

export let isOtlpContextAttribute = (key: string) =>
  otlpContextKeys.has(key) || otlpContextPrefixes.some(prefix => key.startsWith(prefix));

let copilotRepo = (value: string | undefined) => {
  if (!value) return undefined;

  let parsed = parseRemote(value);
  if (parsed) return parsed;

  if (!ownerNamePattern.test(value.trim())) return undefined;

  return repoFromSlug('github', value.trim()) ?? undefined;
};

export let otlpHeadBranch = (fields: FieldReader) => {
  let headType = fields.str('vcs.ref.head.type');

  return !headType || headType == 'branch' ? fields.str('vcs.ref.head.name') : undefined;
};

export let readOtlpContext = (attributes: FieldSource): OtlpContextPart => {
  let fields = readFields(attributes, '');
  let vcsBranch = otlpHeadBranch(fields);

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
