import { combineQueueProcessors } from '@metorial/queue';
import { cloneBucketQueueProcessor } from './queue/cloneBucket';
import { copyFromToBucketQueueProcessor } from './queue/copyFromToBucket';
import { exportGithubQueueProcessor } from './queue/exportGithub';
import { importGithubQueueProcessor } from './queue/importGithub';
import { importTemplateQueueProcessor } from './queue/importTemplate';

export * from './services';

export let codeBucketQueueProcessor = combineQueueProcessors([
  cloneBucketQueueProcessor,
  importGithubQueueProcessor,
  exportGithubQueueProcessor,
  importTemplateQueueProcessor,
  copyFromToBucketQueueProcessor
]);
