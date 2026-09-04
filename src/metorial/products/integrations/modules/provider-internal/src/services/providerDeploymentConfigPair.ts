import { delay } from '@lowerdeck/delay';
import { Service } from '@lowerdeck/service';
import {
  addAfterTransactionHook,
  db,
  getId,
  type ProviderAuthConfig,
  type ProviderAuthConfigVersion,
  type ProviderConfig,
  type ProviderConfigVersion,
  type ProviderDeployment,
  type ProviderDeploymentConfigPairDiscovery,
  type ProviderDeploymentConfigPairProviderVersion,
  type ProviderDeploymentVersion,
  type ProviderVersion,
  type TransactionDB,
  withTransaction
} from '@metorial-subspace/db';
import {
  providerDeploymentConfigPairCreatedQueue,
  providerDeploymentConfigPairVersionCreatedQueue
} from '../queues/lifecycle/deploymentConfigPair';

interface PairParts {
  deployment: ProviderDeployment & { currentVersion: ProviderDeploymentVersion | null };
  config: ProviderConfig & { currentVersion: ProviderConfigVersion | null };
  authConfig:
    | (ProviderAuthConfig & { currentVersion: ProviderAuthConfigVersion | null })
    | null;
}

let getPairIdentifier = (d: PairParts) =>
  `${d.deployment.currentVersion!.oid.toString(36)}.${d.config.currentVersion!.oid.toString(36)}.${
    d.authConfig ? d.authConfig.currentVersion!.oid.toString(36) : '$'
  }`;

let isUniqueConstraintError = (error: any) => error?.code === 'P2002';

class providerDeploymentConfigPairInternalServiceImpl {
  private async upsertDeploymentConfigPairWithoutCreatingVersion(
    d: PairParts & { version?: ProviderVersion }
  ) {
    let getExisting = async (pdb: typeof db | TransactionDB = db) => {
      let existing = await pdb.providerDeploymentConfigPair.findUnique({
        where: { identifier: getPairIdentifier(d) },
        include: {
          versions: d.version
            ? {
                where: { versionOid: d.version.oid },
                include: { latestDiscoveryRecord: true }
              }
            : false
        }
      });

      if (existing) {
        return {
          pair: existing,
          version: existing.versions?.[0] as
            | undefined
            | (ProviderDeploymentConfigPairProviderVersion & {
                latestDiscoveryRecord: ProviderDeploymentConfigPairDiscovery | null;
              }),
          created: false
        };
      }

      return null;
    };

    try {
      return await withTransaction(async db => {
        let existing = await getExisting(db);
        if (existing) return existing;

        let newId = getId('providerDeploymentConfigPair');
        let pair = await db.providerDeploymentConfigPair.upsert({
          where: { identifier: getPairIdentifier(d) },
          create: {
            ...newId,

            identifier: getPairIdentifier(d),

            providerDeploymentVersionOid: d.deployment.currentVersion!.oid,
            providerConfigVersionOid: d.config.currentVersion!.oid,
            providerAuthConfigVersionOid: d.authConfig?.currentVersion?.oid,

            tenantOid: d.deployment.tenantOid,
            projectOid: d.deployment.projectOid,
            environmentOid: d.deployment.environmentOid,
            instanceOid: d.deployment.instanceOid
          },
          update: {}
        });

        let created = pair.id === newId.id;

        if (created) {
          await addAfterTransactionHook(async () =>
            providerDeploymentConfigPairCreatedQueue.add({
              providerDeploymentConfigPairId: pair.id
            })
          );
        }

        let version = d.version
          ? await db.providerDeploymentConfigPairProviderVersion.findFirst({
              where: {
                pairOid: pair.oid,
                versionOid: d.version.oid
              },
              include: { latestDiscoveryRecord: true }
            })
          : null;

        return {
          pair,
          created,
          version: version ?? undefined
        };
      });
    } catch (error: any) {
      if (isUniqueConstraintError(error)) {
        let existing = await getExisting();
        if (existing) return existing;
      }

      throw error;
    }
  }

  async upsertDeploymentConfigPair(d: PairParts & { version?: ProviderVersion }) {
    try {
      let res = await this.upsertDeploymentConfigPairWithoutCreatingVersion(d);

      if (!d.version) {
        return {
          pair: res.pair,
          version: undefined
        };
      }
      let providerVersion = d.version;

      if (res.version) {
        return {
          pair: res.pair,
          version: res.version
        };
      }

      return await withTransaction(async db => {
        let currentVersion = await db.providerDeploymentConfigPairProviderVersion.findFirst({
          where: {
            pairOid: res.pair.oid,
            versionOid: providerVersion.oid
          },
          include: { latestDiscoveryRecord: true }
        });

        if (currentVersion) {
          return {
            pair: res.pair,
            version: currentVersion
          };
        }

        let newId = getId('providerDeploymentConfigPairProviderVersion');
        let version = await db.providerDeploymentConfigPairProviderVersion.upsert({
          where: {
            pairOid_versionOid: {
              pairOid: res.pair.oid,
              versionOid: providerVersion.oid
            }
          },
          create: {
            ...newId,
            pairOid: res.pair.oid,
            versionOid: providerVersion.oid,
            specificationDiscoveryStatus: 'discovering'
          },
          update: {},
          include: { latestDiscoveryRecord: true }
        });

        if (version.id === newId.id) {
          await addAfterTransactionHook(async () =>
            providerDeploymentConfigPairVersionCreatedQueue.add({
              providerDeploymentConfigPairVersionId: version.id
            })
          );
        }

        return {
          pair: res.pair,
          version
        };
      });
    } catch (error: any) {
      if (isUniqueConstraintError(error) && d.version) {
        let res = await this.upsertDeploymentConfigPairWithoutCreatingVersion(d);
        let version = await db.providerDeploymentConfigPairProviderVersion.findFirst({
          where: {
            pairOid: res.pair.oid,
            versionOid: d.version.oid
          },
          include: { latestDiscoveryRecord: true }
        });

        if (version) {
          return {
            pair: res.pair,
            version
          };
        }
      }

      throw error;
    }
  }

  async useDeploymentConfigPair(d: PairParts & { version: ProviderVersion }) {
    let res = await this.upsertDeploymentConfigPair(d);

    // This should never happen
    if (!res.version) {
      throw new Error('Failed to create deployment config pair version');
    }

    if (res.version.specificationDiscoveryStatus === 'discovering') {
      for (let i = 1; i < 75; i++) {
        await delay(Math.min(100, 25 * i));
        res.version = await db.providerDeploymentConfigPairProviderVersion.findFirstOrThrow({
          where: { oid: res.version.oid },
          include: { latestDiscoveryRecord: true }
        });
        if (res.version.specificationDiscoveryStatus !== 'discovering') break;
      }
    }

    if (res.pair.lastUsedPairVersionOid !== res.version.oid) {
      res.pair.lastUsedPairVersionOid = res.version.oid;
      await db.providerDeploymentConfigPair.updateMany({
        where: { oid: res.pair.oid },
        data: { lastUsedPairVersionOid: res.version.oid }
      });
    }

    return res;
  }
}

export let providerDeploymentConfigPairInternalService = Service.create(
  'providerDeploymentConfigPairInternalService',
  () => new providerDeploymentConfigPairInternalServiceImpl()
).build();
