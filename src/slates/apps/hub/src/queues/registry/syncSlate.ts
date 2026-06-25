import { generateCode } from '@lowerdeck/id';
import { createLock } from '@lowerdeck/lock';
import { createQueue } from '@lowerdeck/queue';
import { db } from '../../db';
import { env } from '../../env';
import { getId, ID, snowflake } from '../../id';
import { getRegistryClient, getRegistryQuery, supportsPrebuiltSlates } from '../../registry';
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

    let normalizedFullIdentifier = data.id.startsWith('@') ? data.id.slice(1) : data.id;
    let [scopeId, slateId] = normalizedFullIdentifier.split('/');
    if (!scopeId || !slateId) {
      console.warn(`Skipping slate sync for invalid identifier ${data.id}`);
      return;
    }

    let slateQuery = getRegistryQuery();

    let slateRes = await client.slates[':scopeId'][':slateId'].$get({
      param: {
        scopeId,
        slateId
      },
      query: slateQuery
    });
    if (slateRes.status === 404) {
      console.warn(
        `Skipping slate sync - slate not found or not accessible: ${scopeId}/${slateId}`
      );
      return;
    }
    if (slateRes.status !== 200) {
      let body = await slateRes.text();
      throw new Error(
        `Failed to fetch slate - status ${slateRes.status} - ${body} - ${scopeId} - ${slateId}`
      );
    }

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
        query: slateQuery
      });
      if (slateVersionRes.status === 404) {
        console.warn(
          `Skipping slate version sync - version not found or not accessible: ${scopeId}/${slateId}/${data.version}`
        );
        return;
      }
      if (slateVersionRes.status !== 200) {
        let body = await slateVersionRes.text();
        throw new Error(
          `Failed to fetch slate version - status ${slateVersionRes.status} - ${body} - ${scopeId} - ${slateId} - ${data.version}`
        );
      }

      let slateVersionData = await slateVersionRes.json();

      if (slateVersionData.build === 'prebuilt' && !supportsPrebuiltSlates()) {
        return;
      }

      let isCurrentVersion =
        slateVersionData.isCurrent ||
        slateData.currentVersion?.version === slateVersionData.version ||
        slateData.currentVersion?.id === slateVersionData.id;

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

          status: isCurrentVersion ? 'pending' : 'unavailable',
          isCurrent: false,
          willBeCurrent: isCurrentVersion,

          ...slateVersionUpsertData
        },
        update: {
          ...slateVersionUpsertData,
          ...(isCurrentVersion ? { willBeCurrent: true } : {})
        }
      });

      let shouldDeploy =
        isCurrentVersion &&
        ['unavailable', 'pending', 'deployment_failed', 'discovery_failed'].includes(
          version.status
        );

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
      }

      if (shouldDeploy) {
        await deploySlateAfterSyncQueue.add({ versionId: version.id }, { id: version.id });
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
      max: 5,
      duration: 60 * 1000
    }
  }
});

export let deploySlateAfterSyncQueueProcessor = deploySlateAfterSyncQueue.process(
  async data => {
    let version = await db.slateVersion.findUnique({
      where: { id: data.versionId }
    });
    if (version?.status !== 'pending') {
      console.warn(
        `Not deploying slate version ${data.versionId} after sync because its status is not pending`
      );
      return;
    }

    await deploySlateVersionQueue.add({ versionId: data.versionId }, { id: data.versionId });
  }
);
