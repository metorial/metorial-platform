import { createError } from '@lowerdeck/error';
import type {
  ConsumerDeviceDetection,
  ConsumerDeviceDetectionConfidence,
  ConsumerDeviceDetectionSignalKind,
  ConsumerDeviceDetectionState,
  Prisma
} from '@metorial/db';
import { findDetectionTool, getDetectionCatalog } from '@metorial/model-catalog/detection';

export let aiToolDetectionFlag = 'ai-tool-detection-enabled' as const;

export let maxDetectionFindings = 200;

// Devices report at least daily while detection is on; one that stayed silent this long is
// probably gone, so its last report no longer counts.
export let detectionStaleAfterDays = 30;

let dayMs = 24 * 60 * 60 * 1000;

let maxReportAgeMs = 7 * dayMs;

export let aiToolDetectionIntervals = {
  config_dirs: 300,
  apps: 3600,
  binaries: 3600,
  ide_extensions: 3600,
  processes: 900,
  report: 86400
};

export let detectionDisabledError = createError({
  status: 403,
  code: 'detection_disabled',
  message:
    'AI tool detection is turned off for this organization. Stop collecting and discard unsent reports.'
});

export type DetectionFinding = {
  toolKey: string;
  state: ConsumerDeviceDetectionState;
  confidence: ConsumerDeviceDetectionConfidence;
  signalKinds: ConsumerDeviceDetectionSignalKind[];
  version: string | null;
};

let stateRank: Record<ConsumerDeviceDetectionState, number> = { installed: 0, running: 1 };

let confidenceRank: Record<ConsumerDeviceDetectionConfidence, number> = {
  low: 0,
  medium: 1,
  high: 2
};

let sortedUnique = <T extends string>(values: T[]) => [...new Set(values)].sort();

export let detectionStaleBefore = (now = new Date()) =>
  new Date(now.getTime() - detectionStaleAfterDays * dayMs);

export let isDetectionReportStale = (reportedAt: Date | null, now = new Date()) =>
  !reportedAt || reportedAt < detectionStaleBefore(now);

export let visibleDetectionWhere = (
  d: { excludeStale?: boolean; includeGone?: boolean } = {}
) =>
  ({
    ...(d.includeGone ? {} : { goneAt: null }),
    consumerDevice: {
      status: 'active',
      ...(d.excludeStale ? { detectionReportedAt: { gte: detectionStaleBefore() } } : {})
    },
    instance: { consumerDeviceSettings: { is: { aiToolDetectionEnabled: true } } }
  }) satisfies Prisma.ConsumerDeviceDetectionWhereInput;

export type DeviceMonitor = {
  aiToolDetection: boolean;
  catalogVersion: string;
  intervals: typeof aiToolDetectionIntervals;
};

export let deviceMonitor = (d: { aiToolDetection: boolean }): DeviceMonitor => ({
  aiToolDetection: d.aiToolDetection,
  catalogVersion: getDetectionCatalog().version,
  intervals: aiToolDetectionIntervals
});

// A tool listed twice keeps its strongest finding.
export let normalizeFindings = (findings: DetectionFinding[]) => {
  let byKey = new Map<string, DetectionFinding>();

  for (let finding of findings) {
    if (!findDetectionTool(finding.toolKey)) continue;

    let current = byKey.get(finding.toolKey);
    if (!current) {
      byKey.set(finding.toolKey, {
        ...finding,
        signalKinds: sortedUnique(finding.signalKinds)
      });
      continue;
    }

    byKey.set(finding.toolKey, {
      toolKey: finding.toolKey,
      state:
        stateRank[finding.state] > stateRank[current.state] ? finding.state : current.state,
      confidence:
        confidenceRank[finding.confidence] > confidenceRank[current.confidence]
          ? finding.confidence
          : current.confidence,
      signalKinds: sortedUnique([...current.signalKinds, ...finding.signalKinds]),
      version: current.version ?? finding.version
    });
  }

  return [...byKey.values()].sort((a, b) => a.toolKey.localeCompare(b.toolKey));
};

// A report is a full snapshot: tools it leaves out are gone, and gone tools it lists are back.
export let diffDetections = <
  Detection extends Pick<ConsumerDeviceDetection, 'toolKey' | 'goneAt'>
>(d: {
  existing: Detection[];
  findings: DetectionFinding[];
}) => {
  let existingByKey = new Map(d.existing.map(detection => [detection.toolKey, detection]));
  let reported = new Set(d.findings.map(finding => finding.toolKey));

  let created = d.findings.filter(finding => !existingByKey.has(finding.toolKey));
  let updated = d.findings
    .filter(finding => existingByKey.has(finding.toolKey))
    .map(finding => ({ finding, detection: existingByKey.get(finding.toolKey)! }));
  let gone = d.existing.filter(
    detection => !detection.goneAt && !reported.has(detection.toolKey)
  );

  let returned = updated
    .filter(entry => entry.detection.goneAt)
    .map(entry => entry.finding.toolKey);

  return {
    created,
    updated,
    gone,
    added: [...created.map(finding => finding.toolKey), ...returned].sort(),
    removed: gone.map(detection => detection.toolKey).sort()
  };
};

// Reports can wait in the device's spool before they arrive, so they are dated when the device
// generated them. A wrong device clock can't date one in the future, more than a week back, or
// before the last report.
export let detectionObservedAt = (d: {
  generatedAt: Date;
  previousObservedAt: Date | null;
  now: Date;
}) => {
  let time = Math.min(d.generatedAt.getTime(), d.now.getTime());
  time = Math.max(time, d.now.getTime() - maxReportAgeMs);
  if (d.previousObservedAt) time = Math.max(time, d.previousObservedAt.getTime());

  return new Date(time);
};
