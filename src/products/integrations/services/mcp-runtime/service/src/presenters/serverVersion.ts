import type {
  ContainerRegistry,
  ContainerRepository,
  ContainerRepositoryTag,
  ContainerRepositoryVersion,
  Server,
  ServerDeployment,
  ServerVersion,
  Tenant
} from '../../prisma/generated/client';
import { containerRepositoryTagPresenter } from './containerRepositoryTag';
import { containerRepositoryVersionPresenter } from './containerRepositoryVersion';

export let serverVersionPresenter = (
  serverVersion: ServerVersion & {
    repositoryTag:
      | (ContainerRepositoryTag & {
          tenant: Tenant | null;
          currentVersion: ContainerRepositoryVersion | null;
          repository: ContainerRepository & {
            registry: ContainerRegistry;
          };
        })
      | null;

    repositoryVersion:
      | (ContainerRepositoryVersion & {
          tenant: Tenant | null;
          repository: ContainerRepository & {
            registry: ContainerRegistry;
          };
        })
      | null;

    deployment: ServerDeployment;

    server: Server;
    tenant: Tenant | null;
  }
) => ({
  object: 'shuttle#server.version',

  id: serverVersion.id,
  type: serverVersion.server.type,

  isCurrent: serverVersion.isCurrent,

  repositoryTag: serverVersion.repositoryTag
    ? containerRepositoryTagPresenter(serverVersion.repositoryTag)
    : null,

  repositoryVersion: serverVersion.repositoryVersion
    ? containerRepositoryVersionPresenter(serverVersion.repositoryVersion)
    : null,

  configSchema: serverVersion.configSchema,
  configTransformer: serverVersion.configTransformer,

  // Legacy fields for compatibility
  remoteUrl: serverVersion.remoteUrl,
  remoteProtocol: serverVersion.originalRemoteProtocol ?? serverVersion.remoteProtocol,

  remote:
    serverVersion.remoteUrl && serverVersion.remoteProtocol
      ? {
          url: serverVersion.remoteUrl,
          protocol: serverVersion.originalRemoteProtocol ?? serverVersion.remoteProtocol,

          autoSwitch:
            serverVersion.remoteProtocolAutoSwitchStatus == 'succeeded'
              ? {
                  status: 'succeeded',
                  from: serverVersion.originalRemoteProtocol!,
                  to: serverVersion.remoteProtocol!
                }
              : null,

          remoteServerNeedsManualAuthentication:
            serverVersion.remoteServerNeedsManualAuthentication
        }
      : null,

  serverId: serverVersion.server.id,
  tenantId: serverVersion.tenant?.id,
  deploymentId: serverVersion.deployment.id,

  createdAt: serverVersion.createdAt,
  updatedAt: serverVersion.updatedAt
});
