import { combineQueueProcessors } from '@lowerdeck/queue';
import {
  reconcileSkillProviderLinksForIntegrationProviderQueueProcessor,
  reconcileSkillProviderLinksQueueProcessor
} from './reconcileSkillProviderLink';

export let reconcilerQueues = combineQueueProcessors([
  reconcileSkillProviderLinksQueueProcessor,
  reconcileSkillProviderLinksForIntegrationProviderQueueProcessor
]);
