import type { PrismaClient } from '../../../prisma/generated/client';
import { TenantFixtures } from './tenantFixtures';
import { SecretFixtures } from './secretFixtures';
import { ContainerRegistryFixtures } from './containerRegistryFixtures';
import { ContainerRepositoryFixtures } from './containerRepositoryFixtures';
import { ContainerRepositoryTagFixtures } from './containerRepositoryTagFixtures';
import { ContainerRepositoryVersionFixtures } from './containerRepositoryVersionFixtures';
import { ServerFixtures } from './serverFixtures';
import { ServerVersionFixtures } from './serverVersionFixtures';
import { ServerConfigFixtures } from './serverConfigFixtures';
import { ServerDiscoveryFixtures } from './serverDiscoveryFixtures';
import { ServerConnectionFixtures } from './serverConnectionFixtures';
import { ChangeNotificationFixtures } from './changeNotificationFixtures';
import { ServerDeploymentFixtures } from './serverDeploymentFixtures';
import { ServerAuthConfigFixtures } from './serverAuthConfigFixtures';
import { ConnectionLogsBucketFixtures } from './connectionLogsBucketFixtures';

export function fixtures(db: PrismaClient) {
  return {
    tenant: TenantFixtures(db),
    secret: SecretFixtures(db),
    containerRegistry: ContainerRegistryFixtures(db),
    containerRepository: ContainerRepositoryFixtures(db),
    containerRepositoryTag: ContainerRepositoryTagFixtures(db),
    containerRepositoryVersion: ContainerRepositoryVersionFixtures(db),
    server: ServerFixtures(db),
    serverVersion: ServerVersionFixtures(db),
    serverConfig: ServerConfigFixtures(db),
    serverDiscovery: ServerDiscoveryFixtures(db),
    serverConnection: ServerConnectionFixtures(db),
    connectionLogsBucket: ConnectionLogsBucketFixtures(db),
    changeNotification: ChangeNotificationFixtures(db),
    serverDeployment: ServerDeploymentFixtures(db),
    serverAuthConfig: ServerAuthConfigFixtures(db)
  };
}

export {
  TenantFixtures,
  SecretFixtures,
  ContainerRegistryFixtures,
  ContainerRepositoryFixtures,
  ContainerRepositoryTagFixtures,
  ContainerRepositoryVersionFixtures,
  ServerFixtures,
  ServerVersionFixtures,
  ServerConfigFixtures,
  ServerDiscoveryFixtures,
  ServerConnectionFixtures,
  ChangeNotificationFixtures,
  ServerDeploymentFixtures,
  ServerAuthConfigFixtures,
  ConnectionLogsBucketFixtures
};
