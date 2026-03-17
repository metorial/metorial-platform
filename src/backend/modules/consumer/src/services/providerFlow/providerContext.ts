import { ServiceError, unauthorizedError } from '@lowerdeck/error';
import { db, type Instance } from '@metorial/db';
import { type AnyAccessTagSelector } from '@metorial/module-access';
import {
  subspaceProviderAuthMethodService,
  subspaceProviderConfigService,
  subspaceProviderSetupSessionService
} from '@metorial/module-subspace';
import { subspaceProviderDeploymentService, subspaceProviderService } from '@metorial/module-subspace';
import { providerTemplateService } from '../providerTemplate';
import {
  assertCompletedSetupSession,
} from './setupSessionValidation';
import { assertSetupSessionBindingMatchesConsumerProvider } from './setupSessionBinding';
import type {
  ConsumerProviderAuthMethodList,
  ConsumerProviderTemplateContext
} from './types';

export let listProviderAuthMethods = async (d: {
  instance: Instance;
  providerVersionId: string | null | undefined;
}): Promise<ConsumerProviderAuthMethodList> => {
  if (!d.providerVersionId) {
    return [];
  }

  let paginator = await subspaceProviderAuthMethodService.list({
    instance: d.instance,
    providerVersionId: d.providerVersionId
  });
  let list = await paginator.run({
    limit: 100
  });

  return list.items;
};

export let getDefaultOauthMethod = (authMethods: ConsumerProviderAuthMethodList) => {
  return authMethods.find(authMethod => authMethod.type == 'oauth') ?? null;
};

export let resolveConsumerProviderTemplateContext = async (d: {
  instance: Instance;
  accessTags: AnyAccessTagSelector;
  providerTemplateId: string;
  includeAuthMethods?: boolean;
  includeConfigSchema?: boolean;
}): Promise<ConsumerProviderTemplateContext> => {
  let providerTemplate = await providerTemplateService.getProviderTemplateById({
    instance: d.instance,
    providerTemplateId: d.providerTemplateId,
    accessTags: d.accessTags
  });

  let deployment = await subspaceProviderDeploymentService.get({
    instance: d.instance,
    providerDeploymentId: providerTemplate.providerDeploymentId
  });
  let provider = await subspaceProviderService.get({
    instance: d.instance,
    providerId: deployment.providerId
  });

  let [authMethods, configSchema] = await Promise.all([
    d.includeAuthMethods
      ? listProviderAuthMethods({
          instance: d.instance,
          providerVersionId: deployment.lockedVersion?.id
        })
      : Promise.resolve([] as ConsumerProviderAuthMethodList),
    d.includeConfigSchema
      ? subspaceProviderConfigService.getConfigSchema({
          instance: d.instance,
          providerDeploymentId: deployment.id
        })
      : Promise.resolve(null)
  ]);

  return {
    instance: d.instance,
    providerTemplate,
    deployment,
    provider,
    authMethods,
    configSchema
  };
};

export let getValidatedConsumerProviderSetupSession = async (d: {
  instance: Instance;
  providerSetupSessionId: string;
  consumerProfileId: string;
  providerTemplateId: string;
  providerId: string;
  providerDeploymentId: string;
  requireCompleted?: boolean;
}) => {
  let setupSession = await subspaceProviderSetupSessionService.get({
    instance: d.instance,
    providerSetupSessionId: d.providerSetupSessionId
  });
  let setupSessionBinding = await db.consumerProviderSetupSessionBinding.findUnique({
    where: {
      instanceOid_providerSetupSessionId: {
        instanceOid: d.instance.oid,
        providerSetupSessionId: d.providerSetupSessionId
      }
    }
  });

  if (d.requireCompleted) {
    assertCompletedSetupSession({
      setupSession
    });
  }

  if (!setupSessionBinding) {
    throw new ServiceError(
      unauthorizedError({
        message: 'The selected provider setup session does not belong to this consumer.'
      })
    );
  }

  assertSetupSessionBindingMatchesConsumerProvider({
    binding: setupSessionBinding,
    consumerProfileId: d.consumerProfileId,
    providerTemplateId: d.providerTemplateId,
    providerId: d.providerId,
    providerDeploymentId: d.providerDeploymentId
  });

  return setupSession;
};
