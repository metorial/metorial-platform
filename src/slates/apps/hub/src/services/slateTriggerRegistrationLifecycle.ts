import { internalServerError, ServiceError } from '@lowerdeck/error';
import { metrics } from '@lowerdeck/telemetry';
import { slatesWebhookHttp } from '@slates/proto';
import {
  Prisma,
  type SlateAction,
  type SlateTriggerRegistrationIntentKind,
  type SlateTriggerRegistrationStatus
} from '../../prisma/generated/client';
import { db } from '../db';
import { getId } from '../id';

export let REGISTRATION_ATTEMPT_LEASE_MS = 2 * 60 * 1000;
export let REGISTRATION_ENQUEUE_DEADLINE_MS = 30 * 1000;

export let registrationJobId = (d: {
  operation: SlateTriggerRegistrationIntentKind;
  receiverTriggerId: string;
  registrationGeneration: number;
}) => `${d.operation}:${d.receiverTriggerId}:${d.registrationGeneration}`;

let registrationMeter = metrics.getMeter('slates-hub-registration');
let invalidRegistrationJobCounter = registrationMeter.createCounter(
  'slates.webhook.registration.invalid_or_stale_jobs',
  { description: 'Registration jobs rejected before provider execution' }
);

export let registrationQueueMetrics = {
  invalidOrStaleJob(reason: string) {
    invalidRegistrationJobCounter.add(1, { reason });
  }
};

let SAFE_REGISTRATION_FAILURES = {
  provider_rejected: 'The provider rejected webhook registration.',
  provider_timeout: 'The provider registration request timed out.',
  provider_transport_error: 'The provider registration request could not be completed.',
  invalid_provider_result: 'The provider returned an invalid registration result.',
  registration_capability_unavailable:
    'The provider does not support the required secure registration capability.',
  cleanup_failed: 'The previous provider registration could not be removed.',
  registration_capture_conflict: 'The registration result was stale and was discarded.'
} as const;

export type SafeRegistrationFailureCode = keyof typeof SAFE_REGISTRATION_FAILURES;

export let safeRegistrationFailure = (
  error: unknown,
  fallback: SafeRegistrationFailureCode = 'provider_transport_error'
) => {
  let message = error instanceof Error ? error.message.toLowerCase() : '';
  let code: SafeRegistrationFailureCode = message.includes('timeout')
    ? 'provider_timeout'
    : message.includes('provider_rejected')
      ? 'provider_rejected'
      : message.includes('cleanup_failed')
        ? 'cleanup_failed'
        : message.includes('capability')
          ? 'registration_capability_unavailable'
          : message.includes('capture_conflict') || message.includes('stale_mutation')
            ? 'registration_capture_conflict'
            : message.includes('invalid') || message.includes('malformed')
              ? 'invalid_provider_result'
              : fallback;
  return { code, message: SAFE_REGISTRATION_FAILURES[code] };
};

export let registrationFailureError = (code: SafeRegistrationFailureCode) =>
  new ServiceError(
    internalServerError({
      code: `webhook_registration_${code}`,
      message: SAFE_REGISTRATION_FAILURES[code]
    })
  );

export let actionVerificationDeclaration = (action: SlateAction) => {
  let contract = action.spec as Record<string, any>;
  let specHash = contract.specHash;
  if (typeof specHash !== 'string' || !/^[a-f0-9]{64}$/.test(specHash)) {
    return {
      mechanism: 'path_secret_only' as const,
      specHash: null
    };
  }
  let parsed = slatesWebhookHttp.safeParse(contract.invocation?.http ?? {});
  let ingress = parsed.success ? parsed.data.ingress : undefined;
  if (!ingress) {
    return {
      mechanism: 'path_secret_only' as const,
      specHash
    };
  }
  return {
    mechanism: ingress.verification.mechanism,
    specHash
  };
};

export let initialVerificationPolicy = (d: {
  action: SlateAction;
  receiverTriggerId: string;
  registrationGeneration: number;
}) => {
  let declaration = actionVerificationDeclaration(d.action);
  return {
    verificationMechanism: declaration.mechanism,
    verificationSpecHash: declaration.specHash
  };
};

type HubTransaction = Prisma.TransactionClient;

export let recordRegistrationOutboxInTransaction = async (d: {
  tx: HubTransaction;
  receiverTriggerOid: bigint;
  receiverTriggerId: string;
  operation: SlateTriggerRegistrationIntentKind;
  registrationGeneration: number;
  configGeneration?: number;
  configSecretVersionBindings?: Readonly<Record<string, number>>;
}) => {
  let outbox = getId('slateTriggerRegistrationOutbox');
  return await d.tx.slateTriggerRegistrationOutbox.create({
    data: {
      ...outbox,
      receiverTriggerOid: d.receiverTriggerOid,
      operation: d.operation,
      registrationGeneration: d.registrationGeneration,
      configGeneration: d.configGeneration,
      configSecretVersionBindings: d.configSecretVersionBindings
        ? (d.configSecretVersionBindings as Prisma.InputJsonValue)
        : undefined,
      status: 'pending'
    }
  });
};

export let beginRegistrationIntentInTransaction = async (d: {
  tx: HubTransaction;
  receiverTriggerId: string;
  intent: SlateTriggerRegistrationIntentKind;
  now?: Date;
  tombstone?: boolean;
  configGeneration?: number;
  configSecretVersionBindings?: Readonly<Record<string, number>>;
}) => {
  let now = d.now ?? new Date();
  let current = await d.tx.slateTriggerReceiverTrigger.findUniqueOrThrow({
    where: { id: d.receiverTriggerId },
    select: {
      oid: true,
      registrationGeneration: true,
      registrationTransitionVersion: true
    }
  });
  let registrationGeneration = current.registrationGeneration + 1;
  let sourceStatus: SlateTriggerRegistrationStatus =
    d.intent === 'unregister' || d.intent === 'delete' ? 'unregistering' : 'pending';
  let updated = await d.tx.slateTriggerReceiverTrigger.updateMany({
    where: {
      oid: current.oid,
      registrationGeneration: current.registrationGeneration,
      registrationTransitionVersion: current.registrationTransitionVersion
    },
    data: {
      registrationGeneration,
      registrationTransitionVersion: 0,
      registrationIntentKind: d.intent,
      registrationStatus: sourceStatus,
      registrationLeaseToken: null,
      registrationLeaseExpiresAt: null,
      registrationEnqueueDeadlineAt: new Date(
        now.getTime() + REGISTRATION_ENQUEUE_DEADLINE_MS
      ),
      registrationErrorCode: null,
      registrationErrorMessage: null,
      registrationErrorMetadata: Prisma.DbNull,
      registrationErrorAt: null,
      ...(d.tombstone ? { tombstonedAt: now, ingressDisabledAt: now } : {}),
      authoritativeStateVersion: { increment: 1 }
    }
  });
  if (updated.count !== 1) throw new Error('Registration intent CAS conflict');
  let outbox = await recordRegistrationOutboxInTransaction({
    tx: d.tx,
    receiverTriggerOid: current.oid,
    receiverTriggerId: d.receiverTriggerId,
    operation: d.intent,
    registrationGeneration,
    configGeneration: d.configGeneration,
    configSecretVersionBindings: d.configSecretVersionBindings
  });
  return {
    receiverTriggerId: d.receiverTriggerId,
    registrationGeneration,
    intent: d.intent,
    outboxId: outbox.id
  };
};

export type RegistrationAttemptClaim = {
  receiverTriggerId: string;
  registrationGeneration: number;
  registrationTransitionVersion: number;
  registrationLeaseToken: string;
  registrationLeaseExpiresAt: Date;
  intent: SlateTriggerRegistrationIntentKind;
  status: 'registering' | 'renewing' | 'unregistering';
};

class SlateTriggerRegistrationLifecycleServiceImpl {
  async claim(d: {
    receiverTriggerId: string;
    registrationGeneration: number;
    operation: 'register' | 'unregister';
    now?: Date;
  }): Promise<RegistrationAttemptClaim | null> {
    let now = d.now ?? new Date();
    if (
      !d.receiverTriggerId ||
      !Number.isInteger(d.registrationGeneration) ||
      d.registrationGeneration <= 0
    ) {
      registrationQueueMetrics.invalidOrStaleJob('invalid_payload');
      return null;
    }
    let current = await db.slateTriggerReceiverTrigger.findUnique({
      where: { id: d.receiverTriggerId },
      select: {
        registrationGeneration: true,
        registrationTransitionVersion: true,
        registrationIntentKind: true,
        registrationStatus: true,
        registrationLeaseExpiresAt: true
      }
    });
    if (!current || current.registrationGeneration !== d.registrationGeneration) {
      registrationQueueMetrics.invalidOrStaleJob('missing_or_stale_generation');
      return null;
    }
    let unregistering = ['unregister', 'delete'].includes(current.registrationIntentKind);
    if (unregistering !== (d.operation === 'unregister')) {
      registrationQueueMetrics.invalidOrStaleJob('operation_mismatch');
      return null;
    }
    let leaseExpired =
      current.registrationLeaseExpiresAt !== null && current.registrationLeaseExpiresAt <= now;
    let leasedStatus = ['unregistering', 'registering', 'renewing'].includes(
      current.registrationStatus
    );
    let eligible =
      current.registrationStatus === 'pending' ||
      current.registrationStatus === 'failed' ||
      (leasedStatus && leaseExpired);
    if (!eligible) {
      registrationQueueMetrics.invalidOrStaleJob('ineligible_status_or_lease');
      return null;
    }
    let nextStatus = unregistering
      ? ('unregistering' as const)
      : current.registrationIntentKind === 'renew'
        ? ('renewing' as const)
        : ('registering' as const);
    let nextTransition = current.registrationTransitionVersion + 1;
    let registrationLeaseToken = crypto.randomUUID();
    let registrationLeaseExpiresAt = new Date(now.getTime() + REGISTRATION_ATTEMPT_LEASE_MS);
    let claimed = await db.slateTriggerReceiverTrigger.updateMany({
      where: {
        id: d.receiverTriggerId,
        registrationGeneration: d.registrationGeneration,
        registrationTransitionVersion: current.registrationTransitionVersion,
        registrationStatus: current.registrationStatus,
        ...(leasedStatus ? { registrationLeaseExpiresAt: { lte: now } } : {})
      },
      data: {
        registrationStatus: nextStatus,
        registrationTransitionVersion: nextTransition,
        registrationLeaseToken,
        registrationLeaseExpiresAt,
        registrationLastAttemptAt: now,
        registrationEnqueueDeadlineAt: null,
        authoritativeStateVersion: { increment: 1 }
      }
    });
    if (claimed.count === 0) {
      registrationQueueMetrics.invalidOrStaleJob('claim_cas_conflict');
      return null;
    }
    if (claimed.count !== 1) throw new Error('Registration claim invariant failure');
    return {
      receiverTriggerId: d.receiverTriggerId,
      registrationGeneration: d.registrationGeneration,
      registrationTransitionVersion: nextTransition,
      registrationLeaseToken,
      registrationLeaseExpiresAt,
      intent: current.registrationIntentKind,
      status: nextStatus
    };
  }

  async renewLease(d: RegistrationAttemptClaim & { now?: Date }) {
    let now = d.now ?? new Date();
    let result = await db.slateTriggerReceiverTrigger.updateMany({
      where: {
        id: d.receiverTriggerId,
        registrationGeneration: d.registrationGeneration,
        registrationTransitionVersion: d.registrationTransitionVersion,
        registrationStatus: d.status,
        registrationLeaseToken: d.registrationLeaseToken,
        registrationLeaseExpiresAt: { gt: now }
      },
      data: {
        registrationLeaseExpiresAt: new Date(now.getTime() + REGISTRATION_ATTEMPT_LEASE_MS)
      }
    });
    return result.count === 1;
  }

  async awaitManualBootstrap(d: RegistrationAttemptClaim & { now?: Date }) {
    let now = d.now ?? new Date();
    let result = await db.slateTriggerReceiverTrigger.updateMany({
      where: {
        id: d.receiverTriggerId,
        registrationGeneration: d.registrationGeneration,
        registrationTransitionVersion: d.registrationTransitionVersion,
        registrationStatus: d.status,
        registrationLeaseToken: d.registrationLeaseToken,
        registrationLeaseExpiresAt: { gt: now }
      },
      data: {
        registrationStatus: 'pending',
        registrationLeaseToken: null,
        registrationLeaseExpiresAt: null,
        registrationEnqueueDeadlineAt: null,
        registrationErrorCode: null,
        registrationErrorMessage: null,
        registrationErrorMetadata: Prisma.DbNull,
        registrationErrorAt: null,
        authoritativeStateVersion: { increment: 1 }
      }
    });
    if (result.count === 0) return false;
    if (result.count !== 1) throw new Error('Manual bootstrap wait invariant failure');
    return true;
  }

  async succeed(
    d: RegistrationAttemptClaim & { now?: Date; remoteRegistrationKnown: boolean }
  ) {
    let now = d.now ?? new Date();
    let result = await db.slateTriggerReceiverTrigger.updateMany({
      where: {
        id: d.receiverTriggerId,
        registrationGeneration: d.registrationGeneration,
        registrationTransitionVersion: d.registrationTransitionVersion,
        registrationStatus: d.status,
        registrationLeaseToken: d.registrationLeaseToken,
        registrationLeaseExpiresAt: { gt: now }
      },
      data: {
        registrationStatus:
          d.intent === 'unregister' || d.intent === 'delete' ? 'unregistered' : 'registered',
        remoteRegistrationKnown: d.remoteRegistrationKnown,
        registrationLeaseToken: null,
        registrationLeaseExpiresAt: null,
        registrationEnqueueDeadlineAt: null,
        registrationErrorCode: null,
        registrationErrorMessage: null,
        registrationErrorMetadata: Prisma.DbNull,
        registrationErrorAt: null,
        authoritativeStateVersion: { increment: 1 },
        ...(d.intent === 'unregister' || d.intent === 'delete'
          ? {
              registrationDetails: Prisma.JsonNull,
              encryptedRegistrationDetails: null,
              registrationDetailsEncryptionKeyVersion: null,
              registrationDetailsAadVersion: null,
              registrationDetailsGeneration: null
            }
          : {})
      }
    });
    if (result.count === 0) return false;
    if (result.count !== 1) throw new Error('Registration success invariant failure');
    return true;
  }

  async markRemoteRegistrationRemoved(d: RegistrationAttemptClaim & { now?: Date }) {
    let now = d.now ?? new Date();
    let result = await db.slateTriggerReceiverTrigger.updateMany({
      where: {
        id: d.receiverTriggerId,
        registrationGeneration: d.registrationGeneration,
        registrationTransitionVersion: d.registrationTransitionVersion,
        registrationStatus: d.status,
        registrationLeaseToken: d.registrationLeaseToken,
        registrationLeaseExpiresAt: { gt: now }
      },
      data: {
        remoteRegistrationKnown: false,
        registrationDetails: Prisma.JsonNull,
        encryptedRegistrationDetails: null,
        registrationDetailsEncryptionKeyVersion: null,
        registrationDetailsAadVersion: null,
        registrationDetailsGeneration: null,
        registrationLeaseExpiresAt: new Date(now.getTime() + REGISTRATION_ATTEMPT_LEASE_MS)
      }
    });
    if (result.count === 0) return false;
    if (result.count !== 1) throw new Error('Remote registration cleanup invariant failure');
    return true;
  }

  async fail(d: RegistrationAttemptClaim & { code: SafeRegistrationFailureCode; now?: Date }) {
    let now = d.now ?? new Date();
    let result = await db.slateTriggerReceiverTrigger.updateMany({
      where: {
        id: d.receiverTriggerId,
        registrationGeneration: d.registrationGeneration,
        registrationTransitionVersion: d.registrationTransitionVersion,
        registrationStatus: d.status,
        registrationLeaseToken: d.registrationLeaseToken,
        registrationLeaseExpiresAt: { gt: now }
      },
      data: {
        registrationStatus: 'failed',
        registrationLeaseToken: null,
        registrationLeaseExpiresAt: null,
        registrationEnqueueDeadlineAt: new Date(
          now.getTime() + REGISTRATION_ENQUEUE_DEADLINE_MS
        ),
        registrationErrorCode: d.code,
        registrationErrorMessage: SAFE_REGISTRATION_FAILURES[d.code],
        registrationErrorMetadata: { version: 1 },
        registrationErrorAt: now,
        authoritativeStateVersion: { increment: 1 }
      }
    });
    if (result.count === 0) return false;
    if (result.count !== 1) throw new Error('Registration failure invariant failure');
    return true;
  }

  async reconcileVerificationDeclaration(d: {
    receiverTriggerId: string;
    expectedRegistrationGeneration: number;
    expectedSpecHash: string | null;
  }) {
    let current = await db.slateTriggerReceiverTrigger.findUnique({
      where: { id: d.receiverTriggerId },
      include: { action: true }
    });
    if (
      !current ||
      current.registrationGeneration !== d.expectedRegistrationGeneration ||
      current.verificationSpecHash !== d.expectedSpecHash
    ) {
      return false;
    }
    let declaration = actionVerificationDeclaration(current.action);
    if (
      declaration.specHash === current.verificationSpecHash &&
      declaration.mechanism === current.verificationMechanism
    ) {
      return true;
    }
    let result = await db.slateTriggerReceiverTrigger.updateMany({
      where: {
        id: d.receiverTriggerId,
        registrationGeneration: d.expectedRegistrationGeneration,
        verificationSpecHash: d.expectedSpecHash
      },
      data: {
        verificationMechanism: declaration.mechanism,
        verificationSpecHash: declaration.specHash,
        authoritativeStateVersion: { increment: 1 }
      }
    });
    if (result.count === 0) return false;
    if (result.count !== 1) throw new Error('Verification declaration invariant failure');
    return true;
  }
}

export let slateTriggerRegistrationLifecycleService =
  new SlateTriggerRegistrationLifecycleServiceImpl();
