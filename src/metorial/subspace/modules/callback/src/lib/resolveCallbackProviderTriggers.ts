import { badRequestError, ServiceError } from '@lowerdeck/error';
import { db, type Environment, type ProviderDeployment } from '@metorial-subspace/db';
import { providerDeploymentInternalService } from '@metorial-subspace/module-provider-internal';

export let resolveCallbackProviderTriggers = async (d: {
  environment: Environment;
  deployment: ProviderDeployment;
  inputTriggers: { triggerId: string; eventTypes?: string[] }[];
}) => {
  let deployment = await db.providerDeployment.findFirstOrThrow({
    where: { oid: d.deployment.oid },
    include: {
      provider: true,
      currentVersion: {
        include: { lockedVersion: true }
      }
    }
  });

  let version = await providerDeploymentInternalService.getCurrentVersion({
    provider: deployment.provider,
    environment: d.environment,
    deployment
  });
  if (!version?.specificationOid) {
    throw new ServiceError(
      badRequestError({
        code: 'missing_specification',
        message: 'Deployment has no discovered specification with triggers.'
      })
    );
  }

  let providerTriggers = await db.providerTrigger.findMany({
    where: { specificationOid: version.specificationOid }
  });
  let byMatcher = new Map<string, (typeof providerTriggers)[number]>();
  for (let trigger of providerTriggers) {
    byMatcher.set(trigger.key, trigger);
    byMatcher.set(trigger.specId, trigger);
    byMatcher.set(trigger.callableId, trigger);
    byMatcher.set(trigger.specUniqueIdentifier, trigger);
  }

  let seenTriggerOids = new Set<bigint>();
  return d.inputTriggers.map(item => {
    let providerTrigger = byMatcher.get(item.triggerId);
    if (!providerTrigger) {
      throw new ServiceError(
        badRequestError({
          code: 'invalid_callback_trigger',
          message: `Trigger not found in provider specification: ${item.triggerId}`
        })
      );
    }
    if (seenTriggerOids.has(providerTrigger.oid)) {
      throw new ServiceError(
        badRequestError({
          code: 'duplicate_callback_trigger',
          message: `Trigger specified multiple times: ${providerTrigger.id}`
        })
      );
    }
    seenTriggerOids.add(providerTrigger.oid);

    return {
      providerTrigger,
      eventTypes: item.eventTypes?.length ? item.eventTypes : []
    };
  });
};
