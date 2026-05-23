import { generateCode } from '@mtsrc/id';
import { createLock } from '@mtsrc/lock';
import { createQueue } from '@mtsrc/queue';
import { db } from '../../db';
import { env } from '../../env';
import { getId, ID, snowflake } from '../../id';
import { getRegistryClient, getRegistryQuery } from '../../registry';
import { deploySlateVersionQueue } from '../deployment/deploy';

export let syncSlateQueue = createQueue<{
  id: string;
  version?: string;
  registryId: string;
}>({
  name: 'shub/slate/sync',
  redisUrl: env.service.REDIS_URL,
  workerOpts: {
    concurrency: 2
  }
});

let lock = createLock({
  name: 'shub/slate/sync/lock',
  redisUrl: env.service.REDIS_URL
});

export let syncSlateQueueProcessor = syncSlateQueue.process(data =>
  lock.usingLock(data.id, async () => {
    let reg = await db.registry.findUnique({
      where: { id: data.registryId }
    });
    if (!reg) return;

    let client = await getRegistryClient(reg);

    let [scopeId, slateId] = data.id.split('/');
    let slateRes = await client.slates[':scopeId'][':slateId'].$get({
      param: {
        scopeId: scopeId!,
        slateId: slateId!
      },
      query: getRegistryQuery()
    });
    if (slateRes.status !== 200)
      throw new Error(
        `Failed to fetch slate - status ${slateRes.status} - ${await slateRes.text()} - ${scopeId} - ${slateId}`
      );

    let slateData = await slateRes.json();

    let slateUpsertData = {
      name: slateData.name,
      description: slateData.description,

      slateIdOnRegistry: slateData.id,
      slateIdentifierOnRegistry: slateData.identifier,
      slateFullIdentifierOnRegistry: slateData.fullIdentifier,

      slateScopeIdOnRegistry: slateData.scope.id,
      slateScopeIdentifierOnRegistry: slateData.scope.identifier
    };

    let slate = await db.slate.upsert({
      where: {
        registryOid_slateFullIdentifierOnRegistry: {
          registryOid: reg.oid,
          slateFullIdentifierOnRegistry: slateData.fullIdentifier
        }
      },
      create: {
        ...getId('slate'),
        status: 'active',

        registryOid: reg.oid,
        identifier: `slate::${reg.id}::${slateData.fullIdentifier}::${generateCode(6)}`,

        ...slateUpsertData
      },
      update: slateUpsertData
    });

    if (data.version) {
      let slateVersionRes = await client.slates[':scopeId'][':slateId'].versions[
        ':versionId'
      ].$get({
        param: {
          scopeId: scopeId!,
          slateId: slateId!,
          versionId: data.version
        },
        query: getRegistryQuery()
      });
      if (slateVersionRes.status !== 200)
        throw new Error(
          `Failed to fetch slate version - status ${slateVersionRes.status} - ${await slateVersionRes.text()} - ${scopeId} - ${slateId} - ${data.version}`
        );

      let slateVersionData = await slateVersionRes.json();

      if (
        slateVersionData.build === 'prebuilt' &&
        env.registry.SUPPORTS_PREBUILT_SLATES !== true
      ) {
        return;
      }

      let slateVersionUpsertData = {
        version: slateVersionData.version,
        manifest: slateVersionData.manifest,
        versionIdOnRegistry: slateVersionData.id,
        versionIdentifierOnRegistry: slateVersionData.version
      };

      let newVersionId = await ID.generateId('slateVersion');
      let version = await db.slateVersion.upsert({
        where: {
          slateOid_version: {
            slateOid: slate.oid,
            version: slateVersionData.version
          }
        },
        create: {
          oid: snowflake.nextId(),
          id: newVersionId,
          slateOid: slate.oid,
          registryOid: reg.oid,

          providerDeploymentInfo: null,

          status: slateVersionData.isCurrent ? 'pending' : 'unavailable',
          isCurrent: false,
          willBeCurrent: slateVersionData.isCurrent,

          ...slateVersionUpsertData
        },
        update: {
          ...slateVersionUpsertData,
          ...(slateVersionData.isCurrent ? { willBeCurrent: true } : {})
        }
      });

      if (newVersionId === version.id) {
        await db.slateEvent.create({
          data: {
            ...getId('slateEvent'),
            type: 'version_pulled',
            message: `New version ${version.version} pulled from registry`,
            slateOid: slate.oid,
            slateVersionOid: version.oid
          }
        });

        // Only deploy current versions
        if (slateVersionData.isCurrent) {
          await deploySlateAfterSyncQueue.add({ versionId: version.id }, { id: version.id });
        }
      }
    }
  })
);

export let deploySlateAfterSyncQueue = createQueue<{
  versionId: string;
}>({
  name: 'shub/slate/sydp',
  redisUrl: env.service.REDIS_URL,
  workerOpts: {
    concurrency: 2,
    limiter: {
      max: 1,
      duration: 60 * 1000
    }
  }
});

export let deploySlateAfterSyncQueueProcessor = deploySlateAfterSyncQueue.process(
  async data => {
    await deploySlateVersionQueue.add({ versionId: data.versionId }, { id: data.versionId });
  }
);
