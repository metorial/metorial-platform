import { db, withTransaction } from '@metorial/db';
import { env } from '../../../env';
import { forceSkillDestinationSync } from '../../../lib/destinationSync';
import { getSyncTaskItemWhere } from '../_lib/item';
import type { SyncTask } from '../_lib/task';
import type { ManifestOriginSync } from './originSync';

let recoveryWindowMs = 24 * 60 * 60 * 1000;

export let sourceRecoveryErrorCodes = ['source_not_found', 'content_mismatch'] as const;

export let isSourceRecoveryErrorCode = (code: string | null | undefined) =>
  !!code && (sourceRecoveryErrorCodes as readonly string[]).includes(code);

export let getSourceRecoveryKeys = (details: ManifestOriginSync['errorDetails']) => {
  if (details?.keys?.length) return details.keys;
  return details?.key ? [details.key] : undefined;
};

export type SourceRecoveryResult =
  | { status: 'started' | 'already_started'; sync: { id: string; oid: bigint } }
  | { status: 'limit_reached' };

let parseSyncItemKey = (itemKey: string): SyncTask | undefined => {
  let [type, first, second] = itemKey.split(':');

  if (type === 'skill' && first && second) {
    return { type: 'skill', action: 'set', skillId: first, skillPluginId: second };
  }
  if (type === 'plugin' && first)
    return { type: 'plugin', action: 'set', skillPluginId: first };
  if (type === 'marketplace' && first) {
    return { type: 'marketplace', action: 'set', skillMarketplaceId: first };
  }

  return undefined;
};

let getAffectedItemsWhere = async (d: { destinationOid: bigint; keys?: string[] }) => {
  if (!d.keys?.length) return undefined;

  let files = await db.skillDestinationFile.findMany({
    where: { destinationOid: d.destinationOid, sourceKey: { in: d.keys } },
    select: { itemKey: true }
  });
  let items = [...new Set(files.flatMap(file => (file.itemKey ? [file.itemKey] : [])))]
    .map(parseSyncItemKey)
    .filter(task => task !== undefined)
    .map(getSyncTaskItemWhere);

  return items.length ? items : undefined;
};

// Keys that match no item (e.g. a missing manifest object) fall back to a full rebuild.
// `afterSyncOid` dedupes callers reacting to the same failure: a recovery sync started after
// it is reused instead of starting another.
export let recoverMissingManifestSources = async (d: {
  destinationOid: bigint;
  keys?: string[];
  afterSyncOid?: bigint;
}): Promise<SourceRecoveryResult> => {
  if (d.afterSyncOid !== undefined) {
    let alreadyStarted = await db.skillDestinationSync.findFirst({
      where: {
        destinationOid: d.destinationOid,
        trigger: 'recovery',
        oid: { gt: d.afterSyncOid }
      },
      orderBy: { oid: 'desc' },
      select: { id: true, oid: true }
    });
    if (alreadyStarted) return { status: 'already_started', sync: alreadyStarted };
  }

  let recentRecoveries = await db.skillDestinationSync.count({
    where: {
      destinationOid: d.destinationOid,
      trigger: 'recovery',
      createdAt: { gte: new Date(Date.now() - recoveryWindowMs) }
    }
  });
  if (recentRecoveries >= env.skillSync.SKILL_SYNC_SOURCE_NOT_FOUND_MAX_RECOVERIES) {
    return { status: 'limit_reached' };
  }

  let affectedItems = await getAffectedItemsWhere(d);

  let sync = await withTransaction(async db => {
    await db.skillDestinationItem.updateMany({
      where: {
        destinationOid: d.destinationOid,
        ...(affectedItems ? { OR: affectedItems } : {})
      },
      data: { hash: '' }
    });

    return await forceSkillDestinationSync({
      destination: { oid: d.destinationOid },
      trigger: 'recovery'
    });
  });

  return { status: 'started', sync };
};

// A window is the 24 hours after the limit was first hit. Hitting it again within the next
// window extends the streak; a full window without hitting it starts a new one.
export let recordSourceRecoveryLimitReached = async (d: {
  skillRepositoryOid: bigint;
  now?: Date;
}) => {
  let now = d.now ?? new Date();
  let repository = await db.skillRepository.findUniqueOrThrow({
    where: { oid: d.skillRepositoryOid },
    select: { sourceRecoveryLimitWindows: true, sourceRecoveryLimitReachedAt: true }
  });

  let sinceLastWindow =
    repository.sourceRecoveryLimitReachedAt && repository.sourceRecoveryLimitWindows > 0
      ? now.getTime() - repository.sourceRecoveryLimitReachedAt.getTime()
      : null;
  let windows = repository.sourceRecoveryLimitWindows;

  if (sinceLastWindow === null || sinceLastWindow >= recoveryWindowMs) {
    windows =
      sinceLastWindow !== null && sinceLastWindow < 2 * recoveryWindowMs ? windows + 1 : 1;
    await db.skillRepository.update({
      where: { oid: d.skillRepositoryOid },
      data: { sourceRecoveryLimitWindows: windows, sourceRecoveryLimitReachedAt: now }
    });
  }

  return {
    windows,
    exhausted: windows >= env.skillSync.SKILL_SYNC_SOURCE_RECOVERY_EXHAUSTED_AFTER
  };
};
