import { isServiceError } from '@lowerdeck/error';
import { createLock } from '@lowerdeck/lock';
import { db, withTransaction } from '@metorial-subspace/db';
import { tombstoneProvisionedTenantAppsForCallbackInTransaction } from '@metorial-subspace/module-auth';
import { slates } from '@metorial-subspace/provider-slates/src/client';
import { createHash } from 'node:crypto';
import { env } from '../../env';
import { getTenantForSignal, signal } from '../../signal';
import {
  getTenantForSlatesCached,
  isCallbackSupported,
  isPairUsable,
  loadCallback,
  loadFreshCallback,
  loadFreshCallbackInstance,
  loadCallbackInstance,
  TRIGGER_PAGE_SIZE
} from './state';

let canonicalJson = (value: unknown): string => {
  if (value instanceof Date) return JSON.stringify(value.toISOString());
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  let record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .sort()
    .map(key => `${JSON.stringify(key)}:${canonicalJson(record[key])}`)
    .join(',')}}`;
};

let STATUS_PRIORITY = [
  'failed',
  'unregistering',
  'renewing',
  'registering',
  'pending',
  'registered',
  'unregistered'
] as const;

export type HubCallbackRegistrationReceiver = {
  id: string;
  callbackOwnerVersion: number;
  receiverPathSecrets?: Array<{
    id: string;
    status: string;
    secretVersion: number;
    validFrom: Date | string;
    validUntil: Date | string | null;
    rotatedAt: Date | string | null;
  }>;
  triggers: Array<{
    id: string;
    active: boolean;
    authoritativeStateVersion: number;
    registrationStatus: (typeof STATUS_PRIORITY)[number];
    registrationGeneration: number;
    registrationTransitionVersion: number;
    registrationError: {
      code: string;
      message: string | null;
      metadata: unknown;
      at: Date | string | null;
    } | null;
    verificationMechanism: string;
    verificationSpecHash: string | null;
  }>;
};

export let callbackOwnerMutationId = (value: unknown) =>
  `callback-owner:${createHash('sha256').update(canonicalJson(value)).digest('hex')}`;

export let buildCallbackRegistrationMirror = (receiver: HubCallbackRegistrationReceiver) => {
  if (!Number.isInteger(receiver.callbackOwnerVersion) || receiver.callbackOwnerVersion < 0) {
    throw new Error('callback_registration_invalid_owner_version');
  }
  let triggers = [...receiver.triggers].sort((first, second) =>
    first.id.localeCompare(second.id)
  );
  for (let trigger of triggers) {
    if (
      !Number.isInteger(trigger.authoritativeStateVersion) ||
      trigger.authoritativeStateVersion <= 0
    ) {
      throw new Error('callback_registration_invalid_authoritative_version');
    }
  }
  let activeTriggers = triggers.filter(trigger => trigger.active);
  let registrationTuples = new Set(
    activeTriggers.map(
      trigger => `${trigger.registrationGeneration}:${trigger.registrationTransitionVersion}`
    )
  );
  let commonRegistration = registrationTuples.size === 1 ? (activeTriggers[0] ?? null) : null;
  let status =
    STATUS_PRIORITY.find(candidate =>
      candidate === 'registered' || candidate === 'unregistered'
        ? activeTriggers.length > 0 &&
          activeTriggers.every(trigger => trigger.registrationStatus === candidate)
        : activeTriggers.some(trigger => trigger.registrationStatus === candidate)
    ) ?? 'unregistered';
  let failed = activeTriggers.find(trigger => trigger.registrationStatus === 'failed');
  let sameMechanism = new Set(activeTriggers.map(trigger => trigger.verificationMechanism));
  let snapshot = {
    receiverId: receiver.id,
    callbackOwnerVersion: receiver.callbackOwnerVersion,
    receiverPathSecrets: (receiver.receiverPathSecrets ?? []).map(secret => ({
      ...secret,
      validFrom: new Date(secret.validFrom).toISOString(),
      validUntil: secret.validUntil ? new Date(secret.validUntil).toISOString() : null,
      rotatedAt: secret.rotatedAt ? new Date(secret.rotatedAt).toISOString() : null
    })),
    triggers: triggers.map(trigger => ({
      id: trigger.id,
      active: trigger.active,
      authoritativeStateVersion: trigger.authoritativeStateVersion,
      registrationStatus: trigger.registrationStatus,
      registrationGeneration: trigger.registrationGeneration,
      registrationTransitionVersion: trigger.registrationTransitionVersion,
      registrationError: trigger.registrationError,
      verificationMechanism: trigger.verificationMechanism,
      verificationSpecHash: trigger.verificationSpecHash
    }))
  };
  return {
    registrationStatus: status,
    registrationGeneration: commonRegistration?.registrationGeneration ?? 0,
    registrationTransitionVersion: commonRegistration?.registrationTransitionVersion ?? 0,
    registrationErrorCode: failed?.registrationError?.code ?? null,
    registrationErrorMessage: failed?.registrationError?.message ?? null,
    registrationErrorMetadata: failed?.registrationError?.metadata ?? null,
    registrationErrorAt: failed?.registrationError?.at
      ? new Date(failed.registrationError.at)
      : null,
    registrationPublicSnapshot: snapshot,
    verificationMechanism:
      sameMechanism.size === 1 ? (activeTriggers[0]?.verificationMechanism ?? null) : null,
    verificationSpecHash:
      new Set(activeTriggers.map(trigger => trigger.verificationSpecHash)).size === 1
        ? (activeTriggers[0]?.verificationSpecHash ?? null)
        : null
  };
};

let callbackRegistrationReconcileJobId = (
  callbackInstanceId: string,
  receiver: HubCallbackRegistrationReceiver
) => {
  let snapshot = buildCallbackRegistrationMirror(receiver).registrationPublicSnapshot;
  let triggerVersions = snapshot.triggers.map(trigger => ({
    id: trigger.id,
    active: trigger.active,
    authoritativeStateVersion: trigger.authoritativeStateVersion,
    digest: createHash('sha256').update(canonicalJson(trigger)).digest('hex')
  }));
  let digest = createHash('sha256')
    .update(
      canonicalJson({
        receiverId: receiver.id,
        callbackOwnerVersion: receiver.callbackOwnerVersion,
        triggerVersions
      })
    )
    .digest('hex');
  return `immediate:${callbackInstanceId}:${digest}`;
};

export let enqueueImmediateRegistrationReconciliation = async (
  callbackInstanceId: string,
  receiver: HubCallbackRegistrationReceiver
) => {
  let { reconcileCallbackRegistrationQueue } = await import('../queues/definitions');
  await reconcileCallbackRegistrationQueue.add(
    { callbackInstanceId },
    { id: callbackRegistrationReconcileJobId(callbackInstanceId, receiver) }
  );
};

let compareAuthoritativeTriggerVersion = (
  incoming: HubCallbackRegistrationReceiver['triggers'][number],
  stored: HubCallbackRegistrationReceiver['triggers'][number]
) => {
  if (
    !Number.isInteger(incoming.authoritativeStateVersion) ||
    incoming.authoritativeStateVersion <= 0
  ) {
    throw new Error('callback_registration_invalid_authoritative_version');
  }
  if (
    !Number.isInteger(stored.authoritativeStateVersion) ||
    stored.authoritativeStateVersion <= 0
  ) {
    return 1;
  }
  let versionComparison =
    incoming.authoritativeStateVersion - stored.authoritativeStateVersion;
  return versionComparison;
};

export let applyCallbackRegistrationMirror = async (d: {
  callbackInstanceOid: bigint;
  receiver: HubCallbackRegistrationReceiver;
  expectedReceiverId?: string | null;
  expectedReceiverAuthorityVersion?: number;
}) => {
  let current = await db.callbackInstance.findUniqueOrThrow({
    where: { oid: d.callbackInstanceOid },
    select: {
      registrationPublicSnapshot: true,
      registrationMirrorVersion: true,
      registrationReceiverAuthorityVersion: true,
      slateTriggerReceiverId: true
    }
  });

  if (
    d.expectedReceiverId !== undefined &&
    current.slateTriggerReceiverId !== d.expectedReceiverId
  ) {
    return 'stale' as const;
  }
  if (
    d.expectedReceiverAuthorityVersion !== undefined &&
    current.registrationReceiverAuthorityVersion !== d.expectedReceiverAuthorityVersion
  ) {
    return 'stale' as const;
  }
  if (
    !Number.isInteger(d.receiver.callbackOwnerVersion) ||
    d.receiver.callbackOwnerVersion < current.registrationReceiverAuthorityVersion ||
    d.receiver.callbackOwnerVersion > current.registrationReceiverAuthorityVersion + 1 ||
    (current.slateTriggerReceiverId !== d.receiver.id &&
      d.receiver.callbackOwnerVersion !== current.registrationReceiverAuthorityVersion + 1)
  ) {
    return 'stale' as const;
  }

  let storedSnapshot = current.registrationPublicSnapshot;
  let hasStoredTriggers =
    storedSnapshot !== null &&
    typeof storedSnapshot === 'object' &&
    !Array.isArray(storedSnapshot) &&
    typeof (storedSnapshot as Record<string, unknown>).receiverId === 'string' &&
    Array.isArray((storedSnapshot as Record<string, unknown>).triggers);
  let storedReceiverId = hasStoredTriggers
    ? (storedSnapshot as { receiverId: string }).receiverId
    : null;
  let storedTriggers = hasStoredTriggers
    ? ((storedSnapshot as { triggers: HubCallbackRegistrationReceiver['triggers'] })
        .triggers ?? [])
    : [];
  let replacingReceiver = hasStoredTriggers && storedReceiverId !== d.receiver.id;
  let storedById = new Map(
    (replacingReceiver ? [] : storedTriggers).map(trigger => [trigger.id, trigger] as const)
  );
  let mergedById = new Map(storedById);
  let ownerAdvanced =
    d.receiver.callbackOwnerVersion !== current.registrationReceiverAuthorityVersion;
  let advanced = !hasStoredTriggers || replacingReceiver || ownerAdvanced;
  let stale = false;
  let normalizedIncoming = buildCallbackRegistrationMirror(d.receiver)
    .registrationPublicSnapshot.triggers as HubCallbackRegistrationReceiver['triggers'];

  for (let incoming of normalizedIncoming) {
    let stored = storedById.get(incoming.id);
    if (!stored) {
      mergedById.set(incoming.id, incoming);
      advanced = true;
      continue;
    }
    let comparison = compareAuthoritativeTriggerVersion(incoming, stored);
    if (comparison > 0) {
      mergedById.set(incoming.id, incoming);
      advanced = true;
    } else if (comparison < 0) {
      stale = true;
    } else if (canonicalJson(incoming) !== canonicalJson(stored)) {
      throw new Error('callback_registration_equal_version_conflict');
    }
  }

  if (!advanced) return stale ? ('stale' as const) : ('unchanged' as const);

  let mergedReceiver: HubCallbackRegistrationReceiver = {
    id: d.receiver.id,
    callbackOwnerVersion: d.receiver.callbackOwnerVersion,
    receiverPathSecrets: d.receiver.receiverPathSecrets,
    triggers: [...mergedById.values()]
  };
  let merged = buildCallbackRegistrationMirror(mergedReceiver);
  let updated = await db.callbackInstance.updateMany({
    where: {
      oid: d.callbackInstanceOid,
      registrationMirrorVersion: current.registrationMirrorVersion,
      registrationReceiverAuthorityVersion: current.registrationReceiverAuthorityVersion,
      slateTriggerReceiverId: current.slateTriggerReceiverId
    },
    data: {
      ...merged,
      registrationMirrorVersion: { increment: 1 },
      registrationReceiverAuthorityVersion: d.receiver.callbackOwnerVersion,
      slateTriggerReceiverId: d.receiver.id,
      lastSyncedAt: new Date(),
      lastRegistrationSyncErrorCode: null,
      lastRegistrationSyncErrorMessage: null,
      lastRegistrationSyncErrorAt: null,
      lastSyncErrorCode: null,
      lastSyncErrorMessage: null
    }
  });
  if (updated.count !== 1) throw new Error('callback_registration_mirror_cas_conflict');
  return 'applied' as const;
};

export let detachRegistration = async (d: {
  callbackInstanceOid: bigint;
  callbackInstanceId: string;
  callbackId: string;
  slateTriggerReceiverId?: string | null;
  expectedLocalReceiverId?: string | null;
  expectedReceiverAuthorityVersion: number;
  slatesTenantId: string;
}) => {
  try {
    if (d.slateTriggerReceiverId) {
      let receiver = await slates.callbackRegistration.delete({
        tenantId: d.slatesTenantId,
        callbackId: d.callbackId,
        callbackInstanceId: d.callbackInstanceId,
        slateTriggerReceiverId: d.slateTriggerReceiverId,
        expectedOwnerVersion: d.expectedReceiverAuthorityVersion,
        ownerMutationId: callbackOwnerMutationId({
          operation: 'delete',
          callbackId: d.callbackId,
          callbackInstanceId: d.callbackInstanceId,
          receiverId: d.slateTriggerReceiverId
        })
      });
      let applied = await applyCallbackRegistrationMirror({
        callbackInstanceOid: d.callbackInstanceOid,
        receiver,
        expectedReceiverId:
          d.expectedLocalReceiverId === undefined
            ? d.slateTriggerReceiverId
            : d.expectedLocalReceiverId,
        expectedReceiverAuthorityVersion: d.expectedReceiverAuthorityVersion
      });
      if (applied === 'stale') throw new Error('callback_registration_local_owner_conflict');
      await enqueueImmediateRegistrationReconciliation(d.callbackInstanceId, receiver);
    }
  } catch (error) {
    await markRegistrationFailure({
      callbackInstanceOid: d.callbackInstanceOid,
      message: 'Callback registration reconciliation failed.'
    });
    throw error;
  }
};

export let upsertActiveRegistration = async (d: {
  callbackInstanceOid: bigint;
  receiver: HubCallbackRegistrationReceiver;
  expectedReceiverId?: string | null;
  expectedReceiverAuthorityVersion?: number;
}) => applyCallbackRegistrationMirror(d);

export let markRegistrationFailure = async (d: {
  callbackInstanceOid: bigint;
  message: string;
}) => {
  await db.callbackInstance.update({
    where: { oid: d.callbackInstanceOid },
    data: {
      lastRegistrationSyncErrorCode: 'registration_sync_failed',
      lastRegistrationSyncErrorMessage: 'Callback registration reconciliation failed.',
      lastRegistrationSyncErrorAt: new Date(),
      lastSyncErrorCode: 'registration_sync_failed',
      lastSyncErrorMessage: 'Callback registration reconciliation failed.'
    }
  });
};

let markCallbackV2IfReady = async (
  callback: NonNullable<Awaited<ReturnType<typeof loadCallback>>>
) => {
  if (callback.isCallbacksV2) return;

  if (!isCallbackSupported(callback) || callback.callbackProviderTriggers.length === 0) {
    await db.callback.update({
      where: { oid: callback.oid },
      data: { isCallbacksV2: true }
    });
    return;
  }

  let attachedInstances = await db.callbackInstance.findMany({
    where: {
      callbackOid: callback.oid,
      status: 'attached'
    },
    select: {
      slateTriggerReceiverId: true
    }
  });

  if (
    attachedInstances.length === 0 ||
    attachedInstances.some(instance => !!instance.slateTriggerReceiverId)
  ) {
    await db.callback.update({
      where: { oid: callback.oid },
      data: { isCallbacksV2: true }
    });
  }
};

let syncLoadedSignalCallback = async (
  callback: NonNullable<Awaited<ReturnType<typeof loadCallback>>>
) => {
  let signalTenant = await getTenantForSignal(callback.tenant);
  let activeDestinations = callback.callbackDestinationLinks
    .map(link => link.callbackDestination)
    .filter(destination => destination.status === 'active');

  let signalCallback =
    callback.status === 'active' && isCallbackSupported(callback)
      ? await signal.callback.upsert({
          tenantId: signalTenant.id,
          callbackId: callback.id,
          name: callback.name,
          description: callback.description,
          eventTypes: [],
          destinations: activeDestinations.map(destination => ({
            externalId: destination.id,
            name: destination.name,
            description: destination.description,
            variant: {
              type: 'http_endpoint',
              url: destination.url,
              method: destination.method as 'POST' | 'PUT' | 'PATCH'
            }
          }))
        })
      : await (async () => {
          try {
            return await signal.callback.archive({
              tenantId: signalTenant.id,
              callbackId: callback.id
            });
          } catch (error) {
            if (isServiceError(error) && error.data.code === 'not_found') {
              return null;
            }

            throw error;
          }
        })();

  if (signalCallback) {
    for (let link of signalCallback.destinations) {
      if (!link.destination.externalId) continue;
      await db.callbackDestination.updateMany({
        where: {
          tenantOid: callback.tenantOid,
          id: link.destination.externalId
        },
        data: {
          signalEventDestinationId: link.destination.id,
          lastSignalSyncedAt: new Date()
        }
      });
    }
  }

  await markCallbackV2IfReady(callback);
};

let archiveLoadedSignalCallback = async (
  callback: NonNullable<Awaited<ReturnType<typeof loadCallback>>>
) => {
  let signalTenant = await getTenantForSignal(callback.tenant);

  try {
    await signal.callback.archive({
      tenantId: signalTenant.id,
      callbackId: callback.id
    });
  } catch (error) {
    if (isServiceError(error) && error.data.code === 'not_found') return;
    throw error;
  }
};

let syncSignalCallback = async (d: { callbackId: string; fresh?: boolean }) => {
  let callback = d.fresh
    ? await loadFreshCallback(d.callbackId)
    : await loadCallback(d.callbackId);
  if (!callback) return;

  await syncLoadedSignalCallback(callback);
};

let callbackReconciliationLock = createLock({
  name: 'sub/callback/reconciliation',
  redisUrl: env.service.REDIS_URL
});

let syncCallbackUnlocked = async (d: {
  callbackId: string;
  fresh?: boolean;
  throwOnError?: boolean;
}) => {
  let callback = d.fresh
    ? await loadFreshCallback(d.callbackId)
    : await loadCallback(d.callbackId);
  if (!callback) return;

  await archiveLoadedSignalCallback(callback);

  let cursor: string | undefined;
  while (true) {
    let rows = await db.callbackInstance.findMany({
      where: {
        callback: {
          id: d.callbackId
        },
        status: 'attached',
        id: cursor ? { gt: cursor } : undefined
      },
      orderBy: { id: 'asc' },
      take: TRIGGER_PAGE_SIZE,
      select: { id: true }
    });
    if (!rows.length) break;

    for (let row of rows) {
      try {
        await syncCallbackInstance({
          callbackInstanceId: row.id,
          fresh: d.fresh,
          skipSignalSync: true,
          throwOnError: true
        });
      } catch (error) {
        if (d.throwOnError) throw error;
        return;
      }
    }

    if (rows.length < TRIGGER_PAGE_SIZE) break;
    cursor = rows[rows.length - 1]!.id;
  }

  await syncSignalCallback({ callbackId: d.callbackId, fresh: d.fresh });
};

export let syncCallback = async (d: {
  callbackId: string;
  fresh?: boolean;
  throwOnError?: boolean;
}) =>
  await callbackReconciliationLock.usingLock(
    d.callbackId,
    async () => await syncCallbackUnlocked(d),
    { durationMs: 60_000 }
  );

export let syncCallbackInstance = async (d: {
  callbackInstanceId: string;
  fresh?: boolean;
  skipSignalSync?: boolean;
  throwOnError?: boolean;
}) => {
  let callbackInstance = !d.skipSignalSync
    ? await loadFreshCallbackInstance(d.callbackInstanceId)
    : d.fresh
      ? await loadFreshCallbackInstance(d.callbackInstanceId)
      : await loadCallbackInstance(d.callbackInstanceId);
  if (!callbackInstance) return;

  if (!d.skipSignalSync) {
    await syncCallback({
      callbackId: callbackInstance.callback.id,
      fresh: true,
      throwOnError: d.throwOnError
    });
    return;
  }

  let callback = callbackInstance.callback;
  let providerTriggerInputs = callback.callbackProviderTriggers.map(trigger => ({
    triggerId: trigger.providerTrigger.specId,
    eventTypes: trigger.eventTypes,
    ...(callback.pollIntervalSecondsOverride !== null &&
    callback.pollIntervalSecondsOverride !== undefined
      ? { pollIntervalSeconds: callback.pollIntervalSecondsOverride }
      : {})
  }));
  let slateTriggerReceiverId = callbackInstance.slateTriggerReceiverId;

  let pairUsable = isPairUsable(callbackInstance.providerDeploymentConfigPair);

  if (
    callbackInstance.status !== 'attached' ||
    !isCallbackSupported(callback) ||
    !pairUsable ||
    !providerTriggerInputs.length
  ) {
    // No triggers keeps the instance attached so re-adding them re-registers; a
    // dead callback or pair detaches it for good, matching detach().
    let shouldDetachInstance =
      callbackInstance.status === 'attached' && (callback.status !== 'active' || !pairUsable);

    if (slateTriggerReceiverId) {
      let slatesTenant = await getTenantForSlatesCached(callback.tenant);

      try {
        await detachRegistration({
          callbackInstanceOid: callbackInstance.oid,
          callbackInstanceId: callbackInstance.id,
          callbackId: callback.id,
          slateTriggerReceiverId,
          expectedLocalReceiverId: callbackInstance.slateTriggerReceiverId ?? null,
          expectedReceiverAuthorityVersion:
            callbackInstance.registrationReceiverAuthorityVersion,
          slatesTenantId: slatesTenant.id
        });
      } catch (error) {
        // Stays attached so the lifecycle sweep retries the teardown.
        if (d.throwOnError) throw error;
        return;
      }
    } else if (!shouldDetachInstance) {
      await db.callbackInstance.update({
        where: { oid: callbackInstance.oid },
        data: {
          lastSyncedAt: new Date(),
          lastSyncErrorCode: null,
          lastSyncErrorMessage: null
        }
      });
    }

    if (shouldDetachInstance) {
      let now = new Date();
      await withTransaction(async db => {
        await tombstoneProvisionedTenantAppsForCallbackInTransaction(
          db,
          callbackInstance.oid,
          now
        );
        await db.callbackInstance.update({
          where: { oid: callbackInstance.oid },
          data: {
            status: 'detached',
            lastSyncedAt: now,
            lastSyncErrorCode: null,
            lastSyncErrorMessage: null
          }
        });
      });
    }

    await markCallbackV2IfReady(callback);
    return;
  }

  try {
    let slatesTenant = await getTenantForSlatesCached(callback.tenant);
    let slateInstanceId =
      callbackInstance.providerDeploymentConfigPair.providerConfigVersion.slateInstance?.id;

    if (!slateInstanceId) {
      throw new Error('missing_receiver_requirements');
    }

    let authConfigId =
      callbackInstance.providerDeploymentConfigPair.providerAuthConfigVersion?.slateAuthConfig
        ?.id ?? null;

    let upsertInput = {
      tenantId: slatesTenant.id,
      callbackId: callback.id,
      callbackInstanceId: callbackInstance.id,
      expectedSlateTriggerReceiverId: slateTriggerReceiverId ?? null,
      expectedOwnerVersion: callbackInstance.registrationReceiverAuthorityVersion,
      slateInstanceId,
      authConfigId,
      triggers: providerTriggerInputs,
      name: `Callback ${callback.id}`
    };
    let receiver = await slates.callbackRegistration.upsert({
      ...upsertInput,
      ownerMutationId: callbackOwnerMutationId({
        operation: 'upsert',
        callbackId: upsertInput.callbackId,
        callbackInstanceId: upsertInput.callbackInstanceId,
        slateInstanceId: upsertInput.slateInstanceId,
        authConfigId: upsertInput.authConfigId,
        name: upsertInput.name,
        description: null,
        triggers: upsertInput.triggers
      })
    });

    let applied = await upsertActiveRegistration({
      callbackInstanceOid: callbackInstance.oid,
      receiver,
      expectedReceiverId: callbackInstance.slateTriggerReceiverId ?? null,
      expectedReceiverAuthorityVersion: callbackInstance.registrationReceiverAuthorityVersion
    });
    if (applied === 'stale') throw new Error('callback_registration_local_owner_conflict');
    await enqueueImmediateRegistrationReconciliation(callbackInstance.id, receiver);
    await markCallbackV2IfReady(callback);
  } catch (error) {
    await markRegistrationFailure({
      callbackInstanceOid: callbackInstance.oid,
      message: 'Callback registration reconciliation failed.'
    });

    if (d.throwOnError) {
      throw error;
    }
  }
};
