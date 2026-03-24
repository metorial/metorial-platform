import { createLock } from '@lowerdeck/lock';
import { Service } from '@lowerdeck/service';
import {
  addAfterTransactionHook,
  type Backend,
  getId,
  type ProviderVariant,
  type ProviderVersion,
  type ShuttleServer,
  type ShuttleServerVersion,
  type Slate,
  type SlateVersion,
  withTransaction
} from '@metorial-subspace/db';
import { getBackend } from '@metorial-subspace/provider';
import { ensureProviderType } from '@metorial-subspace/provider-utils';
import { env } from '../env';
import { createTag } from '../lib/createTag';
import { groupBy } from '../lib/groupBy';
import {
  providerVersionCreatedQueue,
  providerVersionUpdatedQueue
} from '../queues/lifecycle/providerVersion';

let versionCreateLock = createLock({
  name: 'sub/pint/pver/lock/create',
  redisUrl: env.service.REDIS_URL
});

class providerVersionInternalServiceImpl {
  async enrichProviderVersions<T extends ProviderVersion>(d: { providers: T[] }) {
    let providersByBackend = groupBy(d.providers, 'backendOid');

    return (
      await Promise.all(
        providersByBackend.entries().map(async ([_, providers]) => {
          let anyProviderVersion = providers[0];
          if (!anyProviderVersion) return [];

          let backend = await getBackend({ entity: anyProviderVersion });

          let enriched = await backend.enrichment.enrichProviderVersions({
            providerVersionIds: providers.map(p => p.id)
          });
          let enrichedMap = new Map<
            string,
            (typeof enriched.providers)[number]
          >(enriched.providers.map(p => [p.providerVersionId, p]));

          return providers.map(provider => {
            let enrichment = enrichedMap.get(provider.id);

            return {
              ...provider,
              ...(enrichment ?? {})
            };
          });
        })
      )
    ).flat();
  }

  async upsertVersion(d: {
    variant: ProviderVariant;

    isCurrent: boolean;

    source:
      | {
          type: 'slates';
          slate: Slate;
          slateVersion: SlateVersion;
          backend: Backend;
        }
      | {
          type: 'shuttle';
          shuttleServer: ShuttleServer;
          shuttleServerVersion: ShuttleServerVersion;
          backend: Backend;
        }
      | {
          type: 'native';
          integrationIdentifier: string;
          backend: Backend;
        };

    info: {
      name: string;
    };

    type: {
      name: string;
      attributes: PrismaJson.ProviderTypeAttributes;
    };
  }) {
    return versionCreateLock.usingLock(
      [String(d.variant.oid), String(d.variant.slateOid)],
      () =>
        withTransaction(async db => {
          let identifier = `provider::${d.source.type}::`;
          if (d.source.type === 'slates') {
            identifier += `${d.source.slate.oid}::${d.source.slateVersion.oid}`;
          } else if (d.source.type === 'shuttle') {
            identifier += `${d.source.shuttleServer.oid}::${d.source.shuttleServerVersion.oid}`;
          } else if (d.source.type === 'native') {
            identifier += `${d.source.integrationIdentifier}::version`;
          } else {
            throw new Error('Unknown provider source type');
          }

          let currentVariant = await db.providerVariant.findFirst({
            where: { oid: d.variant.oid }
          });

          let type = await ensureProviderType(d.type.name, d.type.attributes);

          let versionData = {
            identifier,

            name: d.info.name,
            backendOid: d.source.backend.oid,
            providerOid: d.variant.providerOid,
            providerVariantOid: d.variant.oid,

            typeOid: type.oid,

            slateOid: d.source.type === 'slates' ? d.source.slate.oid : null,
            slateVersionOid: d.source.type === 'slates' ? d.source.slateVersion.oid : null,

            shuttleServerOid: d.source.type === 'shuttle' ? d.source.shuttleServer.oid : null,
            shuttleServerVersionOid:
              d.source.type === 'shuttle' ? d.source.shuttleServerVersion.oid : null,

            isCurrent: d.isCurrent
          };

          let existingVersion = await db.providerVersion.findFirst({
            where: { identifier: versionData.identifier }
          });

          let newId = getId('providerVersion');
          let providerVersion = existingVersion
            ? await db.providerVersion.update({
                where: { identifier: versionData.identifier },
                data: versionData
              })
            : await db.providerVersion.upsert({
                where: { identifier: versionData.identifier },
                create: {
                  ...newId,
                  ...versionData,
                  specificationDiscoveryStatus: 'discovering',
                  previousVersionOid: currentVariant?.currentVersionOid,
                  tag: await createTag()
                },
                update: versionData
              });

          if (d.isCurrent) {
            await db.providerVariant.updateMany({
              where: { oid: d.variant.oid },
              data: { currentVersionOid: providerVersion.oid }
            });
            await db.providerVersion.updateMany({
              where: {
                providerVariantOid: d.variant.oid,
                oid: { not: providerVersion.oid }
              },
              data: { isCurrent: false }
            });
          }

          await addAfterTransactionHook(async () => {
            if (providerVersion.id === newId.id) {
              await providerVersionCreatedQueue.add({ providerVersionId: providerVersion.id });
            } else {
              await providerVersionUpdatedQueue.add({ providerVersionId: providerVersion.id });
            }
          });

          return providerVersion;
        })
    );
  }
}

export let providerVersionInternalService = Service.create(
  'providerVersionInternalService',
  () => new providerVersionInternalServiceImpl()
).build();
