import { randomBytes } from 'node:crypto';
import { Service } from '@lowerdeck/service';
import { Prisma, type Secret, type Tenant } from '../../prisma/generated/client';
import { db } from '../db';
import { getId } from '../id';
import { secretService } from './secret';
import { slateTriggerReceiverPathSecretMethods } from './slateTriggerReceiverPathSecret';

type HubDbClient = typeof db | Prisma.TransactionClient;

let isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

let nestedValue = (value: unknown, key: string) => {
  if (!isRecord(value)) return undefined;
  return key.split('.').reduce<unknown>(
    (current, part) => (isRecord(current) ? current[part] : undefined),
    value
  );
};

let triggerWithSecurityContext = async (
  receiverTriggerId: string,
  store: HubDbClient = db
) =>
  await store.slateTriggerReceiverTrigger.findUniqueOrThrow({
    where: { id: receiverTriggerId },
    include: {
      action: true,
      receiver: {
        include: {
          tenant: true,
          slateInstance: true,
          authConfig: {
            include: {
              secret: true,
              authMethod: true,
              oauthCredentials: { include: { secret: true } }
            }
          }
        }
      },
      boundSecrets: { include: { secret: true } },
      registrationDetailsSecret: true
    }
  });

let declaredSecretRef = (action: { spec: unknown }, name: string) => {
  let spec = action.spec as Record<string, any>;
  let refs = spec.invocation?.http?.ingress?.verification?.allowedSecretRefs;
  return Array.isArray(refs) ? refs.find(ref => ref?.name === name) : undefined;
};

let decryptBoundValue = async (d: {
  tenant: Tenant;
  secret: Secret;
  note: string;
}) =>
  (
    await secretService.DANGEROUSLY_decryptSecret({
      tenant: d.tenant,
      secret: d.secret,
      purpose: 'slate_callback_value',
      note: d.note
    })
  ).value;

let upsertCallbackValue = async (d: {
  receiverTriggerId: string;
  name: string;
  value: string;
  source: string;
  encoding?: string;
  specHash?: string;
  businessValidUntil?: Date | null;
  store?: HubDbClient;
}) => {
  let store = d.store ?? db;
  let trigger = await triggerWithSecurityContext(d.receiverTriggerId, store);
  let current = trigger.boundSecrets.find(secret => secret.name === d.name);
  if (current) {
    await secretService.DANGEROUSLY_updateSecret({
      tenant: trigger.receiver.tenant,
      secret: current.secret,
      purpose: 'slate_callback_value',
      secretData: { value: d.value },
      db: store
    });
    return await store.slateTriggerReceiverSecret.update({
      where: { oid: current.oid },
      data: {
        source: d.source,
        encoding: d.encoding ?? current.encoding,
        specHash: d.specHash ?? current.specHash,
        businessValidUntil: d.businessValidUntil ?? null
      },
      include: { secret: true }
    });
  }
  let secret = await secretService.createSecret({
    tenant: trigger.receiver.tenant,
    purpose: 'slate_callback_value',
    secretData: { value: d.value },
    db: store
  });
  return await store.slateTriggerReceiverSecret.create({
    data: {
      ...getId('secret'),
      tenantOid: trigger.receiver.tenantOid,
      slateInstanceOid: trigger.receiver.slateInstanceOid,
      receiverOid: trigger.receiverOid,
      receiverTriggerOid: trigger.oid,
      secretOid: secret.oid,
      specHash: d.specHash ?? String((trigger.action.spec as Record<string, any>).specHash ?? ''),
      source: d.source,
      name: d.name,
      encoding: d.encoding ?? 'utf8',
      businessValidUntil: d.businessValidUntil ?? null
    },
    include: { secret: true }
  });
};

let resolveDeclared = async (receiverTriggerId: string, name: string) => {
  let trigger = await triggerWithSecurityContext(receiverTriggerId);
  let reference = declaredSecretRef(trigger.action, name);
  if (!reference) return [];
  let value: string | undefined;
  let secretId: string | undefined;
  let validUntil: Date | null = null;

  if (reference.source === 'auth_config') {
    let authConfig = trigger.receiver.authConfig;
    if (!authConfig) throw new Error('credential_missing');
    if (reference.authMethods?.length && !reference.authMethods.includes(authConfig.authMethod.key)) {
      throw new Error('credential_invalid');
    }
    let auth = await secretService.DANGEROUSLY_decryptSecret({
      tenant: trigger.receiver.tenant,
      secret: authConfig.secret,
      purpose: 'slate_authentication_configuration',
      note: `Resolve callback auth value ${name} for ${receiverTriggerId}`
    });
    let resolved = nestedValue(auth.output ?? auth.input, reference.credentialKey);
    if (typeof resolved !== 'string' || !resolved) throw new Error('credential_missing');
    value = resolved;
    secretId = authConfig.secret.id;
  } else if (reference.source === 'oauth_credentials') {
    let oauth = trigger.receiver.authConfig?.oauthCredentials;
    if (!oauth) throw new Error('credential_missing');
    let credentials = await secretService.DANGEROUSLY_decryptSecret({
      tenant: trigger.receiver.tenant,
      secret: oauth.secret,
      purpose: 'slate_oauth_credentials',
      note: `Resolve callback OAuth value ${name} for ${receiverTriggerId}`
    });
    let resolved = nestedValue(credentials, reference.credentialKey);
    if (typeof resolved !== 'string' || !resolved) throw new Error('credential_missing');
    value = resolved;
    secretId = oauth.secret.id;
  } else {
    let binding = trigger.boundSecrets.find(secret => secret.name === name);
    if (!binding && reference.source === 'generated') {
      binding = await upsertCallbackValue({
        receiverTriggerId,
        name,
        value: randomBytes(32).toString('base64url'),
        source: 'generated',
        encoding: reference.encoding
      });
    }
    if (!binding) throw new Error('credential_missing');
    if (binding.businessValidUntil && binding.businessValidUntil <= new Date()) return [];
    value = await decryptBoundValue({
      tenant: trigger.receiver.tenant,
      secret: binding.secret,
      note: `Resolve callback value ${name} for ${receiverTriggerId}`
    });
    secretId = binding.secret.id;
    validUntil = binding.businessValidUntil;
  }

  return [
    {
      id: secretId!,
      name,
      value,
      encoding: reference.encoding ?? 'utf8',
      status: 'active' as const,
      validUntil
    }
  ];
};

let persistCapturedSecrets = async (d: {
  receiverTriggerId: string;
  capturedSecrets?: Record<string, string>;
  source?: string;
  registrationDetails?: unknown;
  store?: HubDbClient;
}) => {
  for (let [name, value] of Object.entries(d.capturedSecrets ?? {})) {
    if (typeof value !== 'string' || !value) throw new Error('invalid_provider_result');
    let trigger = await triggerWithSecurityContext(d.receiverTriggerId, d.store);
    let reference = declaredSecretRef(trigger.action, name);
    if (!reference || !['registration', 'callback_secret', 'generated'].includes(reference.source)) {
      throw new Error('invalid_provider_result');
    }
    let businessValidUntil: Date | null = null;
    if (name === 'graph_retiring_client_state' && isRecord(d.registrationDetails)) {
      let raw = d.registrationDetails.retiringValidUntil;
      let time = typeof raw === 'number' ? raw : Date.parse(String(raw ?? ''));
      if (Number.isFinite(time)) businessValidUntil = new Date(time);
    }
    await upsertCallbackValue({
      receiverTriggerId: d.receiverTriggerId,
      name,
      value,
      source: d.source ?? reference.source,
      encoding: reference.encoding,
      businessValidUntil,
      store: d.store
    });
  }
};

export let persistCapturedCallbackSecretsInTransaction = async (d: {
  tx: Prisma.TransactionClient;
  receiverTriggerId: string;
  capturedSecrets: Readonly<Record<string, string>>;
}) =>
  await persistCapturedSecrets({
    receiverTriggerId: d.receiverTriggerId,
    capturedSecrets: { ...d.capturedSecrets },
    source: 'callback_secret',
    store: d.tx
  });

let writeRegistrationDetails = async (d: {
  receiverTriggerId: string;
  details: unknown;
}) => {
  let trigger = await triggerWithSecurityContext(d.receiverTriggerId);
  if (trigger.registrationDetailsSecret) {
    await secretService.DANGEROUSLY_updateSecret({
      tenant: trigger.receiver.tenant,
      secret: trigger.registrationDetailsSecret,
      purpose: 'slate_callback_registration',
      secretData: { details: d.details ?? null }
    });
    return trigger.registrationDetailsSecret;
  }
  let secret = await secretService.createSecret({
    tenant: trigger.receiver.tenant,
    purpose: 'slate_callback_registration',
    secretData: { details: d.details ?? null }
  });
  await db.slateTriggerReceiverTrigger.update({
    where: { oid: trigger.oid },
    data: { registrationDetailsSecretOid: secret.oid }
  });
  return secret;
};

let implementation = {
  ...slateTriggerReceiverPathSecretMethods,

  async resolveDeclaredTriggerSecretsForVerification(d: {
    receiverTriggerId: string;
    name: string;
  }) {
    return await resolveDeclared(d.receiverTriggerId, d.name);
  },

  async resolveRegistrationDetails(d: { receiverTriggerId: string }) {
    let trigger = await triggerWithSecurityContext(d.receiverTriggerId);
    if (!trigger.registrationDetailsSecret) return null;
    return (
      await secretService.DANGEROUSLY_decryptSecret({
        tenant: trigger.receiver.tenant,
        secret: trigger.registrationDetailsSecret,
        purpose: 'slate_callback_registration',
        note: `Resolve callback registration details for ${d.receiverTriggerId}`
      })
    ).details;
  },

  async commitRegistrationResult(d: any): Promise<'committed' | 'stale'> {
    let now = d.now ?? new Date();
    let owned = await db.slateTriggerReceiverTrigger.findFirst({
      where: {
        id: d.claim.receiverTriggerId,
        registrationGeneration: d.claim.registrationGeneration,
        registrationTransitionVersion: d.claim.registrationTransitionVersion,
        registrationStatus: d.claim.status,
        registrationLeaseToken: d.claim.registrationLeaseToken,
        registrationLeaseExpiresAt: { gt: now }
      }
    });
    if (!owned) return 'stale';
    await writeRegistrationDetails({
      receiverTriggerId: owned.id,
      details: d.registrationDetails ?? null
    });
    await persistCapturedSecrets({
      receiverTriggerId: owned.id,
      capturedSecrets: d.capturedSecrets,
      source: 'registration',
      registrationDetails: d.registrationDetails
    });
    let completed = await db.slateTriggerReceiverTrigger.updateMany({
      where: {
        oid: owned.oid,
        registrationGeneration: d.claim.registrationGeneration,
        registrationTransitionVersion: d.claim.registrationTransitionVersion,
        registrationStatus: d.claim.status,
        registrationLeaseToken: d.claim.registrationLeaseToken
      },
      data: {
        registrationStatus: 'registered',
        remoteRegistrationKnown: d.remoteRegistrationKnown,
        registrationLeaseToken: null,
        registrationLeaseExpiresAt: null,
        registrationEnqueueDeadlineAt: null,
        registrationErrorCode: null,
        registrationErrorMessage: null,
        registrationErrorMetadata: Prisma.DbNull,
        registrationErrorAt: null,
        ...(d.state !== undefined ? { state: d.state as Prisma.InputJsonValue } : {}),
        authoritativeStateVersion: { increment: 1 }
      }
    });
    return completed.count === 1 ? 'committed' : 'stale';
  },

  async persistRegistrationCapture(d: any) {
    await persistCapturedSecrets({
      receiverTriggerId: d.receiverTriggerId ?? d.authority?.receiverTrigger?.id,
      capturedSecrets: d.capturedSecrets,
      source: 'registration'
    });
    return 'committed' as const;
  },

  async compareAndSetBootstrapCapture(d: any) {
    await persistCapturedSecrets({
      receiverTriggerId: d.receiverTriggerId,
      capturedSecrets: d.capturedSecrets,
      source: 'registration'
    });
    return {
      status: 'committed' as const,
      committed: {
        response: d.output?.response ?? null,
        registrationVersion: d.authority?.registrationVersion ?? 1,
        replayClaim: d.output?.replayClaim
      }
    };
  },

  async cleanupRetiringRegistrationDetails(d: any) {
    let trigger = await db.slateTriggerReceiverTrigger.findFirst({
      where: {
        id: d.receiverTriggerId,
        registrationGeneration: d.registrationGeneration,
        registrationVersion: d.registrationVersion
      }
    });
    if (!trigger) return 'stale' as const;
    await writeRegistrationDetails({
      receiverTriggerId: trigger.id,
      details: d.registrationDetails
    });
    return 'committed' as const;
  },

  async revokeRegistrationSecrets(d: { receiverTriggerId: string }) {
    let trigger = await triggerWithSecurityContext(d.receiverTriggerId);
    for (let binding of trigger.boundSecrets) {
      await secretService.DANGEROUSLY_deleteSecret({
        tenant: trigger.receiver.tenant,
        secret: binding.secret
      });
    }
    await db.slateTriggerReceiverSecret.deleteMany({
      where: { receiverTriggerOid: trigger.oid }
    });
    if (trigger.registrationDetailsSecret) {
      await db.slateTriggerReceiverTrigger.update({
        where: { oid: trigger.oid },
        data: { registrationDetailsSecretOid: null }
      });
      await secretService.DANGEROUSLY_deleteSecret({
        tenant: trigger.receiver.tenant,
        secret: trigger.registrationDetailsSecret
      });
    }
  },

  async cleanupExpiredRegistrationSecrets(d: { now?: Date } = {}) {
    let now = d.now ?? new Date();
    let expired = await db.slateTriggerReceiverSecret.findMany({
      where: { businessValidUntil: { lte: now } },
      include: { secret: true, tenant: true }
    });
    for (let binding of expired) {
      await db.slateTriggerReceiverSecret.delete({ where: { oid: binding.oid } });
      await secretService.DANGEROUSLY_deleteSecret({
        tenant: binding.tenant,
        secret: binding.secret
      });
    }
    return { deletedCount: expired.length };
  }
};

export let slateTriggerReceiverSecretService = Service.create(
  'slateTriggerReceiverSecretService',
  () => implementation
).build();

export let slateTriggerReceiverBootstrapCaptureWriter = {
  persistRegistrationCapture: async (d: any) =>
    await slateTriggerReceiverSecretService.persistRegistrationCapture(d),
  compareAndSet: async (d: any) =>
    await slateTriggerReceiverSecretService.compareAndSetBootstrapCapture(d)
};
