import type { PrismaClient } from '@metorial-subspace/db';
import { EnvironmentFixtures } from './environmentFixtures';
import { RemoteMcpProviderFixtures } from './remoteMcpProviderFixtures';
import { SessionFixtures } from './sessionFixtures';
import { SolutionFixtures } from './solutionFixtures';
import { TenantFixtures } from './tenantFixtures';

export function fixtures(db: PrismaClient) {
  return {
    solution: SolutionFixtures(db),
    tenant: TenantFixtures(db),
    environment: EnvironmentFixtures(db),
    remoteMcpProvider: RemoteMcpProviderFixtures(db),
    session: SessionFixtures()
  };
}

export { createMcpE2eContext } from './mcpE2eContextFixture';
