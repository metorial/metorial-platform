import type { NormalizedRecord } from '@mtsrc/agent-tracking-spec';
import type { PipelineContext, PipelineStage } from './types';

export let runBeforeWrite = async (
  stages: PipelineStage[],
  context: PipelineContext,
  records: NormalizedRecord[]
) => {
  for (let stage of stages) {
    if (stage.beforeWrite) await stage.beforeWrite(context, records);
  }
};

export let runAfterWrite = async (
  stages: PipelineStage[],
  context: PipelineContext,
  records: NormalizedRecord[]
) => {
  for (let stage of stages) {
    if (!stage.afterWrite) continue;

    try {
      await stage.afterWrite(context, records);
    } catch (error) {
      console.error(`[agent-tracking] pipeline stage ${stage.name} failed after write`, error);
    }
  }
};
