import { canonicalize } from '@lowerdeck/canonicalize';
import { Hash } from '@lowerdeck/hash';
import { createLock } from '@lowerdeck/lock';
import { Service } from '@lowerdeck/service';
import {
  db,
  getId,
  type Provider,
  type ProviderSpecificationType,
  type ProviderVersion,
  withTransaction
} from '@metorial-subspace/db';
import type {
  Specification,
  SpecificationAuthMethod,
  SpecificationFeatures,
  SpecificationTool,
  SpecificationTrigger,
  SpecificationTriggerGroup
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
    triggerGroups: SpecificationTriggerGroup[];
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
    let triggerGroups = dedupeByKey(d.triggerGroups, {
      entity: 'trigger_groups',
      providerId: d.provider.id,
      providerVersionId: d.providerVersion.id
    });

    let specHash = await Hash.sha256(
      canonicalize({
        type: d.type,
        providerId: d.provider.id,
        specification: d.specification,
        authMethods,
        features: d.features,
        tools,
        triggers,
        triggerGroups
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
        return await withTransaction(async db => {
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
          await db.providerTriggerGroupGlobal.createMany({
            skipDuplicates: true,
            data: triggerGroups.map(triggerGroup => ({
              ...getId('providerTriggerGroupGlobal'),
              key: triggerGroup.key,
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
          let globalTriggerGroups = await db.providerTriggerGroupGlobal.findMany({
            where: { providerOid: d.provider.oid },
            select: { oid: true, key: true }
          });

          let globalToolsMap = new Map(globalTools.map(t => [t.key, t]));
          let globalAuthMethodsMap = new Map(globalAuthMethods.map(am => [am.key, am]));
          let globalTriggersMap = new Map(globalTriggers.map(t => [t.key, t]));
          let globalTriggerGroupsMap = new Map(
            globalTriggerGroups.map(triggerGroup => [triggerGroup.key, triggerGroup])
          );

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
                triggers,
                triggerGroups
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
                    hash: await Hash.sha256(canonicalize([d.provider.id, t]))
                  }))
                )
              },

              providerTriggerGroups: {
                create: await Promise.all(
                  triggerGroups.map(async triggerGroup => ({
                    ...getId('providerTriggerGroup'),
                    specId: triggerGroup.specId,
                    specUniqueIdentifier:
                      triggerGroup.specUniqueIdentifier ?? triggerGroup.specId,
                    key: triggerGroup.key,

                    name: triggerGroup.name,
                    description: triggerGroup.description,

                    value: triggerGroup,

                    providerOid: d.provider.oid,
                    globalOid: globalTriggerGroupsMap.get(triggerGroup.key)!.oid,
                    hash: await Hash.sha256(canonicalize([d.provider.id, triggerGroup]))
                  }))
                )
              }
            },
            include: {
              providerAuthMethods: true,
              providerTools: true,
              providerTriggers: true,
              providerTriggerGroups: true
            }
          });

          let triggerGroupOidByKey = new Map(
            spec.providerTriggerGroups.map(triggerGroup => [triggerGroup.key, triggerGroup.oid])
          );

          await Promise.all(
            spec.providerTriggers.map(async trigger => {
              if (!trigger.value.triggerGroupKey) return;

              let triggerGroupOid = triggerGroupOidByKey.get(trigger.value.triggerGroupKey);
              if (!triggerGroupOid) {
                throw new Error(
                  `Provider trigger group not found: ${trigger.value.triggerGroupKey}`
                );
              }

              await db.providerTrigger.update({
                where: { oid: trigger.oid },
                data: { triggerGroupOid }
              });
            })
          );

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
