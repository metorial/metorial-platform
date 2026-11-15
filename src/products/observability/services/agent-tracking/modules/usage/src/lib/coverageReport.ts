import type { SourceHealthDocument, SourceKind } from '@mtsrc/agent-tracking-store';
import { sourceLastSeen, usagePrecedenceOf } from './sources';

export let sourceKinds: SourceKind[] = [
  'hook',
  'probe',
  'otel.logs',
  'otel.spans',
  'otel.metrics',
  'plugin',
  'transcript',
  'vendor'
];

let otelKinds: SourceKind[] = ['otel.logs', 'otel.spans', 'otel.metrics'];

export type CoverageIssue = 'hooks_without_usage' | 'otel_missing' | 'sessions_without_usage';

export type SourceSessionCounts = {
  instanceId: string;
  actorKey: string;
  family: string;
  sessions: number;
  withoutUsage: number;
};

export type CoverageSessionTotals = {
  total: number;
  withoutUsage: number;
  withoutContext: number;
  withoutRepo: number;
  notFullyAttributed: number;
};

export let sourceActorKey = (d: { deviceId?: string | null; userId?: string | null }) =>
  d.deviceId ?? d.userId ?? undefined;

let share = (count: number, total: number) => (total ? count / total : null);

let inRange = (at: Date | undefined, range: { from: Date; to: Date }) =>
  !!at && at >= range.from && at < range.to;

export let buildSourceCoverage = (d: {
  health: SourceHealthDocument;
  range: { from: Date; to: Date };
  sessions?: SourceSessionCounts;
}) => {
  let lastSeen = Object.fromEntries(
    sourceKinds.map(kind => [kind, sourceLastSeen(d.health.lastSeen, kind) ?? null])
  ) as Record<SourceKind, Date | null>;

  let active = sourceKinds.filter(kind => inRange(lastSeen[kind] ?? undefined, d.range));
  let precedence = usagePrecedenceOf(d.health.family);
  let usageSource = precedence.find(kind => active.includes(kind)) ?? null;

  let sessions = d.sessions?.sessions ?? 0;
  let withoutUsage = d.sessions?.withoutUsage ?? 0;

  let issues: CoverageIssue[] = [];

  let expectsOtel = otelKinds.includes(precedence[0]!);
  if (expectsOtel && active.length && !active.some(kind => otelKinds.includes(kind))) {
    issues.push('otel_missing');
  }

  if (sessions && withoutUsage == sessions) {
    issues.push(active.includes('hook') ? 'hooks_without_usage' : 'sessions_without_usage');
  }

  let seen = sourceKinds
    .map(kind => lastSeen[kind])
    .filter((at): at is Date => !!at)
    .sort((a, b) => b.getTime() - a.getTime());

  return {
    instanceId: d.health.instanceId,
    deviceId: d.health.deviceId ?? null,
    userId: d.health.userId ?? null,
    family: d.health.family,
    clientVersion: d.health.clientVersion ?? null,
    probeVersion: d.health.probeVersion ?? null,
    desktopSeen: active.includes('hook') || active.includes('plugin'),
    probeSeen: active.includes('probe'),
    otel: {
      logs: active.includes('otel.logs'),
      spans: active.includes('otel.spans'),
      metrics: active.includes('otel.metrics')
    },
    usageSource,
    lastSeen,
    lastSeenAt: seen[0] ?? null,
    sessions,
    sessionsWithoutUsage: withoutUsage,
    issues
  };
};

export type SourceCoverage = ReturnType<typeof buildSourceCoverage>;

export let buildCoverage = (d: {
  range: { from: Date; to: Date };
  health: SourceHealthDocument[];
  sourceSessions: SourceSessionCounts[];
  sessions: CoverageSessionTotals;
  sessionlessSlices: number;
}) => {
  let countsByKey = new Map(
    d.sourceSessions.map(row => [`${row.instanceId}:${row.actorKey}:${row.family}`, row])
  );

  let sources = d.health
    .map(health => {
      let actorKey = sourceActorKey(health);

      return buildSourceCoverage({
        health,
        range: d.range,
        sessions: actorKey
          ? countsByKey.get(`${health.instanceId}:${actorKey}:${health.family}`)
          : undefined
      });
    })
    .sort(
      (a, b) =>
        (b.lastSeenAt?.getTime() ?? 0) - (a.lastSeenAt?.getTime() ?? 0) ||
        a.family.localeCompare(b.family)
    );

  return {
    range: d.range,
    sources,
    misconfigured: sources.filter(source => source.issues.length).length,
    sessions: {
      ...d.sessions,
      shares: {
        withoutUsage: share(d.sessions.withoutUsage, d.sessions.total),
        withoutContext: share(d.sessions.withoutContext, d.sessions.total),
        withoutRepo: share(d.sessions.withoutRepo, d.sessions.total),
        notFullyAttributed: share(d.sessions.notFullyAttributed, d.sessions.total)
      }
    },
    sessionlessSlices: d.sessionlessSlices
  };
};
