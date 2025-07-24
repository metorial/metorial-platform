import { Instance, Organization, ServerDeployment, ServerSession } from '@metorial/db';

export interface EngineRunConfig {
  serverSession: ServerSession & {
    serverDeployment: ServerDeployment;
  };
  instance: Instance & {
    organization: Organization;
  };
}
