import type { DialectManifest, IngestPolicy } from '@mtsrc/agent-tracking-dialects';
import type { IngestPrincipal } from '@mtsrc/agent-tracking-records-model';
import {
  desktopSettingsOf,
  fullIngestPolicy,
  type RecordLane
} from '@mtsrc/agent-tracking-spec';

let deviceLiveMaxAgeDays = 7;
let millisPerDay = 86_400_000;

let isDeviceBound = (principal: IngestPrincipal) => principal.binding.deviceMode == 'bound';

export let ingestPolicyFor = (principal: IngestPrincipal): IngestPolicy => {
  let { historyImportDays: _, ...settings } = desktopSettingsOf(
    principal.organization.settings
  );
  if (isDeviceBound(principal)) return settings;

  return {
    ...fullIngestPolicy,
    toolDetails: settings.toolDetails,
    sessionContext: settings.sessionContext
  };
};

export let backfillMaxAgeDaysFor = (principal: IngestPrincipal) => {
  let { instance } = principal;
  let instanceDays = instance.backfillMaxAgeDays ?? instance.recordRetentionDays;
  if (!isDeviceBound(principal)) return instanceDays;

  return Math.min(
    instanceDays,
    instance.recordRetentionDays,
    desktopSettingsOf(principal.organization.settings).historyImportDays
  );
};

export let oldestAllowedAt = (d: {
  principal: IngestPrincipal;
  lane: RecordLane;
  now: number;
  manifest?: Pick<DialectManifest, 'waitsOnDevice'>;
}) => {
  if (d.lane == 'backfill') return d.now - backfillMaxAgeDaysFor(d.principal) * millisPerDay;
  if (!isDeviceBound(d.principal)) return null;

  if (d.manifest?.waitsOnDevice) {
    return d.now - d.principal.instance.recordRetentionDays * millisPerDay;
  }

  let importDays = desktopSettingsOf(d.principal.organization.settings).historyImport
    ? backfillMaxAgeDaysFor(d.principal)
    : 0;

  return d.now - Math.max(deviceLiveMaxAgeDays, importDays) * millisPerDay;
};

export let allowsHookRoute = (principal: IngestPrincipal) => !isDeviceBound(principal);

export let allowsDialect = (d: {
  principal: IngestPrincipal;
  policy: IngestPolicy;
  manifest: Pick<DialectManifest, 'requires' | 'backfillOnly' | 'device'>;
  lane: RecordLane;
}) => {
  if (d.manifest.backfillOnly && d.lane != 'backfill') return false;
  if (!isDeviceBound(d.principal)) return d.manifest.device != 'only';
  if (d.manifest.device == 'never') return false;
  if (d.manifest.device != 'only') return true;
  if (d.manifest.requires && !d.policy[d.manifest.requires]) return false;

  return d.lane != 'backfill' || d.policy.historyImport;
};
