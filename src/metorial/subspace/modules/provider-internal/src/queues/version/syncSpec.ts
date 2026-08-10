import { createQueue, QueueRetryError } from '@lowerdeck/queue';
import { db } from '@metorial-subspace/db';
import { getBackend } from '@metorial-subspace/provider';
import type { ProviderSpecificationGetRes } from '@metorial-subspace/provider-utils';
import { env } from '../../env';
import { providerSpecificationInternalService } from '../../services/providerSpecification';
import { providerVersionSetSpecificationQueue } from './setSpec';

let hasProviderTools = async (specificationOid: bigint) =>
  (await db.providerTool.count({
    where: { specificationOid }
  })) > 0;

export let providerVersionSyncSpecificationQueue = createQueue<{ providerVersionId: string }>({
  name: 'sub/pint/pver/spec/sync',
  redisUrl: env.service.REDIS_URL,
  workerOpts: {
    concurrency: 10,
    limiter: {
      max: 50,
      duration: 1000
    }
  }
});

export let providerVersionSyncSpecificationQueueProcessor =
  providerVersionSyncSpecificationQueue.process(async data => {
    let version = await db.providerVersion.findFirst({
      where: { id: data.providerVersionId },
      include: {
        provider: { include: { ownerTenant: true } },
        providerVariant: true,
        specification: true,
        shuttleServer: true
      }
    });
    if (!version) throw new QueueRetryError();

    let backend = await getBackend({
      entity: version
    });

    try {
      let behavior = await backend.capabilities.getSpecificationBehavior({});
      if (!behavior.supportsVersionSpecification) {
        if (version.specificationOid) return; // Already discovered

        await providerVersionSetSpecificationQueue.add({
          versionOid: version.oid,
          result: { status: 'waiting_for_pair' }
        });
        return;
      }

      let capabilities: ProviderSpecificationGetRes | null = null;

      try {
        capabilities = await backend.capabilities.getSpecificationForProviderVersion({
          tenant: version.provider.ownerTenant,
          providerVersion: version,
          provider: version.provider,
          providerVariant: version.providerVariant
        });
      } catch (e) {
        console.warn('Failed to get capabilities for version', version.id, e);
      }

      // Some backends might need a config to be able to discover specifications
      if (!capabilities || capabilities.status == 'failure') {
        await providerVersionSetSpecificationQueue.add({
          versionOid: version.oid,
          result: { status: 'not_discoverable' }
        });
        return;
      }

      if (version.specification?.type === 'full' && capabilities.type === 'preliminary') {
        console.warn(
          'Skipping preliminary provider version specification over existing full spec',
          {
            providerVersionId: version.id,
            providerId: version.provider.id,
            existingSpecificationOid: version.specificationOid?.toString()
          }
        );
        return;
      }

      if (
        version.shuttleServer?.type === 'remote' &&
        version.specificationOid &&
        capabilities.tools.length === 0 &&
        (await hasProviderTools(version.specificationOid))
      ) {
        console.warn(
          'Skipping empty remote provider version specification over existing tools',
          {
            providerVersionId: version.id,
            providerId: version.provider.id,
            existingSpecificationOid: version.specificationOid.toString(),
            newSpecificationType: capabilities.type
          }
        );
        return;
      }

      let spec = await providerSpecificationInternalService.ensureProviderSpecification({
        provider: version.provider,
        providerVersion: version,

        type: capabilities.type,

        specification: capabilities.specification,
        authMethods: capabilities.authMethods,
        features: capabilities.features,
        tools: capabilities.tools,
        triggers: capabilities.triggers
      });

      await providerVersionSetSpecificationQueue.add({
        versionOid: version.oid,
        result: {
          status: 'success',
          specificationOid: spec.oid,
          source: 'version'
        }
      });
    } catch (e) {
      if (version.specificationOid) return; // Already discovered

      await providerVersionSetSpecificationQueue.add({
        versionOid: version.oid,
        result: { status: 'not_discoverable' }
      });

      throw e; // We still want to retry
    }
  });
