import { Instance, ServerDeployment, ServerSession } from '@metorial/db';

export interface EngineRunConfig {
  serverSession: ServerSession & { instance: Instance; serverDeployment: ServerDeployment };
}

export class EngineSession {
  constructor(private readonly config: EngineRunConfig) {}
}
