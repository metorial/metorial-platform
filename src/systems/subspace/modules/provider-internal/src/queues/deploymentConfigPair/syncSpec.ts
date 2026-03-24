import { createQueue, QueueRetryError } from '@lowerdeck/queue';
import { db, getId } from '@metorial-subspace/db';
import { getBackend } from '@metorial-subspace/provider';
import type { ProviderSpecificationGetRes } from '@metorial-subspace/provider-utils';
import { env } from '../../env';
import { providerSpecificationInternalService } from '../../services/providerSpecification';
import { providerDeploymentConfigPairSetSpecificationQueue } from './setSpec';

export let providerDeploymentConfigPairSyncSpecificationQueue = createQueue<{
  providerDeploymentConfigPairId: string;
  versionId: string;
}>({
  name: 'sub/pint/pdep/spec/sync',
  redisUrl: env.service.REDIS_URL
});

export let providerDeploymentConfigPairSyncSpecificationQueueProcessor =
  providerDeploymentConfigPairSyncSpecificationQueue.process(async data => {
    let pair = await db.providerDeploymentConfigPair.findFirst({
      where: { id: data.providerDeploymentConfigPairId },
      include: {
        tenant: true,
        providerConfigVersion: true,
        providerAuthConfigVersion: true,
        providerDeploymentVersion: {
          include: {
            deployment: {
              include: { providerVariant: true, provider: true }
            }
          }
        }
      }
    });
    if (!pair) throw new QueueRetryError();

    let providerDeployment = pair.providerDeploymentVersion.deployment;

    let backend = await getBackend({
      entity: providerDeployment.providerVariant
    });

    let version = await db.providerVersion.findFirstOrThrow({
      where: { id: data.versionId },
      include: { specification: true }
    });

    try {
      let discoverParams = {
        tenant: pair.tenant,
        provider: providerDeployment.provider,
        providerVariant: providerDeployment.providerVariant,
        providerVersion: version,

        deploymentVersion: pair.providerDeploymentVersion,
        configVersion: pair.providerConfigVersion,
        authConfigVersion: pair.providerAuthConfigVersion
      };

      if (version.specificationOid && process.env.NODE_ENV === 'production') {
        // If we have the full spec, we might be able to skip discovery depending on the backend
        let alreadyHasFullSpec = version.specification?.type === 'full';

        if (alreadyHasFullSpec) {
          // Ask the backend if it wants us to discover the spec for this provider pair,
          // even though we already have a full spec. Some backends might want to do this
          // if we can't be sure that the spec remains the same across different deployments or configs.
          let { shouldDiscover } =
            await backend.capabilities.shouldDiscoverSpecificationForProviderPair(
              discoverParams
            );

          if (!shouldDiscover) {
            await providerDeploymentConfigPairSetSpecificationQueue.add({
              providerDeploymentConfigPairOid: pair.oid,
              versionOid: version.oid,
              result: { status: 'success', specificationOid: version.specificationOid }
            });
            return;
          }
        }
      }

      let capabilities: ProviderSpecificationGetRes = null;
      try {
        capabilities =
          await backend.capabilities.getSpecificationForProviderPair(discoverParams);
      } catch (e) {
        console.error('Error discovering capabilities:', e);
      }

      let record =
        capabilities?.warnings?.length || capabilities?.status == 'failure'
          ? await db.providerDeploymentConfigPairDiscovery.create({
              data: {
                ...getId('providerDeploymentConfigPairDiscovery'),
                status:
                  capabilities.status === 'success' ? 'succeeded_with_warnings' : 'failed',
                error: capabilities.status === 'failure' ? capabilities.error : null,
                warnings: capabilities.warnings,
                pairOid: pair.oid,
                versionOid: version.oid
              }
            })
          : undefined;

      // Some backends might need a config to be able to discover specifications
      if (!capabilities || capabilities.status == 'failure') {
        await providerDeploymentConfigPairSetSpecificationQueue.add({
          providerDeploymentConfigPairOid: pair.oid,
          versionOid: version.oid,
          result: { status: 'failure', discoveryRecordOid: record?.oid }
        });
        return;
      }

      let spec = await providerSpecificationInternalService.ensureProviderSpecification({
        provider: providerDeployment.provider,
        providerVersion: version,

        type: capabilities.type,

        specification: capabilities.specification,
        authMethods: capabilities.authMethods,
        features: capabilities.features,
        tools: capabilities.tools,
        triggers: capabilities.triggers
      });

      await providerDeploymentConfigPairSetSpecificationQueue.add({
        providerDeploymentConfigPairOid: pair.oid,
        versionOid: version.oid,
        result: {
          status: 'success',
          specificationOid: spec.oid,
          discoveryRecordOid: record?.oid
        }
      });
    } catch (e) {
      await providerDeploymentConfigPairSetSpecificationQueue.add({
        providerDeploymentConfigPairOid: pair.oid,
        versionOid: version.oid,
        result: { status: 'failure' }
      });

      throw e; // We still want to retry
    }
  });
