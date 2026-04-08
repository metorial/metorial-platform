import { type Instance, type ProviderTemplate } from '@metorial/db';
import { type AnyAccessTagSelector } from '@metorial/module-access';
import {
  subspaceProviderAuthMethodService,
  subspaceProviderConfigService,
  subspaceProviderDeploymentService,
  subspaceProviderService
} from '@metorial/module-subspace';
import { providerTemplateService } from './providerTemplate';

export type ConsumerProviderDeployment = Awaited<
  ReturnType<typeof subspaceProviderDeploymentService.get>
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

  let currentVersion = (d.deployment as any).currentVersion as
    | {
        lockedVersionId?: string | null;
        providerVersionId?: string | null;
      }
    | null
    | undefined;

  if (currentVersion?.lockedVersionId) {
    return currentVersion.lockedVersionId;
  }
  if (currentVersion?.providerVersionId) {
    return currentVersion.providerVersionId;
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

  let deployment = await subspaceProviderDeploymentService.get({
    instance: d.instance,
    providerDeploymentId: providerTemplate.providerDeploymentId
  });
  let provider = await subspaceProviderService.get({
    instance: d.instance,
    providerId: deployment.providerId
  });

  return {
    providerTemplate,
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
