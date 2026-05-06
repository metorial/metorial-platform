import { combineQueueProcessors } from '@metorial/queue';
import { indexMagicMcpGroupSearchQueueProcessor } from './magicMcpGroup';
import { indexMagicMcpServerSearchQueueProcessor } from './magicMcpServer';
import { indexProviderTemplateSearchQueueProcessor } from './providerTemplate';

export * from './magicMcpGroup';
export * from './magicMcpServer';
export * from './providerTemplate';

export let magicSearchQueueProcessor = combineQueueProcessors([
  indexMagicMcpGroupSearchQueueProcessor,
  indexMagicMcpServerSearchQueueProcessor,
  indexProviderTemplateSearchQueueProcessor
]);
