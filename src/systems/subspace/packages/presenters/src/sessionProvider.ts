import type {
  Provider,
  ProviderAuthConfig,
  ProviderConfig,
  ProviderDeployment,
  Session,
  SessionProvider,
  SessionTemplate,
  SessionTemplateProvider
} from '@metorial-subspace/db';
import { providerDeploymentPreviewPresenter } from './deployment';
import { providerAuthConfigPreviewPresenter } from './providerAuthConfig';
import { providerConfigPreviewPresenter } from './providerConfig';

export let sessionProviderPresenter = (
  provider: SessionProvider & {
    provider: Provider;
    deployment: ProviderDeployment;
    config: ProviderConfig;
    authConfig: ProviderAuthConfig | null;
    session: Session;
    fromTemplate: SessionTemplate | null;
    fromTemplateProvider: SessionTemplateProvider | null;
  }
) => ({
  object: 'session.provider',

  id: provider.id,
  status: provider.status,

  usage: {
    totalProductiveClientMessageCount: provider.totalProductiveClientMessageCount,
    totalProductiveProviderMessageCount: provider.totalProductiveProviderMessageCount
  },

  toolFilter: provider.toolFilter,

  providerId: provider.provider.id,
  sessionId: provider.session.id,

  fromTemplateId: provider.fromTemplate?.id || null,
  fromTemplateProviderId: provider.fromTemplateProvider?.id || null,

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
