import { combineQueueProcessors } from '@lowerdeck/queue';
import { cleanupCron } from './cron/cleanup';

export * from './services';

import './lib/ensureCategories';

export let catalogQueueProcessor = combineQueueProcessors([cleanupCron]);
