import { runQueueProcessors } from '@lowerdeck/queue';
import { cleanupProcessor } from './queues/cleanup';
import { expireTokensProcessor } from './queues/expiresTokens';
import {
  syncNpmCronProcessor,
  syncNpmPackageQueueProcessor,
  syncNpmPackagesQueueProcessor,
  syncNpmVersionQueueProcessor
} from './queues/syncNpm';

await runQueueProcessors([
  expireTokensProcessor,
  cleanupProcessor,
  syncNpmCronProcessor,
  syncNpmPackagesQueueProcessor,
  syncNpmPackageQueueProcessor,
  syncNpmVersionQueueProcessor
]);
