import type {
  IntegrationInstance,
  IntegrationInstanceProvider,
  Provider,
  ProviderAuthConfig,
  ProviderConfig,
  ProviderDeployment,
  SessionTemplate,
  SessionTemplateProvider
} from '@metorial-subspace/db';
import { sessionTemplateProviderPresenter } from './sessionTemplateProvider';

export let sessionTemplatePresenter = (
  sessionTemplate: SessionTemplate & {
    integrationInstance: IntegrationInstance | null;
    providers: (SessionTemplateProvider & {
      integrationInstanceProvider: IntegrationInstanceProvider | null;
      provider: Provider;
      deployment: ProviderDeployment;
      config: ProviderConfig;
      authConfig: ProviderAuthConfig | null;
    })[];
  }
) => ({
  object: 'session.template',

  id: sessionTemplate.id,

  status: sessionTemplate.status,

  name: sessionTemplate.name,
  description: sessionTemplate.description,
  metadata: sessionTemplate.metadata,
  privateMetadata: sessionTemplate.privateMetadata,

  integrationInstanceId: sessionTemplate.integrationInstance?.id ?? null,

  providers: sessionTemplate.providers
    .filter(p => p.status === 'active')
    .map(p =>
      sessionTemplateProviderPresenter({
        ...p,
        sessionTemplate
      })
    ),

  createdAt: sessionTemplate.createdAt,
  updatedAt: sessionTemplate.updatedAt
});
