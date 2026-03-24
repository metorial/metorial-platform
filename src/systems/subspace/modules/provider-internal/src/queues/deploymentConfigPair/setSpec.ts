import { createQueue, QueueRetryError } from '@lowerdeck/queue';
import {
  db,
  getId,
  withTransaction,
  type ProviderDeploymentConfigPairSpecificationDiscoveryStatus
} from '@metorial-subspace/db';
import { env } from '../../env';
import { providerVersionSetSpecificationQueue } from '../version/setSpec';

export let providerDeploymentConfigPairSetSpecificationQueue = createQueue<{
  providerDeploymentConfigPairOid: bigint;
  versionOid: bigint;
  result:
    | {
        status: 'success';
        specificationOid: bigint;
        discoveryRecordOid?: bigint;
      }
    | {
        status: 'failure';
        discoveryRecordOid?: bigint;
      };
}>({
  name: 'sub/pint/pdep/spec/set',
  redisUrl: env.service.REDIS_URL
});

export let providerDeploymentConfigPairSetSpecificationQueueProcessor =
  providerDeploymentConfigPairSetSpecificationQueue.process(async data => {
    let pair = await db.providerDeploymentConfigPair.findFirst({
      where: { oid: data.providerDeploymentConfigPairOid },
      include: { providerDeploymentVersion: { include: { deployment: true } } }
    });
    if (!pair) throw new QueueRetryError();

    let providerDeployment = pair.providerDeploymentVersion.deployment;

    let version = await db.providerVersion.findFirst({
      where: {
        oid: data.versionOid,
        providerVariantOid: providerDeployment.providerVariantOid
      }
    });
    if (!version) throw new QueueRetryError();

    let existingPairVersion = await db.providerDeploymentConfigPairProviderVersion.findUnique({
      where: {
        pairOid_versionOid: {
          pairOid: data.providerDeploymentConfigPairOid,
          versionOid: data.versionOid
        }
      },
      include: { previousPairVersion: true }
    });
    let previousPairVersion = existingPairVersion?.previousPairVersion;
    if (!previousPairVersion && version.previousVersionOid) {
      previousPairVersion = await db.providerDeploymentConfigPairProviderVersion.findUnique({
        where: {
          pairOid_versionOid: {
            pairOid: data.providerDeploymentConfigPairOid,
            versionOid: version.previousVersionOid
          }
        }
      });
    }

    let filter = {
      pairOid: data.providerDeploymentConfigPairOid,
      versionOid: data.versionOid
    };

    let result: {
      specificationDiscoveryStatus: ProviderDeploymentConfigPairSpecificationDiscoveryStatus;
      specificationOid: bigint | null;
    };

    if (data.result.status === 'success') {
      result = {
        specificationDiscoveryStatus: 'discovered',
        specificationOid: data.result.specificationOid
      };
    } else {
      result = {
        specificationDiscoveryStatus: 'failed',
        specificationOid: null
      };
    }

    let newPairVersion = await withTransaction(async db => {
      let newPairVersion = await db.providerDeploymentConfigPairProviderVersion.upsert({
        where: {
          pairOid_versionOid: filter
        },
        create: {
          ...getId('providerDeploymentConfigPairProviderVersion'),
          ...filter,
          ...result,
          previousPairVersionOid: previousPairVersion?.oid,
          latestDiscoveryRecordOid: data.result.discoveryRecordOid ?? null
        },
        update: {
          ...result,
          previousPairVersionOid: previousPairVersion?.oid,
          latestDiscoveryRecordOid: data.result.discoveryRecordOid ?? null
        },
        include: {
          specification: true
        }
      });

      if (newPairVersion.specificationOid) {
        let versionSpec = version.specificationOid
          ? await db.providerSpecification.findFirst({
              where: { oid: version.specificationOid }
            })
          : null;

        if (versionSpec?.type !== 'full' && newPairVersion.specification?.type === 'full') {
          // Update the version in this transaction
          // to avoid eventually consistent issues
          await db.providerVersion.update({
            where: { oid: version.oid },
            data: { specificationOid: newPairVersion.specificationOid }
          });

          await providerVersionSetSpecificationQueue.add({
            versionOid: version.oid,
            result: {
              status: 'success',
              specificationOid: newPairVersion.specificationOid,
              source: 'pair'
            }
          });
        }
      }

      return newPairVersion;
    });

    if (newPairVersion.specificationOid) {
      if (
        previousPairVersion?.specificationOid &&
        newPairVersion.specificationOid !== previousPairVersion.specificationOid
      ) {
        try {
          let change = await db.providerDeploymentConfigPairSpecificationChange.create({
            data: {
              ...getId('providerDeploymentConfigPairSpecificationChange'),

              toPairVersionOid: newPairVersion.oid,
              fromPairVersionOid: previousPairVersion.oid,

              toSpecificationOid: newPairVersion.specificationOid,
              fromSpecificationOid: previousPairVersion.specificationOid
            }
          });
          await db.providerSpecificationChangeNotification.create({
            data: {
              ...getId('providerSpecificationChangeNotification'),

              tenantOid: providerDeployment.tenantOid,
              solutionOid: providerDeployment.solutionOid,

              target: 'deployment_config_pair',
              versionOid: version.oid,
              pairSpecificationChangeOid: change.oid,
              deploymentConfigPairOid: newPairVersion.pairOid
            }
          });
        } catch (e) {
          // Maybe a unique constraint violation, ignore for now
        }
      }
    }
  });
