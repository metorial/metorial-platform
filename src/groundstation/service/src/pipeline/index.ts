import { createAttributionStage } from '../identity/stage';
import { createSessionStage } from '../sessions/stage';
import { isStoreConfigured } from '../store/connection';
import type { PipelineStage } from './types';

export let createDefaultStages = (): PipelineStage[] => [
  createAttributionStage(),
  ...(isStoreConfigured() ? [createSessionStage()] : [])
];

export * from './run';
export * from './types';
