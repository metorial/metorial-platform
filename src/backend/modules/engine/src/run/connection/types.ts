import { Instance, Organization, ServerDeployment, ServerSession } from '@metorial/db';
import { InitializeRequest } from '@metorial/mcp-utils';

export type McpClient = InitializeRequest['params'];

export interface EngineRunConfig {
  serverSession: ServerSession & {
    serverDeployment: ServerDeployment;
  };
  instance: Instance & {
    organization: Organization;
  };
}
