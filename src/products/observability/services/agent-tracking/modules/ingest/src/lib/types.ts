import type { NormalizedRecord, RecordLane } from '@mtsrc/agent-tracking-spec';
import type { IngestCall } from './call';

export type PipelineContext = {
  request: IngestCall;
  lane: RecordLane;
  observedAt: Date;
};

// beforeWrite stages run in order and may mutate the records; a failure fails the request so the
// client retries. afterWrite stages run after the records are durable; their failures are logged
// and left to the reconciler.
export type PipelineStage = {
  name: string;
  beforeWrite?: (context: PipelineContext, records: NormalizedRecord[]) => Promise<void>;
  afterWrite?: (context: PipelineContext, records: NormalizedRecord[]) => Promise<void>;
};
