import type { DialectManifest, IngestPolicy } from '@mtsrc/agent-tracking-dialects';
import type { IngestPrincipal } from '@mtsrc/agent-tracking-records-model';
import {
  desktopSettingsOf,
  fullIngestPolicy,
  type RecordLane
} from '@mtsrc/agent-tracking-spec';

let isDeviceBound = (principal: IngestPrincipal) => principal.binding.deviceMode == 'bound';

// Only Metorial Desktop holds device-bound tokens; other credentials keep what their exporter sends.
export let ingestPolicyFor = (principal: IngestPrincipal): IngestPolicy =>
  isDeviceBound(principal)
    ? desktopSettingsOf(principal.organization.settings)
    : fullIngestPolicy;

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
