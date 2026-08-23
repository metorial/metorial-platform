import { createLock } from '@lowerdeck/lock';
import { Service } from '@lowerdeck/service';
import { db, getId, type Provider, type ProviderVersion } from '@metorial-subspace/db';
import { schemaChangeNotificationAlertIngestQueue } from '@metorial-subspace/module-monitor/src/queues/schemaChange';
import type {
  Specification,
  SpecificationAuthMethod,
  SpecificationFeatures,
  SpecificationTool,
  SpecificationTrigger
} from '@metorial-subspace/provider-utils';
import { env } from '../env';
import { providerSpecificationInternalService } from './providerSpecification';

let mergeLock = createLock({
  name: 'sub/pint/pspec/lock/merge',
  redisUrl: env.service.REDIS_URL
});

let unionByKey = <T extends { key: string }>(current: T[], discovered: T[]) => {
  let byKey = new Map(current.map(item => [item.key, item]));
  let addedKeys: string[] = [];

  for (let item of discovered) {
    if (byKey.has(item.key)) continue;
    byKey.set(item.key, item);
    addedKeys.push(item.key);
  }

  return { merged: [...byKey.values()], addedKeys };
};

class providerVersionSpecificationMergeServiceImpl {
  async mergeIntoProviderVersionSpecification(d: {
    provider: Provider;
    providerVersion: ProviderVersion;

    discovered: {
      specification: Specification;
      authMethods: SpecificationAuthMethod[];
      features: SpecificationFeatures;
      tools: SpecificationTool[];
      triggers: SpecificationTrigger[];
    };
  }) {
    return await mergeLock.usingLock([String(d.providerVersion.oid)], async () => {
      let version = await db.providerVersion.findFirstOrThrow({
        where: { oid: d.providerVersion.oid },
        include: { specification: true }
      });

      let current = version.specification;
      if (!current) {
        let spec = await providerSpecificationInternalService.ensureProviderSpecification({
          provider: d.provider,
          providerVersion: version,
          type: 'full',
          ...d.discovered
        });

        await this.#repointVersion({ version, specificationOid: spec.oid });

        return { specification: spec, addedKeys: d.discovered.tools.map(t => t.key) };
      }

      let currentValue = current.value;

      let tools = unionByKey(currentValue.tools, d.discovered.tools);
      let authMethods = unionByKey(currentValue.authMethods, d.discovered.authMethods);
      let triggers = unionByKey(currentValue.triggers ?? [], d.discovered.triggers);

      let hasChanges =
        tools.addedKeys.length > 0 ||
        authMethods.addedKeys.length > 0 ||
        triggers.addedKeys.length > 0;
      if (!hasChanges) return { specification: current, addedKeys: [] };

      let spec = await providerSpecificationInternalService.ensureProviderSpecification({
        provider: d.provider,
        providerVersion: version,

        type: current.type,

        specification: currentValue.specification,
        features: currentValue.features,

        tools: tools.merged,
        authMethods: authMethods.merged,
        triggers: triggers.merged
      });

      if (spec.oid === current.oid) return { specification: spec, addedKeys: [] };

      await this.#repointVersion({ version, specificationOid: spec.oid });
      await this.#recordSpecificationChange({
        version,
        fromSpecificationOid: current.oid,
        toSpecificationOid: spec.oid
      });

      return { specification: spec, addedKeys: tools.addedKeys };
    });
  }

  async #repointVersion(d: { version: ProviderVersion; specificationOid: bigint }) {
    await db.providerVersion.update({
      where: { oid: d.version.oid },
      data: {
        specificationOid: d.specificationOid,
        specificationDiscoveryStatus: 'discovered'
      }
    });
  }

  async #recordSpecificationChange(d: {
    version: ProviderVersion;
    fromSpecificationOid: bigint;
    toSpecificationOid: bigint;
  }) {
    try {
      let change = await db.providerVersionSpecificationChange.create({
        data: {
          ...getId('providerVersionSpecificationChange'),

          fromSpecificationOid: d.fromSpecificationOid,
          toSpecificationOid: d.toSpecificationOid,

          fromVersionOid: d.version.oid,
          toVersionOid: d.version.oid
        }
      });

      let notification = await db.providerSpecificationChangeNotification.create({
        data: {
          ...getId('providerSpecificationChangeNotification'),

          target: 'version',
          versionOid: d.version.oid,
          versionSpecificationChangeOid: change.oid
        }
      });

      await schemaChangeNotificationAlertIngestQueue.add({
        notificationId: notification.id
      });
    } catch (e) {
      console.error('Failed to record provider version specification change:', e);
    }
  }
}

export let providerVersionSpecificationMergeService = Service.create(
  'providerVersionSpecificationMergeService',
  () => new providerVersionSpecificationMergeServiceImpl()
).build();
