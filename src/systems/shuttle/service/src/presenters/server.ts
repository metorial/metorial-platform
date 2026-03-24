import type {
  ContainerRegistry,
  ContainerRepository,
  ContainerRepositoryTag,
  ContainerRepositoryVersion,
  DelegatedOAuthConfig,
  RemoteOAuthConfig,
  Server,
  ServerVersion,
  Tenant
} from '../../prisma/generated/client';
import { containerRepositoryTagPresenter } from './containerRepositoryTag';
import { oauthConfigPresenter } from './oauthConfig';

export let serverPresenter = (
  server: Server & {
    draftRepositoryTag:
      | (ContainerRepositoryTag & {
          tenant: Tenant | null;
          currentVersion: ContainerRepositoryVersion | null;
          repository: ContainerRepository & {
            registry: ContainerRegistry;
          };
        })
      | null;

    currentVersion: ServerVersion | null;
    remoteOauthConfig: RemoteOAuthConfig | null;
    delegatedOauthConfig: DelegatedOAuthConfig | null;

    tenant: Tenant | null;
  }
) => ({
  object: 'shuttle#server',

  id: server.id,
  type: server.type,
  name: server.name,
  description: server.description,
  metadata: server.metadata ?? {},

  currentVersionId: server.currentVersion?.id ?? null,

  draft: {
    repositoryTag: server.draftRepositoryTag
      ? containerRepositoryTagPresenter(server.draftRepositoryTag)
      : null,

    configSchema: server.draftConfigSchema,
    configTransformer: server.draftConfigTransformer,

    remoteUrl: server.draftRemoteUrl,
    remoteProtocol: server.draftRemoteProtocol,

    createdAt: server.updatedAt
  },

  oauthConfig: oauthConfigPresenter(server),

  tenantId: server.tenant?.id,

  createdAt: server.createdAt,
  updatedAt: server.updatedAt
});
