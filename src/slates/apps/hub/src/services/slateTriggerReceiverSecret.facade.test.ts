import { describe, expect, it, vi } from 'vitest';

vi.mock('../db', () => ({ db: {} }));

import * as facade from './slateTriggerReceiverSecret';
import * as schema from './slateInstanceConfigSecretSchema';
import * as audit from './slateTriggerSecretAudit';
import * as crypto from './slateTriggerSecretCrypto';
import * as routeAuthority from './slateTriggerProvisionedRouteAuthority';

describe('slate trigger receiver secret facade', () => {
  it('keeps the public service method contract stable', () => {
    expect(Object.keys(facade.slateTriggerReceiverSecretService).sort()).toEqual([
      'applyV2ConfigSecretPatchInTransaction',
      'cleanupExpiredPathSecrets',
      'cleanupExpiredRegistrationSecrets',
      'cleanupRetiringRegistrationDetails',
      'commitRegistrationResult',
      'compareAndSetBootstrapCapture',
      'consumeAppRouteReceipt',
      'consumePathReceipt',
      'createInitialPathSecret',
      'createOrRotateAppRouteSecret',
      'createOrRotateProvisionedTenantAppSecret',
      'dualWriteInstanceConfigSecretsInTransaction',
      'dualWriteRegistrationDetailsInTransaction',
      'generateDeclaredTriggerSecret',
      'getReceiverSecretAuditByCorrelation',
      'importDeclaredInstanceConfigSecret',
      'importDeclaredTriggerSecret',
      'materializeInstanceConfig',
      'materializeInstanceConfigRecordInTransaction',
      'persistRegistrationCapture',
      'projectInstanceConfigSecretsToReceiversInTransaction',
      'reencryptAppRouteSecret',
      'reencryptBoundVendorSecret',
      'reencryptDeclaredTriggerSecret',
      'reencryptInstanceConfigSecret',
      'reencryptPathSecret',
      'reencryptRegistrationDetails',
      'resolveAppRouteSecret',
      'resolveBoundVendorSecrets',
      'resolveDeclaredTriggerSecretMetadata',
      'resolveDeclaredTriggerSecretsForVerification',
      'resolveInstanceConfigSecret',
      'resolveInstanceConfigSecretRecordInTransaction',
      'resolvePathActiveAndRetiring',
      'resolveRegistrationDetails',
      'resolveRegistrationDetailsInTransaction',
      'revokeAllPathSecrets',
      'revokeAppRouteSecret',
      'revokeBoundVendorSecret',
      'revokeDeclaredTriggerSecret',
      'revokeInstanceConfigSecret',
      'revokePathSecret',
      'revokeProvisionedTenantAppSecret',
      'revokeRegistrationSecrets',
      'rotateImportedDeclaredTriggerSecret',
      'rotatePathSecret',
      'upsertInstanceConfigSecret'
    ]);

    for (let key of Object.keys(facade.slateTriggerReceiverSecretService)) {
      let descriptor = Object.getOwnPropertyDescriptor(
        facade.slateTriggerReceiverSecretService,
        key
      );
      expect(descriptor?.enumerable).toBe(true);
      expect(descriptor?.writable).toBe(true);
    }
  });

  it('re-exports compatibility values without changing identity', () => {
    expect(facade.WEBHOOK_SECRET_AAD_VERSION).toBe(crypto.WEBHOOK_SECRET_AAD_VERSION);
    expect(facade.WEBHOOK_SECRET_ENCRYPTION_KEY_VERSION).toBe(
      crypto.WEBHOOK_SECRET_ENCRYPTION_KEY_VERSION
    );
    expect(facade.WEBHOOK_SECRET_GRACE_MS).toBe(crypto.WEBHOOK_SECRET_GRACE_MS);
    expect(facade.RECEIVER_PATH_SECRET_GRACE_MS).toBe(
      crypto.RECEIVER_PATH_SECRET_GRACE_MS
    );
    expect(facade.SECRET_ISSUANCE_RECEIPT_TTL_MS).toBe(
      audit.SECRET_ISSUANCE_RECEIPT_TTL_MS
    );
    expect(facade.instanceConfigSecretMarker).toBe(schema.instanceConfigSecretMarker);
    expect(facade.resolveDeclaredInstanceConfigSecretPath).toBe(
      schema.resolveDeclaredInstanceConfigSecretPath
    );
    expect(facade.extractInstanceConfigSecretEntries).toBe(
      schema.extractInstanceConfigSecretEntries
    );
    expect(facade.prepareDeclaredInstanceConfigSecretImport).toBe(
      schema.prepareDeclaredInstanceConfigSecretImport
    );
    expect(facade.hubSecretMigrationMetrics).toBe(audit.hubSecretMigrationMetrics);
    expect(facade.SecretIssuanceReceiptDeniedError).toBe(
      audit.SecretIssuanceReceiptDeniedError
    );
    expect(facade.sanitizeWebhookSecretAuditMetadata).toBe(
      audit.sanitizeWebhookSecretAuditMetadata
    );
    expect(facade.sanitizeTrustedSecretActor).toBe(audit.sanitizeTrustedSecretActor);
    expect(facade.commitHubSecretReencryptionInTransaction).toBe(
      audit.commitHubSecretReencryptionInTransaction
    );
    expect(facade.webhookSecretContexts).toBe(crypto.webhookSecretContexts);
    expect(facade.configureSlateProvisionedRouteAuthorityResolver).toBe(
      routeAuthority.configureSlateProvisionedRouteAuthorityResolver
    );
    expect(Object.keys(facade.slateTriggerReceiverBootstrapCaptureWriter).sort()).toEqual([
      'compareAndSet',
      'persistRegistrationCapture'
    ]);
  });
});
