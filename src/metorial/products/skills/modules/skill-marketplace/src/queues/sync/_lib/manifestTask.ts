import type { SkillDestination, SkillMarketplace, SkillPlugin } from '@metorial/db';
import { db, withTransaction } from '@metorial/db';
import { fileService } from '@metorial/module-file';
import { env } from '../../../env';
import { CargoSkillLimitError } from '../../../lib/limits';
import { manifestFormatLimits } from '../../../lib/manifestFile/format';
import type { PruneScope, SerializerContext } from '../../../serializers/_lib/types';
import { applyMarketplace } from '../../../serializers/marketplace';
import { applyPlugin } from '../../../serializers/plugin';
import { applySkill } from '../../../serializers/skill';
import { ManifestApplyContext, type ManifestApplyEntry } from './applyContext';
import { putSkillSyncBlobs } from './blobStore';
import { getSyncTaskItemKey, getSyncTaskItemWhere } from './item';
import { appendSkillDestinationSyncLog } from './logs';
import { replaceSkillDestinationItemRows, type ManifestRow } from './manifestRows';
import type { SyncTask } from './task';

let listedPathCount = 10;

export type ManifestSyncDestination = SkillDestination & {
  skillMarketplace: SkillMarketplace | null;
  skillPlugin: SkillPlugin | null;
};

export type ManifestSyncTaskOutcome =
  { type: 'skipped' } | { type: 'changed' } | { type: 'deferred'; fileCount: number };

let formatBytes = (bytes: number) => {
  let mb = bytes / (1024 * 1024);
  return mb >= 1024 ? `${(mb / 1024).toFixed(2)}GB` : `${mb.toFixed(2)}MB`;
};

let listPaths = (paths: string[]) => {
  let remaining = paths.length - listedPathCount;
  return `${paths.slice(0, listedPathCount).join(', ')}${remaining > 0 ? ` and ${remaining} more` : ''}`;
};

let plural = (count: number, word: string) => `${count} ${word}${count === 1 ? '' : 's'}`;

let loadSkillPlugin = async (skillPluginId: string) => {
  let skillPlugin = await db.skillPlugin.findUnique({
    where: { id: skillPluginId },
    include: {
      skillConfiguration: true,
      skillPluginSkills: {
        include: {
          skill: true,
          skillConfiguration: true
        }
      }
    }
  });
  if (!skillPlugin) throw new Error(`Skill plugin not found: ${skillPluginId}`);

  return { ...skillPlugin, skills: skillPlugin.skillPluginSkills };
};

let loadMarketplace = async (skillMarketplaceId: string) => {
  let marketplace = await db.skillMarketplace.findUnique({
    where: { id: skillMarketplaceId },
    include: { skillConfiguration: true }
  });
  if (!marketplace) throw new Error(`Skill marketplace not found: ${skillMarketplaceId}`);

  return marketplace;
};

let loadMarketplacePlugin = async (d: {
  skillMarketplaceOid?: bigint;
  skillPlugin: Awaited<ReturnType<typeof loadSkillPlugin>>;
}) => {
  if (!d.skillMarketplaceOid) return undefined;

  let marketplacePlugin = await db.skillMarketplacePlugin.findFirst({
    where: {
      skillMarketplaceOid: d.skillMarketplaceOid,
      skillPluginOid: d.skillPlugin.oid
    },
    include: { skillConfiguration: true }
  });
  if (!marketplacePlugin) return undefined;

  return { ...marketplacePlugin, plugin: d.skillPlugin };
};

let getDestinationInstanceOid = (destination: ManifestSyncDestination) => {
  let instanceOid =
    destination.skillMarketplace?.instanceOid ?? destination.skillPlugin?.instanceOid;
  if (!instanceOid) throw new Error(`Skill destination ${destination.id} has no owner`);

  return instanceOid;
};

// Defense in depth against cross-tenant references: every stored file an item points at must
// belong to the destination's instance.
let getForeignFileOids = async (d: { entries: ManifestApplyEntry[]; instanceOid: bigint }) => {
  let fileOids = [
    ...new Set(d.entries.flatMap(entry => (entry.file ? [entry.file.oid] : [])))
  ];
  if (!fileOids.length) return new Set<bigint>();

  let owned = await db.file.findMany({
    where: {
      oid: { in: fileOids },
      OR: [
        { instanceOid: d.instanceOid },
        {
          instanceOid: null,
          storeItems: { some: { store: { instanceOid: d.instanceOid } } }
        }
      ]
    },
    select: { oid: true }
  });
  let ownedOids = new Set(owned.map(file => file.oid));

  return new Set(fileOids.filter(oid => !ownedOids.has(oid)));
};

let toFileRow = (entry: Extract<ManifestApplyEntry, { kind: 'file' }>): ManifestRow => ({
  path: entry.path,
  gitBlobSha: entry.hashes.gitBlobSha,
  sha256: entry.hashes.sha256,
  byteSize: BigInt(entry.hashes.size),
  crc32: BigInt(entry.hashes.crc32),
  sourceKind: 'file',
  sourceKey: entry.file.storeId,
  sourceFileOid: entry.file.oid
});

let applyManifestItem = async <Input, InitResult>(d: {
  skillDestinationSyncId: string;
  destination: ManifestSyncDestination;
  task: SyncTask;
  liveItemKeys: Set<string>;
  itemIdentity: { skillMarketplaceOid?: bigint; skillPluginOid?: bigint; skillOid?: bigint };
  serializer: {
    init: (input: Input) => Promise<InitResult>;
    getHash: (input: Input, initResult: InitResult) => Promise<string>;
    getPruneScope?: (input: Input) => PruneScope;
    apply: (input: Input, context: SerializerContext, initResult: InitResult) => Promise<void>;
  };
  input: Input;
}): Promise<ManifestSyncTaskOutcome> => {
  let itemKey = getSyncTaskItemKey(d.task);
  let item = await db.skillDestinationItem.findFirst({
    where: { destinationOid: d.destination.oid, ...getSyncTaskItemWhere(d.task) }
  });

  let initResult = await d.serializer.init(d.input);
  let hash = await d.serializer.getHash(d.input, initResult);
  if (item?.hash === hash) return { type: 'skipped' };

  let context = new ManifestApplyContext({
    inlineHashMaxBytes: env.skillSync.SKILL_SYNC_INLINE_HASH_MAX_BYTES,
    maxFileBytes: manifestFormatLimits.maxFileBytes
  });
  await d.serializer.apply(d.input, context, initResult);
  let applied = await context.collect();

  let oversized = applied.oversizedFiles[0];
  if (oversized) {
    throw new CargoSkillLimitError(
      `File ${oversized.path} is ${formatBytes(oversized.file.fileSize)}; synced files cannot exceed ${formatBytes(manifestFormatLimits.maxFileBytes)}.`
    );
  }

  if (applied.unhashedFiles.length) {
    for (let { file } of applied.unhashedFiles) {
      await fileService.requestContentHashes({ file });
    }

    return { type: 'deferred', fileCount: applied.unhashedFiles.length };
  }

  if (applied.invalidPaths.length) {
    await appendSkillDestinationSyncLog(
      d.skillDestinationSyncId,
      `Skipped ${plural(applied.invalidPaths.length, 'file')} with invalid paths (invalid_path): ${listPaths(
        applied.invalidPaths.map(({ path, violation }) => `${path} (${violation})`)
      )}.`
    );
  }

  let foreignFileOids = await getForeignFileOids({
    entries: applied.entries,
    instanceOid: getDestinationInstanceOid(d.destination)
  });
  let entries = applied.entries.filter(
    entry => !entry.file || !foreignFileOids.has(entry.file.oid)
  );
  if (entries.length < applied.entries.length) {
    await appendSkillDestinationSyncLog(
      d.skillDestinationSyncId,
      `Skipped ${plural(applied.entries.length - entries.length, 'file')} that belong to another instance (cross_instance_file): ${listPaths(
        applied.entries.filter(entry => !entries.includes(entry)).map(entry => entry.path)
      )}.`
    );
  }

  let byteEntries = entries.filter(
    (entry): entry is Extract<ManifestApplyEntry, { kind: 'bytes' }> => entry.kind === 'bytes'
  );
  let fileEntries = entries.filter(
    (entry): entry is Extract<ManifestApplyEntry, { kind: 'file' }> => entry.kind === 'file'
  );

  let { result } = await putSkillSyncBlobs({
    blobs: byteEntries.map(entry => ({ bytes: entry.bytes })),
    reference: async blobs => {
      let rows: ManifestRow[] = [
        ...byteEntries.map((entry, i) => ({
          path: entry.path,
          gitBlobSha: blobs[i]!.gitBlobSha,
          sha256: blobs[i]!.sha256,
          byteSize: BigInt(blobs[i]!.byteSize),
          crc32: BigInt(blobs[i]!.crc32),
          sourceKind: 'blob' as const,
          sourceKey: blobs[i]!.key,
          sourceFileOid: null
        })),
        ...fileEntries.map(toFileRow)
      ];

      let written = await replaceSkillDestinationItemRows({
        destinationOid: d.destination.oid,
        itemKey,
        rows,
        liveItemKeys: d.liveItemKeys
      });

      await withTransaction(async db => {
        if (item) {
          await db.skillDestinationItem.update({
            where: { oid: item.oid },
            data: { hash }
          });
        } else {
          await db.skillDestinationItem.create({
            data: { destinationOid: d.destination.oid, ...d.itemIdentity, hash }
          });
        }
      });

      return written;
    }
  });

  d.liveItemKeys.add(itemKey);

  if (result.conflicts.length) {
    await appendSkillDestinationSyncLog(
      d.skillDestinationSyncId,
      `Kept ${plural(result.conflicts.length, 'path')} another item already writes (path_conflict): ${listPaths(
        result.conflicts.map(conflict => `${conflict.path} (${conflict.ownerItemKey})`)
      )}.`
    );
  }

  return {
    type: result.created || result.updated || result.deleted || !item ? 'changed' : 'skipped'
  };
};

let deleteManifestItem = async (d: {
  destination: ManifestSyncDestination;
  task: SyncTask;
  liveItemKeys: Set<string>;
  itemWhere: { skillPluginOid: bigint; skillOid?: bigint };
}) => {
  let itemKey = getSyncTaskItemKey(d.task);

  await withTransaction(async db => {
    await db.skillDestinationFile.deleteMany({
      where: { destinationOid: d.destination.oid, itemKey }
    });
    await db.skillDestinationItem.deleteMany({
      where: { destinationOid: d.destination.oid, ...d.itemWhere }
    });
  });

  d.liveItemKeys.delete(itemKey);
};

// Manifest-mode counterpart of one legacy process task: the item's rows and hash are replaced
// in one transaction, so a crash leaves the item to be re-applied by the next sync.
export let processManifestSyncTask = async (d: {
  skillDestinationSyncId: string;
  destination: ManifestSyncDestination;
  task: SyncTask;
  liveItemKeys: Set<string>;
}): Promise<ManifestSyncTaskOutcome> => {
  let { task } = d;
  let skillMarketplace = d.destination.skillMarketplace
    ? await loadMarketplace(d.destination.skillMarketplace.id)
    : undefined;

  if (task.type === 'marketplace') {
    let marketplace = await loadMarketplace(task.skillMarketplaceId);
    await appendSkillDestinationSyncLog(
      d.skillDestinationSyncId,
      `Updating marketplace ${marketplace.name}.`
    );

    return await applyManifestItem({
      ...d,
      itemIdentity: { skillMarketplaceOid: marketplace.oid },
      serializer: applyMarketplace,
      input: { skillMarketplace: marketplace }
    });
  }

  let skillPlugin = await loadSkillPlugin(task.skillPluginId);
  let skillMarketplacePlugin = await loadMarketplacePlugin({
    skillMarketplaceOid: skillMarketplace?.oid,
    skillPlugin
  });

  if (task.type === 'plugin') {
    if (task.action === 'delete') {
      await appendSkillDestinationSyncLog(
        d.skillDestinationSyncId,
        `Removing plugin ${skillPlugin.name}.`
      );
      await deleteManifestItem({ ...d, itemWhere: { skillPluginOid: skillPlugin.oid } });
      return { type: 'changed' };
    }

    await appendSkillDestinationSyncLog(
      d.skillDestinationSyncId,
      `Updating plugin ${skillPlugin.name}.`
    );

    return await applyManifestItem({
      ...d,
      itemIdentity: {
        skillMarketplaceOid: skillMarketplace?.oid,
        skillPluginOid: skillPlugin.oid
      },
      serializer: applyPlugin,
      input: { skillPlugin, skillMarketplace, skillMarketplacePlugin }
    });
  }

  let skillPluginSkill = skillPlugin.skills.find(s => s.skill.id === task.skillId);
  if (!skillPluginSkill) {
    throw new Error(`Skill ${task.skillId} not found in plugin ${task.skillPluginId}`);
  }

  if (task.action === 'delete') {
    await appendSkillDestinationSyncLog(
      d.skillDestinationSyncId,
      `Removing skill ${skillPluginSkill.skill.name ?? 'Untitled skill'}.`
    );
    await deleteManifestItem({
      ...d,
      itemWhere: { skillPluginOid: skillPlugin.oid, skillOid: skillPluginSkill.skill.oid }
    });
    return { type: 'changed' };
  }

  await appendSkillDestinationSyncLog(
    d.skillDestinationSyncId,
    `Updating skill ${skillPluginSkill.skill.name ?? 'Untitled skill'}.`
  );

  return await applyManifestItem({
    ...d,
    itemIdentity: {
      skillMarketplaceOid: skillMarketplace?.oid,
      skillPluginOid: skillPlugin.oid,
      skillOid: skillPluginSkill.skill.oid
    },
    serializer: applySkill,
    input: {
      skill: skillPluginSkill.skill,
      skillPlugin,
      skillPluginSkill,
      skillMarketplace,
      skillMarketplacePlugin
    }
  });
};
