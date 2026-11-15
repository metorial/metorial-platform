import { runQueueProcessors } from '@lowerdeck/queue';
import { relayEmailQueueProcessor } from '@mtsrc/auth-core-email';
import { accountQueueProcessor } from '@mtsrc/auth-core-module-account';
import { adminQueueProcessor } from '@mtsrc/auth-core-module-admin';
import { appQueueProcessor } from '@mtsrc/auth-core-module-app';
import { auditQueueProcessor } from '@mtsrc/auth-core-module-audit';
import { authenticationQueueProcessor } from '@mtsrc/auth-core-module-authentication';
import { sessionQueueProcessor } from '@mtsrc/auth-core-module-session';
import { ssoQueueProcessor } from '@mtsrc/auth-core-module-sso';
import { syncQueueProcessor } from '@mtsrc/auth-core-module-sync';
import { userQueueProcessor } from '@mtsrc/auth-core-module-user';

await runQueueProcessors([
  auditQueueProcessor,
  syncQueueProcessor,
  accountQueueProcessor,
  appQueueProcessor,
  adminQueueProcessor,
  userQueueProcessor,
  sessionQueueProcessor,
  authenticationQueueProcessor,
  ssoQueueProcessor,
  relayEmailQueueProcessor
]);
