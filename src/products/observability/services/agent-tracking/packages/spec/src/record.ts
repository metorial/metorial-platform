import type { ContentMode, ContentRole, ContentState } from './contentPolicy';
import type { IngestChannel, IngestRouteKind } from './ingest';

export let recordSpecVersion = 'ats/0';

export let recordKinds = ['event', 'measurement'] as const;

export type RecordKind = (typeof recordKinds)[number];

export let eventTypes = [
  'session.start',
  'session.end',
  'prompt.submitted',
  'turn.completed',
  'message.assistant',
  'model.request',
  'model.retry',
  'usage.charge',
  'tool.requested',
  'tool.decision',
  'tool.call',
  'safety.decision',
  'agent.start',
  'agent.end',
  'context.compaction',
  'code.change',
  'edit.outcome',
  'vcs.commit',
  'vcs.pull_request',
  'mcp.connection',
  'hook.run',
  'extension.event',
  'command.invoked',
  'settings.changed',
  'auth.event',
  'client.error',
  'user.feedback',
  'session.context',
  'unmapped'
] as const;

export type EventType = (typeof eventTypes)[number];

export let measurementTypes = [
  'tokens',
  'cost',
  'requests',
  'request.duration',
  'request.ttft',
  'tool.calls',
  'tool.duration',
  'sessions',
  'active_time',
  'lines_changed',
  'commits',
  'pull_requests',
  'edit.decisions',
  'completions',
  'messages',
  'agent.runs',
  'agent.turns',
  'context.compactions',
  'retries',
  'users.active',
  'seats'
] as const;

export type MeasurementType = (typeof measurementTypes)[number];

export let recordRoles = ['primary', 'supplemental', 'duplicate', 'aggregate'] as const;

export type RecordRole = (typeof recordRoles)[number];

export type ContentEntry = {
  role: ContentRole;
  mode: ContentMode;
  state: ContentState;

  length?: { chars: number; bytes?: number; source: 'measured' | 'client_reported' };
  hash?: { alg: 'hmac-sha256-128'; value: string; basis: 'full' | 'truncated' };
  shape?: { v: number } & Record<string, unknown>;

  text?: string;
  truncated?: boolean;
  original_length?: number;
};

export type RecordQuality = {
  coerced: string[];
  derived: string[];
  dropped: string[];
  warnings: string[];
  time_source: 'client' | 'agent_observed' | 'observed';
};

export type ExtraValue = string | number | boolean;

export let credentialKinds = ['token', 'source'] as const;

export type CredentialKind = (typeof credentialKinds)[number];

export let sessionOrigins = ['native', 'linked', 'inferred'] as const;

export type SessionOrigin = (typeof sessionOrigins)[number];

export let contextTagOrigins = ['source', 'repo', 'environment'] as const;

export type ContextTagOrigin = (typeof contextTagOrigins)[number];

export let sessionContextSources = [
  'hook',
  'otel',
  'probe',
  'plugin',
  'transcript',
  'vendor',
  'credential'
] as const;

export type SessionContextSource = (typeof sessionContextSources)[number];

export type SessionContextTag = { k: string; v: string; origin: ContextTagOrigin };

export type SessionContextRepo = {
  provider: string;
  owner: string;
  name: string;
  url?: string;
};

export type SessionContextData = {
  source: SessionContextSource;
  workspace?: { root_hash: string; label?: string };
  repo?: SessionContextRepo;
  branch?: string;
  head?: string;
  tags?: SessionContextTag[];
  ticket_refs?: string[];
};

export type RecordAttribution = {
  user_id?: string;
  device_id?: string;
  agent_id?: string;
  client_user_id?: string;
  client_installation_id?: string;
  repo_id?: string;
  workspace_id?: string;
};

export type NormalizedRecord = {
  spec: typeof recordSpecVersion;
  id: string;
  kind: RecordKind;
  type: string;

  occurred_at: string;
  duration_ms?: number;
  observed_at: string;

  ingest: {
    organization_id: string;
    project_id: string;
    instance_id: string;
    credential_kind: CredentialKind;
    credential_id: string;
    route: Exclude<IngestRouteKind, 'otlp_grpc'>;
    request_id: string;
    backfill: boolean;
    batch_id?: string;
    agent?: { name: string; version: string; install_id: string };
  };

  attribution?: RecordAttribution;

  source: {
    adapter: string;
    dialect: string;
    channel: IngestChannel;
    signal_name?: string;
    role: RecordRole;
    fact_key: string | null;
    native_version?: string;
  };

  client: {
    family: string;
    surface?: string;
    version?: string;
    auth_mode?: string;
    terminal?: string;
  };

  actor?: {
    install_id?: string;
    user?: { id?: string; email?: string };
    org_claim?: string;
    identity_source: 'client_claim' | 'credential' | 'resource_attribute';
  };

  ctx: {
    session_id?: string;
    session_key?: string;
    session_origin?: SessionOrigin;
    parent_session_key?: string;
    continues_session_key?: string;
    turn_id?: string;
    request_id?: string;
    generation_id?: string;
    tool_call_id?: string;
    agent?: { id?: string; parent_id?: string };
    trace?: { trace_id?: string; span_id?: string; parent_span_id?: string };
  };

  workspace?: { os?: string; host_hash?: string };

  data: Record<string, unknown>;
  content: ContentEntry[];
  extras: Record<string, ExtraValue>;
  quality: RecordQuality;
};

export type RecordLane = 'live' | 'backfill';
