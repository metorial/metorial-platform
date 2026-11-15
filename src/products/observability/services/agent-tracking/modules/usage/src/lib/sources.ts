import type { CredentialKind, IngestChannel } from '@mtsrc/agent-tracking-spec';
import type { SourceHealthDocument, SourceKind } from '@mtsrc/agent-tracking-store';

let channelKinds: Partial<Record<IngestChannel, SourceKind>> = {
  hook: 'hook',
  'otlp.logs': 'otel.logs',
  'otlp.traces': 'otel.spans',
  'otlp.metrics': 'otel.metrics',
  transcript: 'transcript',
  admin_api: 'vendor',
  s3_report: 'vendor',
  sse: 'plugin',
  acp: 'plugin',
  headless: 'plugin',
  envelope: 'plugin'
};

let contextSourceKinds: Record<string, SourceKind> = {
  probe: 'probe',
  plugin: 'plugin',
  transcript: 'transcript'
};

let defaultPrecedence: SourceKind[] = [
  'vendor',
  'otel.logs',
  'otel.spans',
  'plugin',
  'hook',
  'transcript',
  'probe',
  'otel.metrics'
];

let otelFirst: SourceKind[] = ['otel.logs', 'otel.spans', 'transcript', 'hook', 'vendor'];

let spansFirst: SourceKind[] = ['otel.spans', 'otel.logs', 'hook', 'transcript', 'vendor'];

let usagePrecedence: Record<string, SourceKind[]> = {
  'claude-code': otelFirst,
  codex: otelFirst,
  'gemini-cli': otelFirst,
  cursor: ['vendor', 'hook', 'transcript', 'otel.logs', 'otel.spans'],
  copilot: spansFirst,
  'copilot-cli': spansFirst,
  'copilot-chat': spansFirst,
  'github-copilot': spansFirst,
  opencode: ['plugin', 'otel.spans', 'otel.logs', 'hook'],
  kiro: ['vendor', 'hook']
};

export let sourceKindOf = (d: {
  channel: IngestChannel;
  credentialKind: CredentialKind;
  type?: string;
  data?: Record<string, unknown>;
}): SourceKind | undefined => {
  if (d.credentialKind == 'source') return 'vendor';

  if (d.type == 'session.context' && typeof d.data?.source == 'string') {
    let kind = contextSourceKinds[d.data.source];
    if (kind) return kind;
  }

  return channelKinds[d.channel];
};

export let sourceLastSeen = (
  lastSeen: SourceHealthDocument['lastSeen'] | undefined,
  kind: SourceKind
): Date | undefined => {
  if (!lastSeen) return undefined;

  switch (kind) {
    case 'otel.logs':
      return lastSeen.otel?.logs ?? lastSeen[kind];
    case 'otel.spans':
      return lastSeen.otel?.spans ?? lastSeen[kind];
    case 'otel.metrics':
      return lastSeen.otel?.metrics ?? lastSeen[kind];
    default:
      return lastSeen[kind];
  }
};

export let usagePrecedenceOf = (family: string) =>
  usagePrecedence[family] ?? defaultPrecedence;

export let usageRank = (family: string, kind: SourceKind | undefined) => {
  let precedence = usagePrecedenceOf(family);
  let index = kind ? precedence.indexOf(kind) : -1;

  return index < 0 ? precedence.length : index;
};
