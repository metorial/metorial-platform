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
import { sessionProviderPresenter } from './sessionProvider';

export let sessionPresenter = (
  session: Session & {
    providers: (SessionProvider & {
      provider: Provider;
      deployment: ProviderDeployment;
      config: ProviderConfig;
      authConfig: ProviderAuthConfig | null;
      fromTemplate: SessionTemplate | null;
      fromTemplateProvider: SessionTemplateProvider | null;
    })[];
  }
) => ({
  object: 'session',

  id: session.id,

  name: session.name,
  description: session.description,
  metadata: session.metadata,

  connectionState: session.connectionState,

  hasErrors: session.hasErrors,
  hasWarnings: session.hasWarnings,

  usage: {
    totalProductiveClientMessageCount: session.totalProductiveClientMessageCount,
    totalProductiveProviderMessageCount: session.totalProductiveProviderMessageCount
  },

  providers: session.providers
    .filter(p => p.status === 'active')
    .map(p =>
      sessionProviderPresenter({
        ...p,
        session
      })
    ),

  fromTemplatesIds: [
    ...new Set(session.providers.map(p => p.fromTemplate?.id!).filter(Boolean))
  ],

  createdAt: session.createdAt,
  updatedAt: session.updatedAt
});
