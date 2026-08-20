import { createHash } from 'node:crypto';
import type { SlateTriggerReceiverPathSecret } from '../../prisma/generated/client';
import { createHubVersionedEncryptionKeyring } from '../encryption';
import { env } from '../env';

export let WEBHOOK_SECRET_AAD_VERSION = 1;
export let WEBHOOK_SECRET_ENCRYPTION_KEY_VERSION = 1;
export let WEBHOOK_SECRET_GRACE_MS = 24 * 60 * 60 * 1000;
export let RECEIVER_PATH_SECRET_GRACE_MS = 60 * 60 * 1000;
export let getWebhookSecretEncryption = () => createHubVersionedEncryptionKeyring();
export let activeWebhookEncryptionVersions = () => ({
  encryptionKeyVersion:
    env.encryption.ENCRYPTION_ACTIVE_KEY_VERSION ?? WEBHOOK_SECRET_ENCRYPTION_KEY_VERSION,
  aadVersion: env.encryption.ENCRYPTION_ACTIVE_AAD_VERSION ?? WEBHOOK_SECRET_AAD_VERSION
});

type SecretStatus = 'active' | 'retiring' | 'revoked';
let closedContext = (kind: string, values: readonly (string | number | bigint)[]) =>
  ['metorial', 'slates', 'webhook-secret', kind, ...values.map(String)]
    .map(value => `${Buffer.byteLength(value, 'utf8')}:${value}`)
    .join('|');

let webhookAadGrammar = {
  1: (kind: string, values: readonly (string | number | bigint)[]) =>
    closedContext(`${kind}/v1`, values),
  2: (kind: string, values: readonly (string | number | bigint)[]) =>
    closedContext(`${kind}/v2`, ['aad-v2', ...values])
} satisfies Record<
  number,
  (kind: string, values: readonly (string | number | bigint)[]) => string
>;
let versionedWebhookContext = (
  aadVersion: number,
  kind: string,
  values: readonly (string | number | bigint)[]
) => {
  let grammar = webhookAadGrammar[aadVersion as keyof typeof webhookAadGrammar];
  if (!grammar) throw new Error(`Unsupported Hub webhook AAD grammar: ${aadVersion}`);
  return grammar(kind, values);
};

/**
 * Closed AAD v1 contexts. Callers never supply these identifiers: services derive them
 * from already-authorized rows and the persisted version tuple.
 *
 * path: tenant, instance, receiver, purpose, semantic version, key version, AAD version
 * trigger: tenant, instance, receiver, trigger, spec, source type/id, name/kind/encoding,
 *          semantic version, key version, AAD version
 * config: tenant, config, key, purpose, semantic version, key version, AAD version
 * app route: provisioned route, generation, vendor, credential owner, purpose,
 *            semantic version, key version, AAD version (no invented tenant)
 */
export let webhookSecretContexts = {
  receiverPath: (d: {
    tenantId: string;
    slateInstanceId: string;
    receiverId: string;
    secretVersion: number;
    encryptionKeyVersion: number;
    aadVersion: number;
  }) =>
    versionedWebhookContext(d.aadVersion, 'receiver-path', [
      d.tenantId,
      d.slateInstanceId,
      d.receiverId,
      'receiver_path',
      d.secretVersion,
      d.encryptionKeyVersion,
      d.aadVersion
    ]),
  trigger: (d: {
    tenantId: string;
    slateInstanceId: string;
    receiverId: string;
    receiverTriggerId: string;
    specHash: string;
    sourceBindingType: string;
    sourceBindingId: string;
    name: string;
    kind: string;
    encoding: string;
    secretVersion: number;
    encryptionKeyVersion: number;
    aadVersion: number;
  }) =>
    versionedWebhookContext(d.aadVersion, 'trigger', [
      d.tenantId,
      d.slateInstanceId,
      d.receiverId,
      d.receiverTriggerId,
      d.specHash,
      d.sourceBindingType,
      d.sourceBindingId,
      d.name,
      d.kind,
      d.encoding,
      d.secretVersion,
      d.encryptionKeyVersion,
      d.aadVersion
    ]),
  registration: (d: {
    tenantId: string;
    slateInstanceId: string;
    receiverId: string;
    receiverTriggerId: string;
    registrationGeneration: number;
    encryptionKeyVersion: number;
    aadVersion: number;
  }) =>
    versionedWebhookContext(d.aadVersion, 'registration-details', [
      d.tenantId,
      d.slateInstanceId,
      d.receiverId,
      d.receiverTriggerId,
      'registration_details',
      d.registrationGeneration,
      d.encryptionKeyVersion,
      d.aadVersion
    ]),
  config: (d: {
    tenantId: string;
    instanceConfigId: string;
    key: string;
    secretVersion: number;
    encryptionKeyVersion: number;
    aadVersion: number;
  }) =>
    versionedWebhookContext(d.aadVersion, 'config', [
      d.tenantId,
      d.instanceConfigId,
      d.key,
      'instance_config',
      d.secretVersion,
      d.encryptionKeyVersion,
      d.aadVersion
    ]),
  appRoute: (d: {
    provisionedRouteId: string;
    routeGeneration: number;
    vendor: string;
    credentialOwnerRef: string;
    purpose: 'app_route_path' | 'vendor_verification';
    secretVersion: number;
    encryptionKeyVersion: number;
    aadVersion: number;
  }) =>
    versionedWebhookContext(d.aadVersion, 'app-route', [
      d.provisionedRouteId,
      d.routeGeneration,
      d.vendor,
      d.credentialOwnerRef,
      d.purpose,
      d.secretVersion,
      d.encryptionKeyVersion,
      d.aadVersion
    ]),
  receipt: (d: { receiptId: string; secretClass: string; secretId: string }) =>
    closedContext('issuance-receipt/v1', [d.receiptId, d.secretClass, d.secretId])
};

export let sha256 = (value: string) => createHash('sha256').update(value).digest('hex');
let assertStatus: (status: string) => asserts status is SecretStatus = status => {
  if (!['active', 'retiring', 'revoked'].includes(status)) {
    throw new Error('Invalid webhook secret status');
  }
};
export let assertReadable = (
  secret: { status: string; validFrom: Date; validUntil: Date | null },
  now: Date
) => {
  assertStatus(secret.status);
  if (secret.status === 'revoked' || secret.validFrom > now)
    throw new Error('Secret is not active');
  if (secret.status === 'retiring' && (!secret.validUntil || secret.validUntil <= now)) {
    throw new Error('Secret grace period has expired');
  }
};

export let encryptPath = async (
  plaintext: string,
  d: {
    tenantId: string;
    slateInstanceId: string;
    receiverId: string;
    secretVersion: number;
    encryptionKeyVersion: number;
    aadVersion: number;
  }
) =>
  await getWebhookSecretEncryption().encrypt({
    entityId: webhookSecretContexts.receiverPath(d),
    secret: plaintext,
    encryptionKeyVersion: d.encryptionKeyVersion,
    aadVersion: d.aadVersion
  });

export let decryptPath = async (
  secret: SlateTriggerReceiverPathSecret,
  binding: { tenantId: string; slateInstanceId: string; receiverId: string }
) =>
  await getWebhookSecretEncryption().decrypt({
    entityId: webhookSecretContexts.receiverPath({
      ...binding,
      secretVersion: secret.secretVersion,
      encryptionKeyVersion: secret.encryptionKeyVersion,
      aadVersion: secret.aadVersion
    }),
    encrypted: secret.encryptedValue,
    encryptionKeyVersion: secret.encryptionKeyVersion,
    aadVersion: secret.aadVersion
  });
