import { combineQueueProcessors } from '@mtsrc/queue';
import {
  reconcileSkillProviderLinksForIntegrationProviderQueueProcessor,
  reconcileSkillProviderLinksQueueProcessor
} from './reconcileSkillProviderLink';

export let reconcilerQueues = combineQueueProcessors([
  reconcileSkillProviderLinksQueueProcessor,
  reconcileSkillProviderLinksForIntegrationProviderQueueProcessor
]);
