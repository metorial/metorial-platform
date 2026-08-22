import { badRequestError, notFoundError, ServiceError } from '@lowerdeck/error';
import { Service } from '@lowerdeck/service';
import {
  type Callback,
  db,
  getId,
  type ProviderTrigger,
  type IntegrationProvider,
  type Tenant
} from '@metorial-subspace/db';
import { providerDeploymentInternalService } from '@metorial-subspace/module-provider-internal';
import { getBackend } from '@metorial-subspace/provider';

type CallbackConfigDb = Pick<
  typeof db,
  | 'callback'
  | 'callbackConfig'
  | 'callbackConfigVersion'
  | 'callbackConfigUpdate'
  | 'slateCallbackConfig'
>;

let loadProviderContext = async (integrationProviderOid: bigint) => {
  let integrationProvider = await db.integrationProvider.findUnique({
    where: { oid: integrationProviderOid },
    include: {
      currentVersion: {
        include: {
          deployment: {
            include: {
              provider: { include: { defaultVariant: true } },
              currentVersion: { include: { lockedVersion: true } }
            }
          }
        }
      },
      environment: true
    }
  });
  if (!integrationProvider?.currentVersion) {
    throw new ServiceError(
      badRequestError({
        code: 'integration_provider_version_required',
        message: 'Integration provider has no active version.'
      })
    );
  }

  let deployment = integrationProvider.currentVersion.deployment;
  let provider = deployment.provider;
  if (!provider.defaultVariant) {
    throw new ServiceError(
      badRequestError({
        code: 'callback_not_supported',
        message: 'The provider has no callback-capable backend.'
      })
    );
  }

  let providerVersion = await providerDeploymentInternalService.getCurrentVersion({
    provider,
    environment: integrationProvider.environment,
    deployment
  });
  if (!providerVersion?.specificationOid) {
    throw new ServiceError(
      badRequestError({
        code: 'missing_specification',
        message: 'Deployment has no discovered specification with triggers.'
      })
    );
  }

  return {
    integrationProvider,
    deployment,
    provider,
    providerVariant: provider.defaultVariant,
    providerVersion
  };
};

let canonicalTriggerIds = (providerTriggers: ProviderTrigger[], specificationOid: bigint) => {
  let seen = new Set<bigint>();
  for (let trigger of providerTriggers) {
    if (trigger.specificationOid !== specificationOid) {
      throw new ServiceError(
        badRequestError({
          code: 'invalid_callback_trigger',
          message: `Trigger does not belong to the deployment specification: ${trigger.id}`
        })
      );
    }
    if (seen.has(trigger.oid)) {
      throw new ServiceError(
        badRequestError({
          code: 'duplicate_callback_trigger',
          message: `Trigger specified multiple times: ${trigger.id}`
        })
      );
    }
    seen.add(trigger.oid);
  }
  return providerTriggers.map(trigger => trigger.specId);
};

class callbackConfigServiceImpl {
  async getCallbackConfigSchemaInternal(d: {
    tenant: Tenant;
    integrationProvider: IntegrationProvider;
    providerTriggers: ProviderTrigger[];
  }) {
    let context = await loadProviderContext(d.integrationProvider.oid);
    if (context.integrationProvider.tenantOid !== d.tenant.oid) {
      throw new ServiceError(notFoundError('integration.provider'));
    }
    let triggerIds = canonicalTriggerIds(
      d.providerTriggers,
      context.providerVersion.specificationOid!
    );
    let backend = await getBackend({ entity: context.providerVariant });
    return await backend.callbackConfig.getCallbackConfigSchema({
      tenant: d.tenant,
      provider: context.provider,
      providerVariant: context.providerVariant,
      deployment: context.deployment,
      triggerIds
    });
  }

  async setCallbackConfigInternal(d: {
    tenant: Tenant;
    callback: Callback;
    providerTriggers: ProviderTrigger[];
    valuesPatch: Record<string, string>;
    db: CallbackConfigDb;
  }) {
    let context = await loadProviderContext(d.callback.integrationProviderOid);
    if (
      context.integrationProvider.tenantOid !== d.tenant.oid ||
      d.callback.tenantOid !== d.tenant.oid
    ) {
      throw new ServiceError(notFoundError('callback'));
    }
    let triggerIds = canonicalTriggerIds(
      d.providerTriggers,
      context.providerVersion.specificationOid!
    );
    let existing = await d.db.callback.findUniqueOrThrow({
      where: { oid: d.callback.oid },
      include: {
        callbackConfig: {
          include: {
            currentVersion: { include: { slateCallbackConfig: true } }
          }
        }
      }
    });
    let previousVersion =
      existing.callbackConfig?.status === 'active'
        ? existing.callbackConfig.currentVersion
        : null;
    let backend = await getBackend({ entity: context.providerVariant });
    let created = previousVersion
      ? await backend.callbackConfig.createNextCallbackConfig({
          tenant: d.tenant,
          provider: context.provider,
          providerVariant: context.providerVariant,
          deployment: context.deployment,
          triggerIds,
          previousBacking: {
            slateCallbackConfigOid: previousVersion.slateCallbackConfigOid
          },
          valuesPatch: d.valuesPatch
        })
      : await backend.callbackConfig.createCallbackConfig({
          tenant: d.tenant,
          provider: context.provider,
          providerVariant: context.providerVariant,
          deployment: context.deployment,
          triggerIds,
          values: d.valuesPatch
        });
    if (!created.slateCallbackConfig) {
      throw new Error('Callback config backend did not return a backing resource');
    }

    let callbackConfig = existing.callbackConfig;
    if (!callbackConfig) {
      let createdCallbackConfig = await d.db.callbackConfig.create({
        data: {
          ...getId('callbackConfig'),
          status: 'active',
          tenantOid: d.tenant.oid,
          projectOid: d.tenant.projectOid,
          solutionOid: existing.solutionOid,
          environmentOid: existing.environmentOid,
          instanceOid: existing.instanceOid
        }
      });
      callbackConfig = { ...createdCallbackConfig, currentVersion: null };
    }

    let nextVersion = await d.db.callbackConfigVersion.create({
      data: {
        ...getId('callbackConfigVersion'),
        callbackConfigOid: callbackConfig.oid,
        backendOid: context.providerVariant.backendOid,
        slateCallbackConfigOid: created.slateCallbackConfig.oid,
        configuredKeys: created.configuredKeys
      }
    });
    let update = await d.db.callbackConfigUpdate.create({
      data: {
        ...getId('callbackConfigUpdate'),
        callbackConfigOid: callbackConfig.oid,
        fromVersionOid: previousVersion?.oid,
        toVersionOid: nextVersion.oid
      }
    });
    await d.db.slateCallbackConfig.update({
      where: { oid: created.slateCallbackConfig.oid },
      data: { callbackConfigUpdateOid: update.oid }
    });
    await d.db.callbackConfig.update({
      where: { oid: callbackConfig.oid },
      data: {
        status: 'active',
        archivedAt: null,
        currentVersionOid: nextVersion.oid
      }
    });
    if (!existing.callbackConfigOid) {
      await d.db.callback.update({
        where: { oid: existing.oid },
        data: { callbackConfigOid: callbackConfig.oid }
      });
    }

    return {
      callbackConfigId: callbackConfig.id,
      callbackConfigVersionId: nextVersion.id,
      supersededCallbackConfigVersionId: previousVersion?.id ?? null,
      configuredKeys: nextVersion.configuredKeys
    };
  }

  async clearCallbackConfigInternal(d: {
    tenant: Tenant;
    callback: Callback;
    db: CallbackConfigDb;
  }) {
    if (d.callback.tenantOid !== d.tenant.oid || !d.callback.callbackConfigOid) {
      return { supersededCallbackConfigVersionId: null };
    }
    let callbackConfig = await d.db.callbackConfig.findFirst({
      where: {
        oid: d.callback.callbackConfigOid,
        tenantOid: d.tenant.oid
      },
      include: { currentVersion: true }
    });
    if (!callbackConfig) return { supersededCallbackConfigVersionId: null };

    await d.db.callbackConfig.update({
      where: { oid: callbackConfig.oid },
      data: {
        status: 'archived',
        archivedAt: new Date(),
        currentVersionOid: null
      }
    });
    return {
      supersededCallbackConfigVersionId: callbackConfig.currentVersion?.id ?? null
    };
  }

  async getCallbackConfigInternal(d: { callback: Callback }) {
    if (!d.callback.callbackConfigOid) return null;
    let config = await db.callbackConfig.findUnique({
      where: { oid: d.callback.callbackConfigOid },
      include: { currentVersion: true }
    });
    if (!config || config.status !== 'active' || !config.currentVersion) return null;
    return {
      id: config.id,
      configuredKeys: config.currentVersion.configuredKeys,
      createdAt: config.createdAt
    };
  }
}

export let callbackConfigService = Service.create(
  'callbackConfigService',
  () => new callbackConfigServiceImpl()
).build();
