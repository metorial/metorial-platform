import type {
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
    providers: (SessionTemplateProvider & {
      provider: Provider;
      deployment: ProviderDeployment;
      config: ProviderConfig;
      authConfig: ProviderAuthConfig | null;
    })[];
  }
) => ({
  object: 'session.template',

  id: sessionTemplate.id,

  name: sessionTemplate.name,
  description: sessionTemplate.description,
  metadata: sessionTemplate.metadata,

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
