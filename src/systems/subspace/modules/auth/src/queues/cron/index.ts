import { combineQueueProcessors } from '@lowerdeck/queue';
import { expireOAuthSetupCron } from './expireOAuthSetup';

export let cronQueues = combineQueueProcessors([expireOAuthSetupCron]);
