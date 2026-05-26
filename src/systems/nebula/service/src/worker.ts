import { runQueueProcessors } from '@lowerdeck/queue';
import { cleanupSecretUseProcessors } from './queues/cleanupSecretUse';
import { purgeDisabledSecretsProcessors } from './queues/purgeDisabledSecrets';

await runQueueProcessors([cleanupSecretUseProcessors, purgeDisabledSecretsProcessors]);
