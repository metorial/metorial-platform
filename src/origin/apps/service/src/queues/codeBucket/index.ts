import { combineQueueProcessors } from '@lowerdeck/queue';
import { cloneBucketQueueProcessor } from './cloneBucket';
import { copyFromToBucketQueueProcessor } from './copyFromToBucket';
import { exportGithubQueueProcessor } from './exportGithub';
import { exportGitlabQueueProcessor } from './exportGitlab';
import { importGithubQueueProcessor } from './importGithub';
import { importGitlabQueueProcessor } from './importGitlab';
import { importTemplateQueueProcessor } from './importTemplate';

export let codeBucketQueueProcessor = combineQueueProcessors([
  cloneBucketQueueProcessor,
  importGithubQueueProcessor,
  exportGithubQueueProcessor,
  importGitlabQueueProcessor,
  exportGitlabQueueProcessor,
  importTemplateQueueProcessor,
  copyFromToBucketQueueProcessor
]);
