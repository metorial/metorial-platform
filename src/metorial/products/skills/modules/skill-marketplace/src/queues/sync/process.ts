import { createCodeBucketClient } from '@metorial/code-bucket-service-generated';
import { db, withTransaction } from '@metorial/db';
import { fileService } from '@metorial/module-file';
import { createQueue } from '@metorial/queue';
import path from 'path';
import { env } from '../../env';
import { BatchProcessor } from '../../lib/batchProcessor';
import { CargoSkillLimitError } from '../../lib/limits';
import type {
  PruneScope,
  SerializerContext,
  StorageBackedFile
} from '../../serializers/_lib/types';
import { applyMarketplace } from '../../serializers/marketplace';
import { applyPlugin, getPluginPath } from '../../serializers/plugin';
import { applySkill, getSkillPath } from '../../serializers/skill';
import {
  forgetDestinationFileDeletions,
  recordDestinationFileDeletions
} from './_lib/deletions';
import { getSyncTaskItemKey, getSyncTaskItemWhere } from './_lib/item';
import { appendSkillDestinationSyncLog } from './_lib/logs';
import {
  DestinationManifest,
  signatureForBytes,
  signatureForStoredFile
} from './_lib/manifest';
import { type SyncTask } from './_lib/task';
import { syncReconcileQueue } from './reconcile';

let codeBucketClient = createCodeBucketClient({
  address: env.origin.CODE_BUCKET_SERVICE_URL
});

let normalizeBucketPath = (inPath: string) => {
  if (!inPath) return '/';

  let segments = inPath.split('/').filter(segment => segment && segment !== '.');
  let normalized: string[] = [];

  for (let segment of segments) {
    if (segment === '..') normalized.pop();
    else normalized.push(segment);
  }

  return `/${normalized.join('/')}`;
};

let maxInlineBatchBytes = 8 * 1024 * 1024;

let contentToBytes = (content: string | Buffer | ArrayBuffer) => {
  if (typeof content === 'string') return Buffer.from(content, 'utf-8');
  if (content instanceof Buffer) return content;
  return Buffer.from(new Uint8Array(content));
};

let failSyncForLimitError = async (d: { skillDestinationSyncId: string; error: unknown }) => {
  if (!(d.error instanceof CargoSkillLimitError)) return false;

  await db.skillDestinationSync.updateMany({
    where: {
      id: d.skillDestinationSyncId,
      status: 'processing'
    },
    data: {
      status: 'failed',
      completedAt: new Date()
    }
  });
  await appendSkillDestinationSyncLog(d.skillDestinationSyncId, d.error.message);
  return true;
};

export let syncProcessQueue = createQueue<{
  skillDestinationSyncId: string;
  tasks: SyncTask[];
  hasChanges?: boolean;
  skillRepositoryId?: string;
}>({
  name: 'cargo/skill/sync/process',
  workerOpts: {
    concurrency: 10
  }
});

export let syncProcessQueueProcessor = syncProcessQueue.process(async data => {
  let sync = await db.skillDestinationSync.findUnique({
    where: { id: data.skillDestinationSyncId },
    include: {
      destination: {
        include: {
          skillMarketplace: true,
          skillPlugin: true
        }
      }
    }
  });
  if (!sync || sync.status !== 'processing') return;

  let task = data.tasks[0];
  if (!task) {
    await syncReconcileQueue.add({
      skillDestinationSyncId: data.skillDestinationSyncId,
      hasChanges: data.hasChanges,
      skillRepositoryId: data.skillRepositoryId
    });
    return;
  }

  let item = await db.skillDestinationItem.findFirst({
    where: {
      destinationOid: sync.destinationOid,
      ...getSyncTaskItemWhere(task)
    }
  });

  let itemKey = getSyncTaskItemKey(task);

  let basePathRef = { current: '' };
  let hashRef = { current: null as string | null };
  let pruneScopeRef = { current: null as PruneScope | null };

  let manifest = new DestinationManifest(
    await db.skillDestinationFile.findMany({
      where: { destinationOid: sync.destinationOid },
      select: { path: true, signature: true, itemKey: true }
    }),
    itemKey
  );
  let skippedPathCount = 0;

  let getRecordedItemPaths = async () => {
    let files = await db.skillDestinationFile.findMany({
      where: { destinationOid: sync.destinationOid, itemKey },
      select: { path: true }
    });

    return files.map(file => file.path);
  };

  let deleteBucketPaths = async (paths: string[]) => {
    let normalized = [...new Set(paths.map(normalizeBucketPath))].filter(
      candidate => candidate !== '/'
    );
    if (normalized.length === 0) return [];

    for (let candidate of normalized) {
      await codeBucketClient.deleteBucketFile({
        bucketId: sync.destination.codeBucketId,
        path: candidate
      });
    }

    return await recordDestinationFileDeletions({
      destinationOid: sync.destinationOid,
      paths: normalized
    });
  };

  let deleteBucketPath = async (prefix: string | undefined) => {
    let normalized = normalizeBucketPath(prefix ?? '');

    if (normalized === '/') {
      return await deleteBucketPaths(await getRecordedItemPaths());
    }

    let { deletedPaths } = await codeBucketClient.pruneBucketPath({
      bucketId: sync.destination.codeBucketId,
      prefix: normalized,
      keepPaths: [],
      excludePrefixes: []
    });

    let recorded = await db.skillDestinationFile.findMany({
      where: {
        destinationOid: sync.destinationOid,
        OR: [{ path: normalized }, { path: { startsWith: `${normalized}/` } }]
      },
      select: { path: true }
    });

    return await recordDestinationFileDeletions({
      destinationOid: sync.destinationOid,
      paths: [...deletedPaths, ...recorded.map(file => file.path)]
    });
  };

  let deleteItemContent = async (prefix: string | undefined) => {
    let recordedPaths = await getRecordedItemPaths();

    let removedPaths = await deleteBucketPath(prefix);
    let leftover = recordedPaths.filter(candidate => !removedPaths.includes(candidate));

    return [...removedPaths, ...(await deleteBucketPaths(leftover))];
  };

  let pruneStaleFiles = async (): Promise<string[]> => {
    let scope = pruneScopeRef.current;
    if (!scope) return [];

    let keepPaths = manifest.keepPaths();

    if (keepPaths.length === 0) return [];

    let { deletedPaths } = await codeBucketClient.pruneBucketPath({
      bucketId: sync.destination.codeBucketId,
      prefix: normalizeBucketPath(scope.prefix),
      keepPaths,
      excludePrefixes: scope.excludePrefixes.map(exclude =>
        normalizeBucketPath(path.join(scope.prefix, exclude))
      )
    });

    if (deletedPaths.length === 0) return [];

    let listed = deletedPaths.slice(0, 10).join(', ');
    let remaining = deletedPaths.length - 10;

    await appendSkillDestinationSyncLog(
      data.skillDestinationSyncId,
      `Removed ${deletedPaths.length} file${
        deletedPaths.length === 1 ? '' : 's'
      } that are no longer part of the sync: ${listed}${
        remaining > 0 ? ` and ${remaining} more` : ''
      }.`
    );

    return deletedPaths;
  };

  let fileProcessor = new BatchProcessor<{
    path: string;
    content: string | Buffer | ArrayBuffer;
  }>(
    async files => {
      await codeBucketClient.setBucketFiles({
        bucketId: sync.destination.codeBucketId,
        files: files.map(file => ({
          path: normalizeBucketPath(file.path),
          content: contentToBytes(file.content)
        }))
      });
    },
    5,
    {
      maxBytes: maxInlineBatchBytes,
      getBytes: file => contentToBytes(file.content).byteLength
    }
  );

  let copyProcessor = new BatchProcessor<{
    path: string;
    sourceBucket: string;
    sourceKey: string;
  }>(async files => {
    await codeBucketClient.copyBucketFiles({
      bucketId: sync.destination.codeBucketId,
      files: files.map(file => ({
        path: normalizeBucketPath(file.path),
        sourceBucket: file.sourceBucket,
        sourceKey: file.sourceKey
      }))
    });
  }, 25);

  let flushWrites = async () => {
    await fileProcessor.flush();
    await copyProcessor.flush();
  };

  let resolvePath = (inPath: string) =>
    normalizeBucketPath(basePathRef.current ? path.join(basePathRef.current, inPath) : inPath);

  let context: SerializerContext = {
    async setFile(inPath: string, content: string | Buffer | ArrayBuffer) {
      let resultPath = resolvePath(inPath);
      let bytes = contentToBytes(content);

      let { shouldWrite } = manifest.register(resultPath, signatureForBytes(bytes));
      if (!shouldWrite) {
        skippedPathCount++;
        return;
      }

      await fileProcessor.put({ path: resultPath, content: bytes });
    },

    async setFileFromStorage(inPath: string, file: StorageBackedFile) {
      let resultPath = resolvePath(inPath);

      let { shouldWrite } = manifest.register(resultPath, signatureForStoredFile(file.oid));
      if (!shouldWrite) {
        skippedPathCount++;
        return;
      }

      let source = await fileService.resolveFileContentSource({ file });

      if (source.type === 'inline') {
        await fileProcessor.put({ path: resultPath, content: source.content });
        return;
      }

      await copyProcessor.put({
        path: resultPath,
        sourceBucket: source.bucket,
        sourceKey: source.key
      });
    },

    async deletePath(inPath: string) {
      await flushWrites();
      let resultPath = resolvePath(inPath);
      manifest.forgetPrefix(resultPath);
      await deleteBucketPath(resultPath);
    },

    setBasePath(path: string | undefined) {
      basePathRef.current = path ?? '';
    }
  };

  let applySerializer = async <Input, InitResult>(
    serializer: {
      init: (input: Input) => Promise<InitResult>;
      getHash: (input: Input, initResult: InitResult) => Promise<string>;
      getPruneScope?: (input: Input) => PruneScope;
      apply: (
        input: Input,
        context: SerializerContext,
        initResult: InitResult
      ) => Promise<void>;
    },
    input: Input
  ) => {
    let initResult: InitResult;
    let hash: string;

    pruneScopeRef.current = serializer.getPruneScope?.(input) ?? null;

    try {
      initResult = await serializer.init(input);
      hash = await serializer.getHash(input, initResult);
      hashRef.current = hash;
    } catch (error) {
      if (
        await failSyncForLimitError({
          skillDestinationSyncId: data.skillDestinationSyncId,
          error
        })
      ) {
        return false;
      }

      throw error;
    }

    if (item?.hash === hash) return 'skipped' as const;

    try {
      await serializer.apply(input, context, initResult);
      return 'applied' as const;
    } catch (error) {
      if (
        await failSyncForLimitError({
          skillDestinationSyncId: data.skillDestinationSyncId,
          error
        })
      ) {
        return false;
      }

      throw error;
    }
  };
  let taskChanged = false;

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

    return {
      ...skillPlugin,
      skills: skillPlugin.skillPluginSkills
    };
  };

  let loadMarketplace = async (skillMarketplaceId: string) => {
    let marketplace = await db.skillMarketplace.findUnique({
      where: { id: skillMarketplaceId },
      include: {
        skillConfiguration: true
      }
    });
    if (!marketplace) throw new Error(`Skill marketplace not found: ${skillMarketplaceId}`);
    return marketplace;
  };

  let getDestinationMarketplace = async () => {
    if (!sync.destination.skillMarketplace) return undefined;
    return await loadMarketplace(sync.destination.skillMarketplace.id);
  };

  let getMarketplacePlugin = async (d: {
    skillMarketplaceOid?: bigint;
    skillPlugin: Awaited<ReturnType<typeof loadSkillPlugin>>;
  }) => {
    if (!d.skillMarketplaceOid) return undefined;

    let marketplacePlugin = await db.skillMarketplacePlugin.findFirst({
      where: {
        skillMarketplaceOid: d.skillMarketplaceOid,
        skillPluginOid: d.skillPlugin.oid
      },
      include: {
        skillConfiguration: true
      }
    });
    if (!marketplacePlugin) return undefined;

    return {
      ...marketplacePlugin,
      plugin: d.skillPlugin
    };
  };

  let persistManifest = async (prunedPaths: string[]) => {
    let entries = manifest.entries();

    let abandonedPaths = manifest
      .abandonedPaths()
      .filter(candidate => !prunedPaths.includes(candidate));

    await deleteBucketPaths(abandonedPaths);

    let removedPaths = manifest.removedPaths(prunedPaths);

    await withTransaction(async db => {
      for (let entry of entries) {
        await db.skillDestinationFile.upsert({
          where: {
            destinationOid_path: {
              destinationOid: sync.destinationOid,
              path: entry.path
            }
          },
          create: {
            destinationOid: sync.destinationOid,
            path: entry.path,
            signature: entry.signature,
            itemKey
          },
          update: { signature: entry.signature, itemKey }
        });
      }
    });

    await recordDestinationFileDeletions({
      destinationOid: sync.destinationOid,
      paths: removedPaths
    });

    await forgetDestinationFileDeletions({
      destinationOid: sync.destinationOid,
      paths: entries.map(entry => entry.path)
    });

    if (skippedPathCount > 0) {
      await appendSkillDestinationSyncLog(
        data.skillDestinationSyncId,
        `Reused ${skippedPathCount} unchanged file${skippedPathCount === 1 ? '' : 's'}.`
      );
    }
  };

  let setDestinationItemHash = async (d: {
    hash: string;
    skillMarketplaceOid?: bigint;
    skillPluginOid?: bigint;
    skillOid?: bigint;
  }) => {
    if (item) {
      await db.skillDestinationItem.update({
        where: { oid: item.oid },
        data: { hash: d.hash }
      });
      return;
    }

    await db.skillDestinationItem.create({
      data: {
        destinationOid: sync.destinationOid,
        skillMarketplaceOid: d.skillMarketplaceOid,
        skillPluginOid: d.skillPluginOid,
        skillOid: d.skillOid,
        hash: d.hash
      }
    });
  };

  if (task?.type === 'skill') {
    let skillPlugin = await loadSkillPlugin(task.skillPluginId);
    let skillPluginSkill = skillPlugin.skills.find(s => s.skill.id === task.skillId);
    if (!skillPluginSkill) {
      throw new Error(`Skill ${task.skillId} not found in plugin ${task.skillPluginId}`);
    }

    let skillMarketplace = await getDestinationMarketplace();
    let skillMarketplacePlugin = await getMarketplacePlugin({
      skillMarketplaceOid: skillMarketplace?.oid,
      skillPlugin
    });

    if (task.action === 'delete') {
      await appendSkillDestinationSyncLog(
        data.skillDestinationSyncId,
        `Removing skill ${skillPluginSkill.skill.name ?? 'Untitled skill'}.`
      );
      await deleteItemContent(
        getSkillPath({
          skill: skillPluginSkill.skill,
          skillPlugin,
          skillPluginSkill,
          skillMarketplace,
          skillMarketplacePlugin
        })
      );
      await db.skillDestinationItem.deleteMany({
        where: {
          destinationOid: sync.destinationOid,
          skillOid: skillPluginSkill.skill.oid,
          skillPluginOid: skillPlugin.oid
        }
      });
      taskChanged = true;
    } else {
      await appendSkillDestinationSyncLog(
        data.skillDestinationSyncId,
        `Updating skill ${skillPluginSkill.skill.name ?? 'Untitled skill'}.`
      );
      let applied = await applySerializer(applySkill, {
        skill: skillPluginSkill.skill,
        skillPlugin,
        skillPluginSkill,
        skillMarketplace,
        skillMarketplacePlugin
      });
      if (!applied) return;
      taskChanged = applied === 'applied';
      await flushWrites();

      if (applied === 'applied') await persistManifest(await pruneStaleFiles());

      if (hashRef.current) {
        await setDestinationItemHash({
          hash: hashRef.current,
          skillMarketplaceOid: skillMarketplace?.oid,
          skillPluginOid: skillPlugin.oid,
          skillOid: skillPluginSkill.skill.oid
        });
      }
    }
  } else if (task?.type === 'plugin') {
    let skillPlugin = await loadSkillPlugin(task.skillPluginId);
    let skillMarketplace = await getDestinationMarketplace();
    let skillMarketplacePlugin = await getMarketplacePlugin({
      skillMarketplaceOid: skillMarketplace?.oid,
      skillPlugin
    });

    if (task.action === 'delete') {
      await appendSkillDestinationSyncLog(
        data.skillDestinationSyncId,
        `Removing plugin ${skillPlugin.name}.`
      );
      await deleteItemContent(
        getPluginPath({
          skillPlugin,
          skillMarketplace,
          skillMarketplacePlugin
        })
      );
      await db.skillDestinationItem.deleteMany({
        where: {
          destinationOid: sync.destinationOid,
          skillPluginOid: skillPlugin.oid
        }
      });
      taskChanged = true;
    } else {
      await appendSkillDestinationSyncLog(
        data.skillDestinationSyncId,
        `Updating plugin ${skillPlugin.name}.`
      );
      let applied = await applySerializer(applyPlugin, {
        skillPlugin,
        skillMarketplace,
        skillMarketplacePlugin
      });
      if (!applied) return;
      taskChanged = applied === 'applied';
      await flushWrites();

      if (applied === 'applied') await persistManifest(await pruneStaleFiles());

      if (hashRef.current) {
        await setDestinationItemHash({
          hash: hashRef.current,
          skillMarketplaceOid: skillMarketplace?.oid,
          skillPluginOid: skillPlugin.oid
        });
      }
    }
  } else if (task?.type === 'marketplace') {
    let skillMarketplace = await loadMarketplace(task.skillMarketplaceId);
    await appendSkillDestinationSyncLog(
      data.skillDestinationSyncId,
      `Updating marketplace ${skillMarketplace.name}.`
    );
    let applied = await applySerializer(applyMarketplace, { skillMarketplace });
    if (!applied) return;
    taskChanged = applied === 'applied';
    await flushWrites();

    if (applied === 'applied') await persistManifest(await pruneStaleFiles());

    if (hashRef.current) {
      await setDestinationItemHash({
        hash: hashRef.current,
        skillMarketplaceOid: skillMarketplace.oid
      });
    }
  }

  let tasks = data.tasks.slice(1);

  if (tasks.length > 0) {
    await syncProcessQueue.add({
      skillDestinationSyncId: data.skillDestinationSyncId,
      tasks,
      hasChanges: data.hasChanges || taskChanged,
      skillRepositoryId: data.skillRepositoryId
    });
    return;
  }

  await syncReconcileQueue.add({
    skillDestinationSyncId: data.skillDestinationSyncId,
    hasChanges: data.hasChanges || taskChanged,
    skillRepositoryId: data.skillRepositoryId
  });
});
