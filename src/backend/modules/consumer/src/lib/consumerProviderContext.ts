import { preconditionFailedError, ServiceError } from '@mtsrc/error';
import { type Instance, type ProviderTemplate } from '@metorial/db';
import { type AnyAccessTagSelector } from '@metorial/module-access';
import { providerTemplateService } from '@metorial/module-magic';
import {
  subspaceMagicMcpBackingService,
  subspaceProviderAuthMethodService,
  subspaceProviderConfigService,
  subspaceProviderDeploymentService,
  subspaceProviderService
} from '@metorial/module-subspace';

export type ConsumerProviderDeployment = Awaited<
  ReturnType<typeof subspaceProviderDeploymentService.get>
>;

export type ConsumerProviderTemplateBacking = Awaited<
  ReturnType<typeof subspaceMagicMcpBackingService.getProviderTemplate>
>;

export type ConsumerProvider = Awaited<ReturnType<typeof subspaceProviderService.get>>;

export type ConsumerProviderConfigSchema = Awaited<
  ReturnType<typeof subspaceProviderConfigService.getConfigSchema>
>;

export type ConsumerProviderAuthMethodList = Awaited<
  ReturnType<Awaited<ReturnType<typeof subspaceProviderAuthMethodService.list>>['run']>
>['items'];

export type ConsumerProviderTemplateContext = {
  providerTemplate: ProviderTemplate;
  deployment: ConsumerProviderDeployment;
  provider: ConsumerProvider;
  authMethods: ConsumerProviderAuthMethodList;
  configSchema: ConsumerProviderConfigSchema | null;
};

let getProviderVersionIdForAuthMethods = (d: {
  deployment: ConsumerProviderDeployment;
  provider: ConsumerProvider;
}) => {
  if (d.deployment.lockedVersion?.id) {
    return d.deployment.lockedVersion.id;
  }

  return d.provider.defaultVariant?.currentVersion?.id ?? null;
};

let loadBaseTemplateContext = async (d: {
  instance: Instance;
  providerTemplateId: string;
  accessTags?: AnyAccessTagSelector;
}) => {
  let providerTemplate = await providerTemplateService.getProviderTemplateById({
    instance: d.instance,
    providerTemplateId: d.providerTemplateId,
    accessTags: d.accessTags
  });
  let backing = await subspaceMagicMcpBackingService.getProviderTemplate({
    instance: d.instance,
    providerTemplateBackingId: providerTemplate.id
  });
  let primaryProvider = backing.providers[0];

  if (!primaryProvider) {
    throw new ServiceError(
      preconditionFailedError({
        message: 'This provider template does not have a provider yet.'
      })
    );
  }

  let deployment = await subspaceProviderDeploymentService.get({
    instance: d.instance,
    providerDeploymentId: primaryProvider.deployment.id
  });
  let provider = await subspaceProviderService.get({
    instance: d.instance,
    providerId: deployment.providerId
  });

  return {
    providerTemplate,
    backing,
    deployment,
    provider
  };
};

export let loadTemplateContextForSetup = async (d: {
  instance: Instance;
  providerTemplateId: string;
  accessTags: AnyAccessTagSelector;
}): Promise<ConsumerProviderTemplateContext> => {
  let context = await loadBaseTemplateContext(d);
  let authMethods = await listProviderAuthMethods({
    instance: d.instance,
    providerVersionId: getProviderVersionIdForAuthMethods({
      deployment: context.deployment,
      provider: context.provider
    })
  });

  return {
    ...context,
    authMethods,
    configSchema: null
  };
};

export let loadTemplateContextForDeployment = async (d: {
  instance: Instance;
  providerTemplateId: string;
  accessTags: AnyAccessTagSelector;
}): Promise<ConsumerProviderTemplateContext> => {
  let context = await loadBaseTemplateContext(d);
  let providerVersionId = getProviderVersionIdForAuthMethods({
    deployment: context.deployment,
    provider: context.provider
  });
  let [authMethods, configSchema] = await Promise.all([
    listProviderAuthMethods({
      instance: d.instance,
      providerVersionId
    }),
    subspaceProviderConfigService.getConfigSchema({
      instance: d.instance,
      providerDeploymentId: context.deployment.id
    })
  ]);

  return {
    ...context,
    authMethods,
    configSchema
  };
};

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

export { getProviderVersionIdForAuthMethods };
