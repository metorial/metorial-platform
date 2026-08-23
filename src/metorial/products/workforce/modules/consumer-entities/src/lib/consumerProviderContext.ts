import { preconditionFailedError, ServiceError } from '@lowerdeck/error';
import { type Instance, type ProviderTemplate } from '@metorial/db';
import { type AnyAccessTagSelector } from '@metorial/module-access';
import { providerTemplateService } from '@metorial/module-magic';
import { providerTemplateBackingService } from '@metorial-subspace/module-integration';
import { type Prisma as SubspacePrisma } from '@metorial-subspace/db';
import {
  providerAuthMethodService,
  providerService,
  providerVersionService
} from '@metorial-subspace/module-catalog';
import {
  providerConfigService,
  providerDeploymentService
} from '@metorial-subspace/module-deployment';

export type ConsumerProviderDeployment = SubspacePrisma.ProviderDeploymentGetPayload<{
  include: {
    provider: true;
    defaultConfig: true;
    providerVariant: true;
    enclave: { select: { id: true } };
    currentVersion: {
      include: {
        lockedVersion: {
          include: { specification: true };
        };
      };
    };
  };
}>;

export type ConsumerProviderTemplateBacking = Awaited<
  ReturnType<typeof providerTemplateBackingService.getProviderTemplateBackingById>
>;

export type ConsumerProvider = Awaited<ReturnType<typeof providerService.getProviderById>>;

export type ConsumerProviderConfigSchema = SubspacePrisma.ProviderSpecificationGetPayload<{
  include: { provider: true };
}>;

export type ConsumerProviderAuthMethodList = Awaited<
  ReturnType<
    Awaited<ReturnType<typeof providerAuthMethodService.listProviderAuthMethods>>['run']
  >
>['items'];

export type ConsumerProviderTemplateContext = {
  providerTemplate: ProviderTemplate;
  deployment: ConsumerProviderDeployment;
  provider: ConsumerProvider;
  authMethods: ConsumerProviderAuthMethodList;
  configSchema: ConsumerProviderConfigSchema | null;
};

let requireProviderCurrentVersion = <T extends { id: string; currentVersion: object | null }>(
  provider: T
): NonNullable<T['currentVersion']> => {
  if (!provider.currentVersion) {
    throw new Error(
      `Integration provider "${provider.id}" has no current version for its provider template.`
    );
  }

  return provider.currentVersion;
};

let getProviderVersionIdForAuthMethods = (d: {
  deployment: ConsumerProviderDeployment;
  provider: ConsumerProvider;
}) => {
  if (d.deployment.currentVersion?.lockedVersion?.id) {
    return d.deployment.currentVersion.lockedVersion.id;
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
  let backing = await providerTemplateBackingService.getProviderTemplateBackingById({
    instance: d.instance,
    providerTemplateBackingId: providerTemplate.id
  });
  let primaryProvider = backing.integration.providers[0];

  if (!primaryProvider) {
    throw new ServiceError(
      preconditionFailedError({
        message: 'This provider template does not have a provider yet.'
      })
    );
  }

  let deployment = await providerDeploymentService.getProviderDeploymentById({
    instance: d.instance,
    providerDeploymentId: requireProviderCurrentVersion(primaryProvider).deployment.id
  });
  let provider = await providerService.getProviderById({
    instance: d.instance,
    providerId: deployment.provider.id
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
    providerConfigService.getProviderConfigSchema({
      instance: d.instance,
      providerDeployment: context.deployment
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

  let providerVersion = await providerVersionService.getProviderVersionById({
    instance: d.instance,
    providerVersionId: d.providerVersionId
  });
  let paginator = await providerAuthMethodService.listProviderAuthMethods({
    instance: d.instance,
    providerVersion
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
