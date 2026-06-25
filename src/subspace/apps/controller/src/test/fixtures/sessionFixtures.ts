import { sessionService } from '@metorial-subspace/module-session';
import type {
  Environment,
  ProviderDeployment,
  Session,
  Solution,
  Tenant
} from '@metorial-subspace/db';

export const SessionFixtures = () => {
  const withDeployment = async (opts: {
    tenant: Tenant;
    solution: Solution;
    environment: Environment;
    deployment: ProviderDeployment;
    name?: string;
  }): Promise<Session> => {
    return await sessionService.createSession({
      tenant: opts.tenant,
      solution: opts.solution,
      environment: opts.environment,
      input: {
        name: opts.name ?? 'Test Session',
        providers: [
          {
            deploymentId: opts.deployment.id
          }
        ]
      }
    });
  };

  return {
    withDeployment
  };
};
