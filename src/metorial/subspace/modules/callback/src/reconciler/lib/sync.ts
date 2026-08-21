import { isServiceError } from '@lowerdeck/error';
import { createHash } from 'node:crypto';
import { db, withTransaction } from '@metorial-subspace/db';
import { tombstoneProvisionedTenantAppsForCallbackInTransaction } from '@metorial-subspace/module-auth';
import { slates } from '@metorial-subspace/provider-slates/src/client';
import { getTenantForSignal, signal } from '../../signal';
import {
  getTenantForSlatesCached,
  isCallbackSupported,
  isPairUsable,
  loadCallback,
  loadCallbackInstance,
  loadFreshCallback,
  loadFreshCallbackInstance,
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

export let callbackOwnerMutationId = (value: unknown) =>
  `callback-owner:${createHash('sha256').update(canonicalJson(value)).digest('hex')}`;

export type HubCallbackRegistrationReceiver = Awaited<
  ReturnType<typeof slates.callbackRegistration.get>
>;

let STATUS_PRIORITY = [
  'failed',
  'unregistering',
  'renewing',
  'registering',
  'pending',
  'registered',
  'unregistered'
] as const;

export let buildCallbackRegistrationMirror = (receiver: HubCallbackRegistrationReceiver) => {
  if (!Number.isInteger(receiver.callbackOwnerVersion) || receiver.callbackOwnerVersion < 1) {
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
  let status =
    STATUS_PRIORITY.find(candidate =>
      candidate === 'registered' || candidate === 'unregistered'
        ? activeTriggers.length > 0 &&
          activeTriggers.every(trigger => trigger.registrationStatus === candidate)
        : activeTriggers.some(trigger => trigger.registrationStatus === candidate)
    ) ?? 'unregistered';
  let failed = activeTriggers.find(trigger => trigger.registrationStatus === 'failed');
  let commonRegistration =
    new Set(
      activeTriggers.map(
        trigger => `${trigger.registrationGeneration}:${trigger.registrationTransitionVersion}`
      )
    ).size === 1
      ? (activeTriggers[0] ?? null)
      : null;
  let verificationMechanisms = new Set(
    activeTriggers.map(trigger => trigger.verificationMechanism)
  );
  let verificationSpecHashes = new Set(
    activeTriggers.map(trigger => trigger.verificationSpecHash)
  );
  let snapshot = {
    receiverId: receiver.id,
    callbackOwnerVersion: receiver.callbackOwnerVersion,
    receiverPathSecret: receiver.receiverPathSecret
      ? {
          ...receiver.receiverPathSecret,
          createdAt: new Date(receiver.receiverPathSecret.createdAt).toISOString(),
          updatedAt: new Date(receiver.receiverPathSecret.updatedAt).toISOString()
        }
      : null,
    triggers: triggers.map(trigger => ({
      id: trigger.id,
      active: trigger.active,
      authoritativeStateVersion: trigger.authoritativeStateVersion,
      triggerId: trigger.triggerId,
      triggerKey: trigger.triggerKey,
      triggerName: trigger.triggerName,
      source: trigger.source,
      eventTypes: trigger.eventTypes,
      pollIntervalSeconds: trigger.pollIntervalSeconds,
      nextPollAt: trigger.nextPollAt,
      lastPolledAt: trigger.lastPolledAt,
      webhookUrl: trigger.webhookUrl,
      registrationStatus: trigger.registrationStatus,
      registrationGeneration: trigger.registrationGeneration,
      registrationTransitionVersion: trigger.registrationTransitionVersion,
      registrationError: trigger.registrationError,
      verificationMechanism: trigger.verificationMechanism,
      verificationSpecHash: trigger.verificationSpecHash,
      isWebhookRegistered: trigger.isWebhookRegistered
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
      verificationMechanisms.size === 1
        ? (activeTriggers[0]?.verificationMechanism ?? null)
        : null,
    verificationSpecHash:
      verificationSpecHashes.size === 1
        ? (activeTriggers[0]?.verificationSpecHash ?? null)
        : null
  };
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
    d.receiver.callbackOwnerVersion < current.registrationReceiverAuthorityVersion ||
    d.receiver.callbackOwnerVersion > current.registrationReceiverAuthorityVersion + 1 ||
    (current.slateTriggerReceiverId !== d.receiver.id &&
      d.receiver.callbackOwnerVersion !== current.registrationReceiverAuthorityVersion + 1)
  ) {
    return 'stale' as const;
  }

  let incomingMirror = buildCallbackRegistrationMirror(d.receiver);
  let storedSnapshot = current.registrationPublicSnapshot;
  let hasStoredSnapshot =
    storedSnapshot !== null &&
    typeof storedSnapshot === 'object' &&
    !Array.isArray(storedSnapshot) &&
    Array.isArray((storedSnapshot as Record<string, unknown>).triggers);
  let storedReceiverId = hasStoredSnapshot
    ? ((storedSnapshot as Record<string, unknown>).receiverId as string | undefined)
    : undefined;
  let replacingReceiver = hasStoredSnapshot && storedReceiverId !== d.receiver.id;
  let storedTriggers =
    hasStoredSnapshot && !replacingReceiver
      ? ((
          storedSnapshot as unknown as {
            triggers: HubCallbackRegistrationReceiver['triggers'];
          }
        ).triggers ?? [])
      : [];
  let incomingTriggers = incomingMirror.registrationPublicSnapshot
    .triggers as HubCallbackRegistrationReceiver['triggers'];
  let storedById = new Map(storedTriggers.map(trigger => [trigger.id, trigger] as const));
  let mergedById = new Map(storedById);
  let advanced =
    !hasStoredSnapshot ||
    replacingReceiver ||
    d.receiver.callbackOwnerVersion !== current.registrationReceiverAuthorityVersion ||
    canonicalJson(
      (storedSnapshot as null | { receiverPathSecret?: unknown })?.receiverPathSecret ?? null
    ) !== canonicalJson(incomingMirror.registrationPublicSnapshot.receiverPathSecret ?? null);

  for (let incoming of incomingTriggers) {
    let stored = storedById.get(incoming.id);
    if (!stored) {
      mergedById.set(incoming.id, incoming);
      advanced = true;
      continue;
    }
    if (incoming.authoritativeStateVersion > stored.authoritativeStateVersion) {
      mergedById.set(incoming.id, incoming);
      advanced = true;
    } else if (
      incoming.authoritativeStateVersion === stored.authoritativeStateVersion &&
      canonicalJson(incoming) !== canonicalJson(stored)
    ) {
      throw new Error('callback_registration_equal_version_conflict');
    }
  }

  if (!advanced) return 'unchanged' as const;
  let mirror = buildCallbackRegistrationMirror({
    id: d.receiver.id,
    callbackOwnerVersion: d.receiver.callbackOwnerVersion,
    receiverPathSecret: d.receiver.receiverPathSecret,
    triggers: [...mergedById.values()]
  } as HubCallbackRegistrationReceiver);
  let updated = await db.callbackInstance.updateMany({
    where: {
      oid: d.callbackInstanceOid,
      registrationMirrorVersion: current.registrationMirrorVersion,
      registrationReceiverAuthorityVersion: current.registrationReceiverAuthorityVersion,
      slateTriggerReceiverId: current.slateTriggerReceiverId
    },
    data: {
      ...mirror,
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
  if (updated.count !== 1) {
    throw new Error('callback_registration_mirror_cas_conflict');
  }
  return 'applied' as const;
};

export let markRegistrationFailure = async (d: { callbackInstanceOid: bigint }) => {
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

export let detachRegistration = async (d: {
  callbackInstanceOid: bigint;
  callbackInstanceId: string;
  callbackId: string;
  slateTriggerReceiverId?: string | null;
  expectedReceiverAuthorityVersion: number;
  slatesTenantId: string;
}) => {
  if (!d.slateTriggerReceiverId) return;

  let owner = {
    tenantId: d.slatesTenantId,
    callbackId: d.callbackId,
    callbackInstanceId: d.callbackInstanceId,
    slateTriggerReceiverId: d.slateTriggerReceiverId,
    expectedOwnerVersion: d.expectedReceiverAuthorityVersion
  };

  try {
    await slates.callbackRegistration.revokePathSecrets({
      ...owner,
      ownerMutationId: callbackOwnerMutationId({
        operation: 'revoke-path-secrets',
        callbackId: d.callbackId,
        callbackInstanceId: d.callbackInstanceId,
        receiverId: d.slateTriggerReceiverId,
        ownerVersion: d.expectedReceiverAuthorityVersion
      })
    });
    let receiver = await slates.callbackRegistration.delete({
      ...owner,
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
      expectedReceiverId: d.slateTriggerReceiverId,
      expectedReceiverAuthorityVersion: d.expectedReceiverAuthorityVersion
    });
    if (applied === 'stale') {
      throw new Error('callback_registration_local_owner_conflict');
    }
  } catch (error) {
    await markRegistrationFailure({ callbackInstanceOid: d.callbackInstanceOid });
    throw error;
  }
};

let syncLoadedSignalCallback = async (
  callback: NonNullable<Awaited<ReturnType<typeof loadCallback>>>
) => {
  let signalTenant = await getTenantForSignal(callback.tenant);
  let activeDestinations = callback.callbackDestinationLinks
    .map(link => link.callbackDestination)
    .filter(destination => destination.status === 'active');
  let eventTypes = [
    ...new Set(callback.callbackProviderTriggers.flatMap(trigger => trigger.eventTypes))
  ];

  let signalCallback =
    callback.status === 'active' && isCallbackSupported(callback)
      ? await signal.callback.upsert({
          tenantId: signalTenant.id,
          callbackId: callback.id,
          name: callback.name,
          description: callback.description,
          eventTypes,
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
            if (isServiceError(error) && error.data.code === 'not_found') return null;
            throw error;
          }
        })();

  if (!signalCallback) return;
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
};

export let syncSignalCallback = async (d: { callbackId: string; fresh?: boolean }) => {
  let callback = d.fresh
    ? await loadFreshCallback(d.callbackId)
    : await loadCallback(d.callbackId);
  if (!callback) return;
  await syncLoadedSignalCallback(callback);
};

export let syncCallback = async (d: {
  callbackId: string;
  fresh?: boolean;
  throwOnError?: boolean;
}) => {
  await syncSignalCallback({ callbackId: d.callbackId, fresh: d.fresh });

  let cursor: string | undefined;
  while (true) {
    let rows = await db.callbackInstance.findMany({
      where: {
        callback: { id: d.callbackId },
        status: 'attached',
        id: cursor ? { gt: cursor } : undefined
      },
      orderBy: { id: 'asc' },
      take: TRIGGER_PAGE_SIZE,
      select: { id: true }
    });
    if (!rows.length) return;

    for (let row of rows) {
      await syncCallbackInstance({
        callbackInstanceId: row.id,
        fresh: d.fresh,
        skipSignalSync: true,
        throwOnError: d.throwOnError
      });
    }

    if (rows.length < TRIGGER_PAGE_SIZE) return;
    cursor = rows[rows.length - 1]!.id;
  }
};

export let syncCallbackInstance = async (d: {
  callbackInstanceId: string;
  fresh?: boolean;
  skipSignalSync?: boolean;
  throwOnError?: boolean;
}) => {
  let callbackInstance = d.fresh
    ? await loadFreshCallbackInstance(d.callbackInstanceId)
    : await loadCallbackInstance(d.callbackInstanceId);
  if (!callbackInstance) return;

  let callback = callbackInstance.callback;
  if (!d.skipSignalSync) {
    await syncSignalCallback({ callbackId: callback.id, fresh: d.fresh });
  }

  let providerTriggerInputs = callback.callbackProviderTriggers.map(trigger => ({
    triggerId: trigger.providerTrigger.specId,
    eventTypes: trigger.eventTypes,
    ...(callback.pollIntervalSecondsOverride !== null &&
    callback.pollIntervalSecondsOverride !== undefined
      ? { pollIntervalSeconds: callback.pollIntervalSecondsOverride }
      : {})
  }));
  let pairUsable = isPairUsable(callbackInstance.providerDeploymentConfigPair);
  let shouldDetachInstance =
    callbackInstance.status === 'attached' && (callback.status !== 'active' || !pairUsable);

  if (
    callbackInstance.status !== 'attached' ||
    !isCallbackSupported(callback) ||
    !pairUsable ||
    !providerTriggerInputs.length
  ) {
    if (callbackInstance.slateTriggerReceiverId) {
      let slatesTenant = await getTenantForSlatesCached(callback.tenant);
      try {
        await detachRegistration({
          callbackInstanceOid: callbackInstance.oid,
          callbackInstanceId: callbackInstance.id,
          callbackId: callback.id,
          slateTriggerReceiverId: callbackInstance.slateTriggerReceiverId,
          expectedReceiverAuthorityVersion:
            callbackInstance.registrationReceiverAuthorityVersion,
          slatesTenantId: slatesTenant.id
        });
      } catch (error) {
        if (d.throwOnError) throw error;
        return;
      }
    }

    if (shouldDetachInstance) {
      let now = new Date();
      await withTransaction(async tx => {
        await tombstoneProvisionedTenantAppsForCallbackInTransaction(
          tx,
          callbackInstance.oid,
          now
        );
        await tx.callbackInstance.update({
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
    return;
  }

  try {
    let slatesTenant = await getTenantForSlatesCached(callback.tenant);
    let slateInstanceId =
      callbackInstance.providerDeploymentConfigPair.providerConfigVersion.slateInstance?.id;
    if (!slateInstanceId) throw new Error('missing_receiver_requirements');

    let authConfigId =
      callbackInstance.providerDeploymentConfigPair.providerAuthConfigVersion?.slateAuthConfig
        ?.id ?? null;
    let upsertInput = {
      tenantId: slatesTenant.id,
      callbackId: callback.id,
      callbackInstanceId: callbackInstance.id,
      expectedSlateTriggerReceiverId: callbackInstance.slateTriggerReceiverId ?? null,
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

    let applied = await applyCallbackRegistrationMirror({
      callbackInstanceOid: callbackInstance.oid,
      receiver,
      expectedReceiverId: callbackInstance.slateTriggerReceiverId ?? null,
      expectedReceiverAuthorityVersion: callbackInstance.registrationReceiverAuthorityVersion
    });
    if (applied === 'stale') {
      throw new Error('callback_registration_local_owner_conflict');
    }
  } catch (error) {
    await markRegistrationFailure({ callbackInstanceOid: callbackInstance.oid });
    if (d.throwOnError) throw error;
  }
};
