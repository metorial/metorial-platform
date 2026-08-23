import { combineQueueProcessors } from '@lowerdeck/queue';
import { cloneBucketQueueProcessor } from './cloneBucket';
import { copyFromToBucketQueueProcessor } from './copyFromToBucket';
import { exportBitbucketQueueProcessor } from './exportBitbucket';
import { exportGithubQueueProcessor } from './exportGithub';
import { exportGitlabQueueProcessor } from './exportGitlab';
import { importBitbucketQueueProcessor } from './importBitbucket';
import { importGithubQueueProcessor } from './importGithub';
import { importGitlabQueueProcessor } from './importGitlab';
import { importTemplateQueueProcessor } from './importTemplate';

export let codeBucketQueueProcessor = combineQueueProcessors([
  cloneBucketQueueProcessor,
  importGithubQueueProcessor,
  exportGithubQueueProcessor,
  importGitlabQueueProcessor,
  exportGitlabQueueProcessor,
  importBitbucketQueueProcessor,
  exportBitbucketQueueProcessor,
  importTemplateQueueProcessor,
  copyFromToBucketQueueProcessor
]);
