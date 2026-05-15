import { createQueue } from '@lowerdeck/queue';
import { db, env, snowflake } from '@metorial-cargo/db';
import { createCodeBucketClient } from '@metorial/code-bucket-service-generated';
import path from 'path';
import { BatchProcessor } from '../../lib/batchProcessor';
import type { SerializerContext } from '../../serializers/_lib/types';
import { applyMarketplace } from '../../serializers/marketplace';
import { applyPlugin, getPluginPath } from '../../serializers/plugin';
import { applySkill, getSkillPath } from '../../serializers/skill';
import { type SyncTask } from './_lib/task';
import { syncPropagateQueue } from './propagate';

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

export let syncProcessQueue = createQueue<{
  skillDestinationSyncId: string;
  tasks: SyncTask[];
}>({
  redisUrl: env.service.REDIS_URL,
  name: 'cargo/skill/sync/process',
  workerOpts: {
    concurrency: 10
  }
});

export let syncProcessQueueProcessor = syncProcessQueue.process(async data => {
  let exp = await db.skillDestinationSync.findUnique({
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
  if (!exp || exp.status !== 'processing') return;

  let task = data.tasks[0];
  if (!task) {
    await syncPropagateQueue.add({
      skillDestinationSyncId: data.skillDestinationSyncId
    });
    return;
  }

  let item = await db.skillDestinationItem.findFirst({
    where: {
      destinationOid: exp.destinationOid,

      ...(task?.type === 'marketplace'
        ? { skillMarketplace: { id: task.skillMarketplaceId } }
        : {}),

      ...(task?.type === 'plugin' ? { skillPlugin: { id: task.skillPluginId } } : {}),

      ...(task?.type === 'skill'
        ? {
            skill: { id: task.skillId },
            skillPlugin: { id: task.skillPluginId }
          }
        : {})
    }
  });

  let basePathRef = { current: '' };
  let hashRef = { current: null as string | null };
  let fileProcessor = new BatchProcessor<{
    path: string;
    content: string | Buffer | ArrayBuffer;
  }>(async files => {
    await codeBucketClient.setBucketFiles({
      bucketId: exp.destination.codeBucketId,
      files: files.map(file => ({
        path: normalizeBucketPath(file.path),
        content: contentToBytes(file.content)
      }))
    });
  }, 5);
  let context: SerializerContext = {
    async setFile(inPath: string, content: string | Buffer | ArrayBuffer) {
      let resultPath = basePathRef.current ? path.join(basePathRef.current, inPath) : inPath;
      await fileProcessor.put({ path: resultPath, content });
    },

    setBasePath(path: string) {
      basePathRef.current = path;
    },

    hashIsEqual(hash: string) {
      return item?.hash === hash;
    },

    setHash(hash: string) {
      hashRef.current = hash;
    }
  };

  let loadSkillPlugin = async (skillPluginId: string) => {
    let skillPlugin = await db.skillPlugin.findUnique({
      where: { id: skillPluginId },
      include: {
        tag: true,
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
    if (!exp.destination.skillMarketplace) return undefined;
    return await loadMarketplace(exp.destination.skillMarketplace.id);
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

  let deleteBucketPath = async (prefix: string) => {
    await codeBucketClient.deleteBucketPath({
      bucketId: exp.destination.codeBucketId,
      path: normalizeBucketPath(prefix)
    });
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
        oid: snowflake.nextId(),
        destinationOid: exp.destinationOid,
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
          destinationOid: exp.destinationOid,
          skillOid: skillPluginSkill.skill.oid,
          skillPluginOid: skillPlugin.oid
        }
      });
    } else {
      await applySkill.apply(
        {
          skill: skillPluginSkill.skill,
          skillPlugin,
          skillPluginSkill,
          skillMarketplace,
          skillMarketplacePlugin
        },
        context
      );
      await fileProcessor.flush();

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
      await deleteBucketPath(
        getPluginPath({
          skillPlugin,
          skillMarketplace,
          skillMarketplacePlugin
        })
      );
      await db.skillDestinationItem.deleteMany({
        where: {
          destinationOid: exp.destinationOid,
          skillPluginOid: skillPlugin.oid
        }
      });
    } else {
      await applyPlugin.apply(
        {
          skillPlugin,
          skillMarketplace,
          skillMarketplacePlugin
        },
        context
      );
      await fileProcessor.flush();

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
    await applyMarketplace.apply({ skillMarketplace }, context);
    await fileProcessor.flush();

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
      tasks
    });
  } else {
    await syncPropagateQueue.add({
      skillDestinationSyncId: data.skillDestinationSyncId
    });
  }
});
