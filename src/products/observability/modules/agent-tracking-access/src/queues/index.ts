import { combineQueueProcessors } from '@metorial/queue';
import { revokeIngestSourcesQueueProcessor } from './revokeIngestSources';
import { revokeTokensQueueProcessor } from './revokeTokens';

export let agentTrackingAccessQueueProcessor = combineQueueProcessors([
  revokeTokensQueueProcessor,
  revokeIngestSourcesQueueProcessor
]);
