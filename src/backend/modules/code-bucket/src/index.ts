import { combineQueueProcessors } from '@metorial/queue';
import { exportGithubQueueProcessor } from './queue/exportGithub';
import { importGithubQueueProcessor } from './queue/importGithub';

export * from './services';

export let codeBucketQueueProcessor = combineQueueProcessors([
  importGithubQueueProcessor,
  exportGithubQueueProcessor
]);
