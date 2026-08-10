import type {
  IntegrationInstanceGroup,
  IntegrationInstanceGroupProvider,
  IntegrationInstance,
  IntegrationInstanceProvider,
  Provider,
  ProviderAuthConfig,
  ProviderConfig,
  ProviderDeployment,
  SessionTemplate,
  SessionTemplateProvider
} from '@metorial-subspace/db';
import { providerDeploymentPreviewPresenter } from './deployment';
import { providerAuthConfigPreviewPresenter } from './providerAuthConfig';
import { providerConfigPreviewPresenter } from './providerConfig';

export let sessionTemplateProviderPresenter = (
  provider: SessionTemplateProvider & {
    integrationInstanceProvider: IntegrationInstanceProvider | null;
    integrationInstanceGroupProvider: IntegrationInstanceGroupProvider | null;
    provider: Provider;
    deployment: ProviderDeployment;
    config: ProviderConfig;
    authConfig: ProviderAuthConfig | null;
    sessionTemplate: SessionTemplate & {
      integrationInstance: IntegrationInstance | null;
      integrationInstanceGroup: IntegrationInstanceGroup | null;
    };
  }
) => ({
  object: 'session.template.provider',

  id: provider.id,
  status: provider.status,

  toolFilter: provider.toolFilter,

  providerId: provider.provider.id,
  sessionTemplateId: provider.sessionTemplate.id,
  integrationInstanceId: provider.sessionTemplate.integrationInstance?.id ?? null,
  integrationInstanceGroupId:
    provider.sessionTemplate.integrationInstanceGroup?.id ?? null,
  integrationInstanceProviderId: provider.integrationInstanceProvider?.id ?? null,
  integrationInstanceGroupProviderId:
    provider.integrationInstanceGroupProvider?.id ?? null,

  deployment: providerDeploymentPreviewPresenter({
    ...provider.deployment,
    provider: provider.provider
  }),

  config: providerConfigPreviewPresenter({
    ...provider.config,
    provider: provider.provider
  }),

  authConfig: provider.authConfig
    ? providerAuthConfigPreviewPresenter({
        ...provider.authConfig,
        provider: provider.provider
      })
    : null,

  createdAt: provider.createdAt,
  updatedAt: provider.updatedAt
});
