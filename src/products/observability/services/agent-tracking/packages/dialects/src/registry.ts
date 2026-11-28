import { desktopContextClients, type NormalizedRecord } from '@mtsrc/agent-tracking-spec';
import type { OtlpAttributes, OtlpDecoded, OtlpGroup } from '@mtsrc/agent-tracking-otlp';
import { readOtlpContext, withOtlpContext } from './context';
import { claudeCodeOtlp } from './otlp/claudeCode';
import { groupContext } from './otlp/common';
import { codexOtlp } from './otlp/codex';
import { genAiOtlp } from './otlp/genai';
import { withOtlpPolicy } from './otlp/policy';
import { quarantineOtlp } from './otlp/quarantine';
import { desktopContext } from './envelope/desktop';
import { claudeCodeHooks, codexHooks } from './hooks';
import { cursorHooks } from './hooks/cursor';
import { opencodePlugin } from './plugin/opencode';
import { antigravityTranscript } from './transcript/antigravity';
import { claudeCodeTranscript } from './transcript/claudeCode';
import { codexTranscript } from './transcript/codex';
import type {
  BulkItemDialect,
  DialectManifest,
  Mapped,
  OtlpDialect,
  OtlpPolicy,
  OtlpSignal
} from './types';

export let otlpDialects: OtlpDialect[] = [claudeCodeOtlp, codexOtlp, genAiOtlp];

export let selectOtlpDialect = (
  signal: OtlpSignal,
  group: OtlpGroup<unknown>
): { dialect: OtlpDialect; context: ReturnType<typeof groupContext> } => {
  let context = groupContext(signal, group);

  for (let dialect of otlpDialects) {
    if (dialect.matches(context)) return { dialect, context };
  }

  return { dialect: quarantineOtlp, context };
};

export type MappedGroup = {
  dialect: OtlpDialect;
  mapped: Mapped[];
  suppressed: number;
  failed: number;
};

type Mapper<T> = (dialect: OtlpDialect) => ((context: never, item: T) => Mapped[]) | undefined;

let mappers = {
  logs: (dialect: OtlpDialect) => dialect.mapLog,
  metrics: (dialect: OtlpDialect) => dialect.mapMetric,
  traces: (dialect: OtlpDialect) => dialect.mapSpan
} as const;

export let mapOtlpGroup = <T>(
  signal: OtlpSignal,
  received: OtlpGroup<T>,
  policy: OtlpPolicy
): MappedGroup => {
  let selected = selectOtlpDialect(signal, received as OtlpGroup<unknown>);
  let { dialect } = selected;

  let group =
    dialect == quarantineOtlp ? received : withOtlpPolicy(signal, dialect, received, policy);
  let context =
    group == received
      ? selected.context
      : {
          ...groupContext(signal, group),
          resourceFingerprint: selected.context.resourceFingerprint
        };

  let map = (mappers[signal] as Mapper<T>)(dialect) as
    ((context: unknown, item: T) => Mapped[]) | undefined;

  let mapped: Mapped[] = [];
  let suppressed = 0;
  let failed = 0;

  let resourceContext =
    dialect == quarantineOtlp ? null : readOtlpContext(group.resource.attributes);

  for (let item of group.items) {
    if (!map) {
      suppressed++;
      continue;
    }

    try {
      let result = map(context, item);
      if (resourceContext) {
        result = withOtlpContext(
          result,
          (item as { attributes?: OtlpAttributes }).attributes ?? {},
          resourceContext
        );
      }

      if (result.length == 0) suppressed++;
      else for (let entry of result) mapped.push(entry);
    } catch {
      failed++;
    }
  }

  return { dialect, mapped, suppressed, failed };
};

export type MappedDecoded = {
  groups: MappedGroup[];
  mapped: number;
  suppressed: number;
  failed: number;
};

export let mapOtlpDecoded = <T>(
  signal: OtlpSignal,
  decoded: OtlpDecoded<T>,
  policy: OtlpPolicy
): MappedDecoded => {
  let groups = decoded.groups.map(group => mapOtlpGroup(signal, group, policy));

  return {
    groups,
    mapped: groups.reduce((sum, group) => sum + group.mapped.length, 0),
    suppressed: groups.reduce((sum, group) => sum + group.suppressed, 0),
    failed: groups.reduce((sum, group) => sum + group.failed, 0)
  };
};

export type { NormalizedRecord };

type ManifestEntry = Omit<DialectManifest, 'dialect'>;

let manifestEntries: ManifestEntry[] = [
  {
    client: 'claude-code',
    channel: 'hook',
    handler: claudeCodeHooks,
    device: 'never'
  },
  {
    client: 'codex',
    channel: 'hook',
    handler: codexHooks,
    device: 'never'
  },
  ...desktopContextClients.map((client): ManifestEntry => ({
    client,
    channel: 'envelope',
    handler: desktopContext,
    device: 'only',
    requires: 'sessionContext'
  })),
  {
    client: 'claude-code',
    channel: 'transcript',
    handler: claudeCodeTranscript,
    device: 'only',
    backfillOnly: true
  },
  {
    client: 'codex',
    channel: 'transcript',
    handler: codexTranscript,
    device: 'only',
    backfillOnly: true
  },
  {
    client: 'cursor',
    channel: 'hook',
    handler: cursorHooks,
    device: 'only',
    waitsOnDevice: true
  },
  {
    client: 'antigravity',
    channel: 'transcript',
    handler: antigravityTranscript,
    device: 'only'
  },
  {
    client: 'opencode',
    channel: 'sse',
    handler: opencodePlugin,
    device: 'only',
    waitsOnDevice: true
  }
];

export let dialectManifests: DialectManifest[] = manifestEntries.map(entry => ({
  ...entry,
  dialect: entry.handler.id
}));

let manifestFor = (client: string, channel: string, dialect: string) =>
  dialectManifests.find(
    manifest =>
      manifest.client == client && manifest.channel == channel && manifest.dialect == dialect
  );

export type BulkResolution =
  | { ok: true; dialect: BulkItemDialect; manifest: DialectManifest }
  | { ok: false; code: 'unknown_client' | 'unknown_dialect' };

export let resolveBulkDialect = (
  client: string,
  channel: string,
  dialect: string
): BulkResolution => {
  let manifest = manifestFor(client, channel, dialect);

  if (!manifest) {
    let clientKnown = dialectManifests.some(m => m.client == client);

    return { ok: false, code: clientKnown ? 'unknown_dialect' : 'unknown_client' };
  }

  return { ok: true, dialect: manifest.handler, manifest };
};

let versionParts = (version: string): number[] | null => {
  let core = version.trim().replace(/^v/i, '').split(/[-+]/)[0] ?? '';
  if (!core) return null;

  let parts = core.split('.');
  let numbers: number[] = [];

  for (let part of parts) {
    if (!/^\d{1,9}$/.test(part)) return null;
    numbers.push(Number(part));
  }

  return numbers;
};

let compareParts = (a: number[], b: number[]) => {
  let length = Math.max(a.length, b.length);

  for (let i = 0; i < length; i++) {
    let difference = (a[i] ?? 0) - (b[i] ?? 0);
    if (difference != 0) return difference;
  }

  return 0;
};

export let isVersionSupported = (
  manifest: Pick<DialectManifest, 'minVersion' | 'maxVersion'>,
  version: string | undefined
) => {
  if (!manifest.minVersion && !manifest.maxVersion) return true;
  if (!version) return true;

  let parts = versionParts(version);
  if (!parts) return false;

  let min = manifest.minVersion ? versionParts(manifest.minVersion) : null;
  let max = manifest.maxVersion ? versionParts(manifest.maxVersion) : null;

  if (min && compareParts(parts, min) < 0) return false;
  if (max && compareParts(parts, max) > 0) return false;

  return true;
};
