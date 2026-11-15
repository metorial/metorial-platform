import { runQueueProcessors } from '@lowerdeck/queue';
import { cleanupSecretUseProcessors } from './queues/cleanupSecretUse';
import { purgeDisabledSecretsProcessors } from './queues/purgeDisabledSecrets';
import {
  reconcileSecretPurposeProcessors,
  startSecretPurposeReconciliation
} from './queues/reconcileSecretPurpose';

await startSecretPurposeReconciliation();
await runQueueProcessors([
  cleanupSecretUseProcessors,
  purgeDisabledSecretsProcessors,
  reconcileSecretPurposeProcessors
]);
