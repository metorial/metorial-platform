import type { PipelineStage } from './types';

let factory: () => PipelineStage[] = () => [];

export let configureIngestStages = (create: () => PipelineStage[]) => {
  factory = create;
};

export let createDefaultStages = () => factory();
