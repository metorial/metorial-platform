export type SlatePackFeedItem = {
  oid: bigint;
  createdAt: Date;
  version: { oid: bigint; size: number } | null;
};

export type IncrementalSelection =
  | { action: 'wait' }
  | { action: 'advance'; cursorOid: bigint }
  | { action: 'build'; cursorOid: bigint; versionOids: bigint[] };

export type ReleaseRef = {
  id: string;
  kind: 'incremental' | 'full';
  sequence: number | null;
  fullSyncId: string | null;
  part: number | null;
  partCount: number | null;
  coversSequence: number | null;
};

export type PackDownloadPlan<T extends ReleaseRef> = {
  mode: 'incremental' | 'full';
  reason: 'up_to_date' | 'incremental' | 'first_sync' | 'too_far_behind' | 'requested_full';
  fromSequence: number | null;
  latestSequence: number;
  releases: T[];
  truncated: boolean;
};

let padSequence = (sequence: number) => String(sequence).padStart(6, '0');

let padPart = (part: number) => String(part).padStart(2, '0');

export let getSlatePackReleaseFileName = (
  d: { subRegistryId: string } & (
    | { kind: 'incremental'; sequence: number }
    | { kind: 'full'; fullSyncId: string; part: number; partCount: number }
  )
) =>
  d.kind === 'incremental'
    ? `${d.subRegistryId}-inc-${padSequence(d.sequence)}.slatepack`
    : `${d.subRegistryId}-full-${d.fullSyncId}-p${padPart(d.part)}of${padPart(d.partCount)}.slatepack`;

export let getFullSyncId = (date: Date) =>
  date
    .toISOString()
    .replace(/[-:]/g, '')
    .replace('T', '')
    .slice(0, 12);

// Greedy and order preserving. A single item larger than the target gets a part of its own.
export let splitIntoParts = <T>(items: T[], getSize: (item: T) => number, targetBytes: number) => {
  let parts: T[][] = [];
  let current: T[] = [];
  let currentSize = 0;

  for (let item of items) {
    let size = getSize(item);

    if (current.length && currentSize + size > targetBytes) {
      parts.push(current);
      current = [];
      currentSize = 0;
    }

    current.push(item);
    currentSize += size;
  }

  if (current.length) parts.push(current);
  return parts;
};

// Items must be ordered by oid. A pack is sealed once it would reach the target size, once
// the oldest waiting version is older than the max age, or once the scanned page is full.
export let selectIncrementalItems = (d: {
  items: SlatePackFeedItem[];
  targetBytes: number;
  maxPendingAgeMs: number;
  now: Date;
  isPageFull: boolean;
}): IncrementalSelection => {
  if (!d.items.length) return { action: 'wait' };

  let packable = d.items.filter(item => item.version);
  if (!packable.length) return { action: 'advance', cursorOid: d.items.at(-1)!.oid };

  let totalBytes = packable.reduce((sum, item) => sum + item.version!.size, 0);
  let oldest = packable[0]!.createdAt.getTime();
  let isDue =
    d.isPageFull ||
    totalBytes >= d.targetBytes ||
    d.now.getTime() - oldest >= d.maxPendingAgeMs;
  if (!isDue) return { action: 'wait' };

  let versionOids: bigint[] = [];
  let seen = new Set<bigint>();
  let size = 0;
  let cursorOid = d.items[0]!.oid;

  for (let item of d.items) {
    if (item.version && !seen.has(item.version.oid)) {
      if (versionOids.length && size + item.version.size > d.targetBytes) break;

      seen.add(item.version.oid);
      versionOids.push(item.version.oid);
      size += item.version.size;
    }

    cursorOid = item.oid;
  }

  return { action: 'build', cursorOid, versionOids };
};

export let computeWatermark = (d: {
  watermark: number;
  incrementalSequences: number[];
  completeFullSyncs: { coversSequence: number }[];
}) => {
  let watermark = d.watermark;

  for (let fullSync of d.completeFullSyncs) {
    watermark = Math.max(watermark, fullSync.coversSequence);
  }

  let sequences = [...new Set(d.incrementalSequences)].sort((a, b) => a - b);
  for (let sequence of sequences) {
    if (sequence <= watermark) continue;
    if (sequence !== watermark + 1) break;

    watermark = sequence;
  }

  return watermark;
};

export let findMissingSequences = (d: {
  watermark: number;
  incrementalSequences: number[];
  limit: number;
}) => {
  let present = new Set(d.incrementalSequences);
  let highest = Math.max(d.watermark, ...d.incrementalSequences);
  let missing: number[] = [];

  for (let sequence = d.watermark + 1; sequence < highest; sequence++) {
    if (present.has(sequence)) continue;

    missing.push(sequence);
    if (missing.length >= d.limit) break;
  }

  return missing;
};

export let planPackDownload = <T extends ReleaseRef>(d: {
  fromSequence: number | null;
  mode: 'auto' | 'full';
  latestSequence: number;
  incrementals: T[];
  latestFullSync: T[] | null;
  maxReleases: number;
}): PackDownloadPlan<T> => {
  let incrementals = [...d.incrementals].sort((a, b) => a.sequence! - b.sequence!);
  let oldestKept = incrementals[0]?.sequence ?? d.latestSequence + 1;

  let finish = (
    mode: PackDownloadPlan<T>['mode'],
    reason: PackDownloadPlan<T>['reason'],
    releases: T[]
  ): PackDownloadPlan<T> => ({
    mode,
    reason,
    fromSequence: d.fromSequence,
    latestSequence: d.latestSequence,
    releases: releases.slice(0, d.maxReleases),
    truncated: releases.length > d.maxReleases
  });

  let incrementalsAfter = (sequence: number) =>
    incrementals.filter(release => release.sequence! > sequence);

  let fullSyncPlan = (reason: PackDownloadPlan<T>['reason']) => {
    if (!d.latestFullSync?.length) {
      // Before the first full sync exists, an install can only start from sequence 1.
      if (oldestKept === 1 || !d.latestSequence) {
        return finish('incremental', reason, incrementalsAfter(0));
      }

      return finish('full', reason, []);
    }

    let parts = [...d.latestFullSync].sort((a, b) => a.part! - b.part!);
    let covers = parts[0]!.coversSequence ?? 0;

    return finish('full', reason, [...parts, ...incrementalsAfter(covers)]);
  };

  if (d.mode === 'full') return fullSyncPlan('requested_full');
  if (d.fromSequence === null) return fullSyncPlan('first_sync');

  if (d.fromSequence >= d.latestSequence) return finish('incremental', 'up_to_date', []);
  if (d.fromSequence + 1 < oldestKept) return fullSyncPlan('too_far_behind');

  return finish('incremental', 'incremental', incrementalsAfter(d.fromSequence));
};
