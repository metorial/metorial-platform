import { canonicalize } from '@lowerdeck/canonicalize';
import { Hash } from '@lowerdeck/hash';
import { createLock } from '@lowerdeck/lock';
import { Service } from '@lowerdeck/service';
import {
  db,
  getId,
  type Provider,
  type ProviderSpecificationType,
  type ProviderVersion
} from '@metorial-subspace/db';
import type {
  Specification,
  SpecificationAuthMethod,
  SpecificationFeatures,
  SpecificationTool,
  SpecificationTrigger
} from '@metorial-subspace/provider-utils';
import { env } from '../env';
import { specificationCreatedQueue } from '../queues/lifecycle/specification';

let specLock = createLock({
  name: 'sub/pint/pspec/lock/ensure',
  redisUrl: env.service.REDIS_URL
});

let dedupeByKey = <T extends { key: string }>(
  items: T[],
  d: {
    entity: string;
    providerId: string;
    providerVersionId?: string;
  }
) => {
  let deduped: T[] = [];
  let seen = new Set<string>();
  let duplicateKeys = new Set<string>();

  for (let item of items) {
    if (seen.has(item.key)) {
      duplicateKeys.add(item.key);
      continue;
    }

    seen.add(item.key);
    deduped.push(item);
  }

  if (duplicateKeys.size > 0) {
    console.warn(`Filtered duplicate provider specification ${d.entity}`, {
      providerId: d.providerId,
      providerVersionId: d.providerVersionId,
      duplicateKeys: [...duplicateKeys]
    });
  }

  return deduped;
};

class providerSpecificationInternalServiceImpl {
  async ensureProviderSpecification(d: {
    provider: Provider;
    providerVersion: ProviderVersion;

    type: ProviderSpecificationType;

    specification: Specification;
    authMethods: SpecificationAuthMethod[];
    features: SpecificationFeatures;
    tools: SpecificationTool[];
    triggers: SpecificationTrigger[];
  }) {
    let authMethods = dedupeByKey(d.authMethods, {
      entity: 'auth_methods',
      providerId: d.provider.id,
      providerVersionId: d.providerVersion.id
    });
    let tools = dedupeByKey(d.tools, {
      entity: 'tools',
      providerId: d.provider.id,
      providerVersionId: d.providerVersion.id
    });
    let triggers = dedupeByKey(d.triggers, {
      entity: 'triggers',
      providerId: d.provider.id,
      providerVersionId: d.providerVersion.id
    });

    let adapterIdentifiers = [
      ...new Set(
        [...tools, ...triggers].flatMap(action =>
          action.adapterIdentifier ? [action.adapterIdentifier] : []
        )
      )
    ];
    let providerAdapters = adapterIdentifiers.length
      ? await db.providerAdapter.findMany({
          where: {
            providerOid: d.provider.oid,
            identifier: { in: adapterIdentifiers }
          },
          select: { oid: true, identifier: true }
        })
      : [];
    let adapterByIdentifier = new Map(
      providerAdapters.map(adapter => [adapter.identifier, adapter])
    );
    let missingAdapterIdentifier = adapterIdentifiers.find(
      identifier => !adapterByIdentifier.has(identifier)
    );
    if (missingAdapterIdentifier) {
      throw new Error(
        `Provider adapter not found for specification action: ${missingAdapterIdentifier}`
      );
    }

    let specHash = await Hash.sha256(
      canonicalize({
        type: d.type,
        providerId: d.provider.id,
        specification: d.specification,
        authMethods,
        features: d.features,
        tools,
        triggers
      })
    );

    return await specLock.usingLock([d.provider.id, specHash], async () => {
      let existingSpec = await db.providerSpecification.findUnique({
        where: {
          providerOid_hash: {
            providerOid: d.provider.oid,
            hash: specHash
          }
        }
      });
      if (existingSpec) return existingSpec;

      let defaultAuthConfig =
        authMethods.find(am => am.type === 'token') ??
        authMethods.find(am => am.type === 'oauth') ??
        authMethods[0];

      try {
        return await db.$transaction(async db => {
          await db.providerToolGlobal.createMany({
            skipDuplicates: true,
            data: tools.map(t => ({
              ...getId('providerToolGlobal'),
              key: t.key,
              providerOid: d.provider.oid
            }))
          });
          await db.providerAuthMethodGlobal.createMany({
            skipDuplicates: true,
            data: authMethods.map(am => ({
              ...getId('providerAuthMethodGlobal'),
              key: am.key,
              providerOid: d.provider.oid
            }))
          });
          await db.providerTriggerGlobal.createMany({
            skipDuplicates: true,
            data: triggers.map(t => ({
              ...getId('providerTriggerGlobal'),
              key: t.key,
              providerOid: d.provider.oid
            }))
          });

          let globalTools = await db.providerToolGlobal.findMany({
            where: { providerOid: d.provider.oid },
            select: { oid: true, key: true }
          });
          let globalAuthMethods = await db.providerAuthMethodGlobal.findMany({
            where: { providerOid: d.provider.oid },
            select: { oid: true, key: true }
          });
          let globalTriggers = await db.providerTriggerGlobal.findMany({
            where: { providerOid: d.provider.oid },
            select: { oid: true, key: true }
          });

          let globalToolsMap = new Map(globalTools.map(t => [t.key, t]));
          let globalAuthMethodsMap = new Map(globalAuthMethods.map(am => [am.key, am]));
          let globalTriggersMap = new Map(globalTriggers.map(t => [t.key, t]));

          let spec = await db.providerSpecification.create({
            data: {
              ...getId('providerSpecification'),
              providerOid: d.provider.oid,

              type: d.type,

              hash: specHash,

              specId: d.specification.specId,
              specUniqueIdentifier:
                d.specification.specUniqueIdentifier ?? d.specification.specId,
              key: d.specification.key,

              name: d.specification.name,
              description: d.specification.description,

              value: {
                specification: d.specification,
                authMethods,
                features: d.features,
                tools,
                triggers
              },

              supportsAuthMethod: d.features.supportsAuthMethod,
              configContainsAuth: d.features.configContainsAuth,

              providerAuthMethods: {
                create: await Promise.all(
                  authMethods.map(async am => ({
                    ...getId('providerAuthMethod'),
                    specId: am.specId,
                    specUniqueIdentifier: am.specUniqueIdentifier ?? am.specId,
                    callableId: am.callableId,

                    type: am.type,
                    key: am.key,
                    isDefault: am.specId === defaultAuthConfig?.specId,

                    name: am.name,
                    description: am.description,

                    value: am,

                    providerOid: d.provider.oid,
                    globalOid: globalAuthMethodsMap.get(am.key)!.oid,
                    hash: await Hash.sha256(canonicalize([d.provider.id, am]))
                  }))
                )
              },

              providerTools: {
                create: await Promise.all(
                  tools.map(async t => ({
                    ...getId('providerTool'),
                    specId: t.specId,
                    specUniqueIdentifier: t.specUniqueIdentifier ?? t.specId,
                    callableId: t.callableId,
                    key: t.key,

                    name: t.name,
                    description: t.description,

                    value: t,

                    providerOid: d.provider.oid,
                    globalOid: globalToolsMap.get(t.key)!.oid,
                    adapterOid: t.adapterIdentifier
                      ? adapterByIdentifier.get(t.adapterIdentifier)!.oid
                      : null,
                    hash: await Hash.sha256(canonicalize([d.provider.id, t]))
                  }))
                )
              },

              providerTriggers: {
                create: await Promise.all(
                  triggers.map(async t => ({
                    ...getId('providerTrigger'),
                    specId: t.specId,
                    specUniqueIdentifier: t.specUniqueIdentifier ?? t.specId,
                    callableId: t.callableId,
                    key: t.key,

                    name: t.name,
                    description: t.description,

                    value: t,

                    providerOid: d.provider.oid,
                    globalOid: globalTriggersMap.get(t.key)!.oid,
                    adapterOid: t.adapterIdentifier
                      ? adapterByIdentifier.get(t.adapterIdentifier)!.oid
                      : null,
                    hash: await Hash.sha256(canonicalize([d.provider.id, t]))
                  }))
                )
              }
            },
            include: {
              providerAuthMethods: true,
              providerTools: true,
              providerTriggers: true
            }
          });

          await specificationCreatedQueue.add({ specificationId: spec.id });

          return spec;
        });
      } catch (e) {
        let spec = await db.providerSpecification.findUnique({
          where: {
            providerOid_hash: {
              providerOid: d.provider.oid,
              hash: specHash
            }
          }
        });
        if (spec) return spec;
        throw e;
      }
    });
  }
}

export let providerSpecificationInternalService = Service.create(
  'providerSpecificationInternalService',
  () => new providerSpecificationInternalServiceImpl()
).build();
