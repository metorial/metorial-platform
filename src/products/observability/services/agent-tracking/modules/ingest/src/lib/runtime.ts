import {
  createOrganizationKeyDeriver,
  type OrganizationKeyDeriver
} from '@mtsrc/agent-tracking-crypto';
import { env } from '../env';
import { createDefaultStages } from './stages';
import { type PipelineStage } from './types';

export type IngestRuntime = {
  keys: OrganizationKeyDeriver;
  clock: () => Date;
  stages: PipelineStage[];
};

let current: IngestRuntime | undefined;

export let createRuntime = (overrides: Partial<IngestRuntime> = {}): IngestRuntime => ({
  keys: overrides.keys ?? createOrganizationKeyDeriver(env.ingest.hashSecret),
  clock: overrides.clock ?? (() => new Date()),
  stages: overrides.stages ?? createDefaultStages()
});

export let getRuntime = (): IngestRuntime => (current ??= createRuntime());

export let setRuntime = (runtime: IngestRuntime | undefined) => {
  current = runtime;
};
