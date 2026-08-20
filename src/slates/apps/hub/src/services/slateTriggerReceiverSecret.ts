import { Service } from '@lowerdeck/service';
import { slateInstanceConfigSecretMethods } from './slateInstanceConfigSecret';
import { slateTriggerAppRouteSecretMethods } from './slateTriggerAppRouteSecret';
import { slateTriggerReceiverDeclaredSecretMethods } from './slateTriggerReceiverDeclaredSecret';
import { slateTriggerReceiverPathSecretMethods } from './slateTriggerReceiverPathSecret';
import { slateTriggerReceiverProvisionedSecretMethods } from './slateTriggerReceiverProvisionedSecret';
import { slateTriggerReceiverRegistrationSecretMethods } from './slateTriggerReceiverRegistrationSecret';

export {
  extractInstanceConfigSecretEntries,
  instanceConfigSecretMarker,
  prepareDeclaredInstanceConfigSecretImport,
  resolveDeclaredInstanceConfigSecretPath
} from './slateInstanceConfigSecretSchema';
export {
  commitHubSecretReencryptionInTransaction,
  hubSecretMigrationMetrics,
  sanitizeTrustedSecretActor,
  sanitizeWebhookSecretAuditMetadata,
  SECRET_ISSUANCE_RECEIPT_TTL_MS,
  SecretIssuanceReceiptDeniedError,
  type TrustedSecretActor
} from './slateTriggerSecretAudit';
export {
  RECEIVER_PATH_SECRET_GRACE_MS,
  WEBHOOK_SECRET_AAD_VERSION,
  WEBHOOK_SECRET_ENCRYPTION_KEY_VERSION,
  WEBHOOK_SECRET_GRACE_MS,
  webhookSecretContexts
} from './slateTriggerSecretCrypto';
export {
  configureSlateProvisionedRouteAuthorityResolver,
  type SlateProvisionedRouteAuthorityResolver
} from './slateTriggerProvisionedRouteAuthority';

type SlateTriggerReceiverSecretImplementation =
  typeof slateTriggerReceiverProvisionedSecretMethods &
    typeof slateTriggerReceiverDeclaredSecretMethods &
    typeof slateTriggerReceiverRegistrationSecretMethods &
    typeof slateTriggerReceiverPathSecretMethods &
    typeof slateInstanceConfigSecretMethods &
    typeof slateTriggerAppRouteSecretMethods;

let slateTriggerReceiverSecretImplementation: SlateTriggerReceiverSecretImplementation = {
  ...slateTriggerReceiverProvisionedSecretMethods,
  ...slateTriggerReceiverDeclaredSecretMethods,
  ...slateTriggerReceiverRegistrationSecretMethods,
  ...slateTriggerReceiverPathSecretMethods,
  ...slateInstanceConfigSecretMethods,
  ...slateTriggerAppRouteSecretMethods
};

export let slateTriggerReceiverSecretService = Service.create(
  'slateTriggerReceiverSecretService',
  () => slateTriggerReceiverSecretImplementation
).build();

export let slateTriggerReceiverBootstrapCaptureWriter = {
  persistRegistrationCapture: async (
    d: Parameters<SlateTriggerReceiverSecretImplementation['persistRegistrationCapture']>[0]
  ) => await slateTriggerReceiverSecretService.persistRegistrationCapture(d),
  compareAndSet: async (
    d: Parameters<SlateTriggerReceiverSecretImplementation['compareAndSetBootstrapCapture']>[0]
  ) => await slateTriggerReceiverSecretService.compareAndSetBootstrapCapture(d)
};
