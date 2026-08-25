import { env } from '../../env';
import { createCodeBucketClient } from '@metorial/code-bucket-service-generated';
import { db } from '@metorial/db';
import { createQueue } from '@metorial/queue';
import path from 'path';
import { BatchProcessor } from '../../lib/batchProcessor';
import { CargoSkillLimitError } from '../../lib/limits';
import type { PruneScope, SerializerContext } from '../../serializers/_lib/types';
import { applyMarketplace } from '../../serializers/marketplace';
import { applyPlugin, getPluginPath } from '../../serializers/plugin';
import { applySkill, getSkillPath } from '../../serializers/skill';
import { getSyncTaskItemWhere } from './_lib/item';
import { appendSkillDestinationSyncLog } from './_lib/logs';
import { type SyncTask } from './_lib/task';
import { syncFinishQueue } from './finish';
import { syncPropagateStartQueue } from './propagate';

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
    if (data.hasChanges) {
      await appendSkillDestinationSyncLog(
        data.skillDestinationSyncId,
        'Content updates are ready.'
      );
      await syncPropagateStartQueue.add({
        skillDestinationSyncId: data.skillDestinationSyncId,
        skillRepositoryId: data.skillRepositoryId
      });
    } else {
      await appendSkillDestinationSyncLog(
        data.skillDestinationSyncId,
        'Content updates were no longer needed.'
      );
      await syncFinishQueue.add({
        skillDestinationSyncId: data.skillDestinationSyncId,
        status: 'canceled'
      });
    }
    return;
  }

  let item = await db.skillDestinationItem.findFirst({
    where: {
      destinationOid: sync.destinationOid,
      ...getSyncTaskItemWhere(task)
    }
  });

  let basePathRef = { current: '' };
  let hashRef = { current: null as string | null };
  let pruneScopeRef = { current: null as PruneScope | null };
  let writtenPaths = new Set<string>();

  let deleteBucketPath = async (prefix: string | undefined) => {
    await codeBucketClient.deleteBucketPath({
      bucketId: sync.destination.codeBucketId,
      path: normalizeBucketPath(prefix ?? '')
    });
  };

  // Removes everything in the serializer's scope that this run did not write.
  let pruneStaleFiles = async () => {
    let scope = pruneScopeRef.current;
    if (!scope) return;

    let keepPaths = [...writtenPaths];

    // The RPC rejects an empty keep set, and rightly so: a serializer that
    // wrote nothing gives us no evidence its subtree should be emptied.
    if (keepPaths.length === 0) return;

    let { deletedPaths } = await codeBucketClient.pruneBucketPath({
      bucketId: sync.destination.codeBucketId,
      prefix: normalizeBucketPath(scope.prefix),
      keepPaths,
      excludePrefixes: scope.excludePrefixes.map(exclude =>
        normalizeBucketPath(path.join(scope.prefix, exclude))
      )
    });

    if (deletedPaths.length === 0) return;

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
  };

  let fileProcessor = new BatchProcessor<{
    path: string;
    content: string | Buffer | ArrayBuffer;
  }>(async files => {
    await codeBucketClient.setBucketFiles({
      bucketId: sync.destination.codeBucketId,
      files: files.map(file => ({
        path: normalizeBucketPath(file.path),
        content: contentToBytes(file.content)
      }))
    });
  }, 5);

  let context: SerializerContext = {
    async setFile(inPath: string, content: string | Buffer | ArrayBuffer) {
      let resultPath = basePathRef.current ? path.join(basePathRef.current, inPath) : inPath;
      writtenPaths.add(normalizeBucketPath(resultPath));
      await fileProcessor.put({ path: resultPath, content });
    },

    async deletePath(inPath: string) {
      await fileProcessor.flush();
      let resultPath = basePathRef.current ? path.join(basePathRef.current, inPath) : inPath;
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
      await deleteBucketPath(
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
      await fileProcessor.flush();

      if (applied === 'applied') await pruneStaleFiles();

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
      await deleteBucketPath(
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
      await fileProcessor.flush();

      if (applied === 'applied') await pruneStaleFiles();

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
    await fileProcessor.flush();

    if (applied === 'applied') await pruneStaleFiles();

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
  } else if (!data.hasChanges && !taskChanged) {
    await appendSkillDestinationSyncLog(
      data.skillDestinationSyncId,
      'Content updates were no longer needed.'
    );
    await syncFinishQueue.add({
      skillDestinationSyncId: data.skillDestinationSyncId,
      status: 'canceled'
    });
  } else {
    await appendSkillDestinationSyncLog(
      data.skillDestinationSyncId,
      'Content updates are ready.'
    );
    await syncPropagateStartQueue.add({
      skillDestinationSyncId: data.skillDestinationSyncId,
      skillRepositoryId: data.skillRepositoryId
    });
  }
});
