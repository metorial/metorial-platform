import type { DialectManifest, IngestPolicy } from '@mtsrc/agent-tracking-dialects';
import type { IngestPrincipal } from '@mtsrc/agent-tracking-records-model';
import {
  desktopSettingsOf,
  fullIngestPolicy,
  type RecordLane
} from '@mtsrc/agent-tracking-spec';

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

export let allowsHookRoute = (principal: IngestPrincipal) => !isDeviceBound(principal);

export let allowsDialect = (d: {
  principal: IngestPrincipal;
  policy: IngestPolicy;
  manifest: Pick<DialectManifest, 'requires' | 'backfillOnly' | 'deviceOnly' | 'notOnDevice'>;
  lane: RecordLane;
}) => {
  if (d.manifest.backfillOnly && d.lane != 'backfill') return false;
  if (!isDeviceBound(d.principal)) return !d.manifest.deviceOnly;
  if (d.manifest.notOnDevice) return false;
  if (!d.manifest.deviceOnly) return true;
  if (d.manifest.requires && !d.policy[d.manifest.requires]) return false;

  return d.lane != 'backfill' || d.policy.historyImport;
};
