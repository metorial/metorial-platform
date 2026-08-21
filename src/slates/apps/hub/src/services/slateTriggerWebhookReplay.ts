import { createHash, createHmac, randomUUID } from 'node:crypto';
import { canonicalizeJsonJcs, parseWebhookWireResponse } from '@slates/proto';
import { Prisma } from '../../prisma/generated/client';
import { db } from '../db';
import { env } from '../env';
import { getId } from '../id';
import type {
  WebhookAtomicCommitInput,
  WebhookAtomicCommitResult,
  WebhookAtomicDispatch,
  WebhookAtomicSync
} from '../lib/webhookVerification';
import { slateTriggerEventProcessQueue } from '../queues/trigger/eventQueues';
import { signal } from '../signal';
import { persistCapturedCallbackSecretsInTransaction } from './slateTriggerReceiverSecret';

export let WEBHOOK_REPLAY_DEFAULT_RETENTION_MS = 24 * 60 * 60 * 1000;
export let WEBHOOK_OUTBOX_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;
export let WEBHOOK_OUTBOX_LEASE_MS = 30_000;
export let WEBHOOK_OUTBOX_MAX_ATTEMPTS = 8;
export let WEBHOOK_STORED_PAYLOAD_MAX_BYTES = 4 * 1024 * 1024;

export let computeWebhookOutboxBackoffMs = (d: { attemptCount: number; random?: number }) => {
  if (!Number.isInteger(d.attemptCount) || d.attemptCount < 1) {
    throw new Error('Webhook outbox attempt count is invalid');
  }
  let capMs = Math.min(15 * 60_000, 1000 * 2 ** (d.attemptCount - 1));
  let random = d.random ?? Math.random();
  if (!Number.isFinite(random) || random < 0 || random >= 1) {
    throw new Error('Webhook outbox jitter source is invalid');
  }
  return capMs + Math.floor(random * Math.max(1, Math.floor(capMs / 4)));
};

let hashValue = (domain: string, value: unknown) =>
  createHash('sha256')
    .update(`${domain}\0v1\0`, 'utf8')
    .update(canonicalizeJsonJcs(value))
    .digest('hex');

let replayKey = () => env.encryption.ENCRYPTION_KEY;

let assertBoundedStoredPayload = (value: unknown) => {
  if (Buffer.byteLength(JSON.stringify(value), 'utf8') > WEBHOOK_STORED_PAYLOAD_MAX_BYTES) {
    throw new Error('mapped_output_invalid');
  }
};

export let hashAuthenticatedWebhookDeliveryId = (d: {
  receiverTriggerId: string;
  specHash: string;
  ruleId: string;
  itemBindingHash: string;
  deliveryId: string;
}) =>
  createHmac('sha256', replayKey())
    .update('metorial.webhook-replay-delivery\0v1\0', 'utf8')
    .update(canonicalizeJsonJcs(d), 'utf8')
    .digest('hex');

export let computeHubSignalIdempotencyKey = (d: {
  tenantId: string;
  receiverTriggerId: string;
  specHash: string;
  ruleId: string;
  deliveryIdHash: string;
  itemBindingHash: string;
  adapterVersion: number;
  originalRequestHash: string;
  dispatchRequestHash: string;
  outboxId: string;
  eventInputId: string;
}) => hashValue('metorial.hub-signal-idempotency', d);

export type HubSignalIdempotentRequest = {
  tenantId: string;
  senderId: string;
  idempotencyKey: string;
  topics: string[];
  eventType: string;
  payloadJson: string;
  headers: Record<string, string>;
  onlyForDestinations?: string[];
  callbackId?: string;
  callbackInstanceId?: string;
  callbackSourceId?: string;
  callbackTriggerId?: string;
};

let parseHubSignalIdempotentRequest = (value: unknown): HubSignalIdempotentRequest => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error('Webhook outbox Signal request is invalid');
  }
  let requiredString = (name: string) => {
    let field = Reflect.get(value, name);
    if (typeof field !== 'string') throw new Error('Webhook outbox Signal request is invalid');
    return field;
  };
  let optionalString = (name: string) => {
    let field = Reflect.get(value, name);
    if (field === undefined) return undefined;
    if (typeof field !== 'string') throw new Error('Webhook outbox Signal request is invalid');
    return field;
  };
  let stringArray = (name: string, optional = false) => {
    let field = Reflect.get(value, name);
    if (optional && field === undefined) return undefined;
    if (!Array.isArray(field) || field.some(item => typeof item !== 'string')) {
      throw new Error('Webhook outbox Signal request is invalid');
    }
    return field;
  };
  let rawHeaders = Reflect.get(value, 'headers');
  if (typeof rawHeaders !== 'object' || rawHeaders === null || Array.isArray(rawHeaders)) {
    throw new Error('Webhook outbox Signal request is invalid');
  }
  let headers = Object.fromEntries(
    Object.entries(rawHeaders).map(([name, headerValue]) => {
      if (typeof headerValue !== 'string') {
        throw new Error('Webhook outbox Signal request is invalid');
      }
      return [name, headerValue];
    })
  );
  return {
    tenantId: requiredString('tenantId'),
    senderId: requiredString('senderId'),
    idempotencyKey: requiredString('idempotencyKey'),
    topics: stringArray('topics')!,
    eventType: requiredString('eventType'),
    payloadJson: requiredString('payloadJson'),
    headers,
    onlyForDestinations: stringArray('onlyForDestinations', true),
    callbackId: optionalString('callbackId'),
    callbackInstanceId: optionalString('callbackInstanceId'),
    callbackSourceId: optionalString('callbackSourceId'),
    callbackTriggerId: optionalString('callbackTriggerId')
  };
};

let canonicalSignalHeaders = (headers: Record<string, string>) => {
  let normalized = new Map<string, string>();
  for (let [name, value] of Object.entries(headers)) {
    let key = name.toLowerCase();
    if (!key || normalized.has(key)) {
      throw new Error('Webhook outbox Signal headers are ambiguous');
    }
    normalized.set(key, value);
  }
  return [...normalized.entries()].sort(([first], [second]) => first.localeCompare(second));
};

export let computeHubSignalRequestFingerprint = (request: HubSignalIdempotentRequest) =>
  createHash('sha256')
    .update('metorial.signal-event-request\0v1\0', 'utf8')
    .update(
      canonicalizeJsonJcs({
        tenantId: request.tenantId,
        senderId: request.senderId,
        topics: [...new Set(request.topics)].sort(),
        eventType: request.eventType,
        payloadJson: request.payloadJson,
        headers: canonicalSignalHeaders(request.headers),
        onlyForDestinations:
          request.onlyForDestinations === undefined
            ? null
            : [...new Set(request.onlyForDestinations)].sort(),
        callbackId: request.callbackId ?? null,
        callbackInstanceId: request.callbackInstanceId ?? null,
        callbackSourceId: request.callbackSourceId ?? null,
        callbackTriggerId: request.callbackTriggerId ?? null
      })
    )
    .digest('hex');

type PreparedIdentity = {
  candidateId: string;
  itemBindingHash: string;
  deliveryIdHashes: string[];
  deliveryIdHash: string;
};

let dispatchIdentities = (dispatch: WebhookAtomicDispatch): PreparedIdentity[] =>
  dispatch.inputs.map((_, index) => {
    let candidateId =
      typeof dispatch.inputs[index]?.candidateId === 'string'
        ? String(dispatch.inputs[index]!.candidateId)
        : `receiver:${index}`;
    let candidate = dispatch.bindings.selectedItems.find(
      selected => selected.candidateId === candidateId
    );
    let itemBindingHash =
      candidate?.bindingHash ??
      hashValue('metorial.webhook-replay-item', {
        receiverTriggerId: dispatch.bindings.receiverTriggerId,
        ruleId: dispatch.bindings.ruleId,
        index
      });
    let deliveryIds = candidate?.deliveryIds.length
      ? [...candidate.deliveryIds]
      : [...dispatch.replayKeys];
    let deliveryIdHashes = deliveryIds
      .map(deliveryId =>
        hashAuthenticatedWebhookDeliveryId({
          receiverTriggerId: dispatch.bindings.receiverTriggerId,
          specHash: dispatch.bindings.specHash,
          ruleId: dispatch.bindings.ruleId,
          itemBindingHash,
          deliveryId
        })
      )
      .sort();
    return {
      candidateId,
      itemBindingHash,
      deliveryIdHashes,
      deliveryIdHash: hashValue('metorial.webhook-replay-delivery-set', deliveryIdHashes)
    };
  });

let syncIdentity = (sync: WebhookAtomicSync): PreparedIdentity => {
  let itemBindingHash = hashValue('metorial.webhook-replay-sync-item', {
    receiverTriggerId: sync.bindings.receiverTriggerId,
    ruleId: sync.bindings.ruleId,
    selectedItems: sync.bindings.selectedItems.map(item => item.bindingHash)
  });
  let deliveryIds = sync.replayClaim?.deliveryIds.length
    ? [...sync.replayClaim.deliveryIds]
    : [...sync.replayKeys];
  let deliveryIdHashes = deliveryIds
    .map(deliveryId =>
      hashAuthenticatedWebhookDeliveryId({
        receiverTriggerId: sync.bindings.receiverTriggerId,
        specHash: sync.bindings.specHash,
        ruleId: sync.bindings.ruleId,
        itemBindingHash,
        deliveryId
      })
    )
    .sort();
  return {
    candidateId: 'sync',
    itemBindingHash,
    deliveryIdHashes,
    deliveryIdHash: hashValue('metorial.webhook-replay-delivery-set', deliveryIdHashes)
  };
};

let adapterVersion = (adapterId?: string) =>
  adapterId === 'graph.body_value.v1' ? 1 : 0;

let claimWhere = (d: {
  receiverTriggerId: string;
  specHash: string;
  ruleId: string;
  itemBindingHash: string;
  deliveryIdHash: string;
}) => ({
  receiverTrigger: { id: d.receiverTriggerId },
  specHash: d.specHash,
  ruleId: d.ruleId,
  itemBindingHash: d.itemBindingHash,
  deliveryIdHash: d.deliveryIdHash
});

let responseFromClaim = (claim: { syncResponse: unknown }) => {
  if (claim.syncResponse === null || claim.syncResponse === undefined) return undefined;
  return parseWebhookWireResponse(claim.syncResponse);
};

export let classifySignalDispatchError = (error: unknown) => {
  let value =
    typeof error === 'object' && error !== null
      ? error
      : {};
  let code = 'code' in value && typeof value.code === 'string' ? value.code : '';
  let status = 'status' in value && typeof value.status === 'number' ? value.status : undefined;
  if (code === 'idempotency_payload_conflict') return { terminal: true, code };
  if (status === 401 || code === 'unauthorized') return { terminal: true, code: 'unauthorized' };
  if (status === 403 || code === 'forbidden') return { terminal: true, code: 'forbidden' };
  if (status !== undefined && status >= 400 && status < 500) {
    return { terminal: true, code: 'signal_request_invalid' };
  }
  return { terminal: false, code: 'signal_transport' };
};

export class SlateTriggerWebhookReplayService {
  async lookupBeforeMapping(d: {
    bindings: WebhookAtomicDispatch['bindings'];
    replayKeys: readonly string[];
    selectedItems: WebhookAtomicDispatch['bindings']['selectedItems'];
    kind: 'sync_response' | 'dispatch';
  }) {
    let identities =
      d.kind === 'sync_response'
        ? [syncIdentity({
            bindings: d.bindings,
            response: { status: 204, headers: [], body: { present: false } },
            capturedSecrets: {},
            replayKeys: d.replayKeys,
            replayTtlSeconds: 1
          })]
        : dispatchIdentities({
            bindings: d.bindings,
            acceptedRequest: {
              url: 'https://replay.invalid/',
              method: 'POST',
              headers: [],
              body: { present: false }
            },
            inputs: d.selectedItems.map(item => ({ candidateId: item.candidateId })),
            replayKeys: d.replayKeys,
            replayTtlSeconds: 1
          });
    let claims = await Promise.all(
      identities.map(identity =>
        db.slateTriggerWebhookReplayClaim.findFirst({
          where: claimWhere({
            receiverTriggerId: d.bindings.receiverTriggerId,
            specHash: d.bindings.specHash,
            ruleId: d.bindings.ruleId,
            itemBindingHash: identity.itemBindingHash,
            deliveryIdHash: identity.deliveryIdHash
          })
        })
      )
    );
    return {
      duplicateCandidateIds: identities.flatMap((identity, index) =>
        claims[index] ? [identity.candidateId] : []
      ),
      response: claims.flatMap(claim => {
        if (!claim) return [];
        let response = responseFromClaim(claim);
        return response ? [response] : [];
      })[0]
    };
  }

  async commit(input: WebhookAtomicCommitInput): Promise<WebhookAtomicCommitResult> {
    let now = new Date();
    let request = await db.slateTriggerWebhookRequest.findUnique({
      where: { id: input.requestId }
    });
    if (
      !request ||
      request.receiverOwnerId !== input.receiverId ||
      request.requestHash !== input.originalRequestHash ||
      !request.capturedRequest ||
      !request.capturedRequestExpiresAt ||
      request.capturedRequestExpiresAt <= now
    ) return { status: 'rejected', code: 'mapped_output_invalid' };

    let duplicates: { commitId: string; response?: ReturnType<typeof parseWebhookWireResponse> }[] = [];
    for (let sync of input.syncs) {
      let identity = syncIdentity(sync);
      let existing = await db.slateTriggerWebhookReplayClaim.findFirst({
        where: claimWhere({
          receiverTriggerId: sync.bindings.receiverTriggerId,
          specHash: sync.bindings.specHash,
          ruleId: sync.bindings.ruleId,
          itemBindingHash: identity.itemBindingHash,
          deliveryIdHash: identity.deliveryIdHash
        })
      });
      if (existing) {
        if (existing.originalRequestHash !== input.originalRequestHash) {
          return { status: 'rejected', code: 'replay_conflict' };
        }
        duplicates.push({ commitId: existing.id, response: responseFromClaim(existing) });
      }
    }
    for (let dispatch of input.dispatches) {
      for (let identity of dispatchIdentities(dispatch)) {
        let existing = await db.slateTriggerWebhookReplayClaim.findFirst({
          where: claimWhere({
            receiverTriggerId: dispatch.bindings.receiverTriggerId,
            specHash: dispatch.bindings.specHash,
            ruleId: dispatch.bindings.ruleId,
            itemBindingHash: identity.itemBindingHash,
            deliveryIdHash: identity.deliveryIdHash
          })
        });
        if (existing) {
          if (existing.originalRequestHash !== input.originalRequestHash) {
            return { status: 'rejected', code: 'replay_conflict' };
          }
          duplicates.push({ commitId: existing.id });
        }
      }
    }
    let total = input.syncs.length + input.dispatches.reduce(
      (count, dispatch) => count + dispatch.inputs.length,
      0
    );
    if (total > 0 && duplicates.length === total) {
      return {
        status: 'duplicate',
        commitId: duplicates[0]!.commitId,
        response: duplicates.find(duplicate => duplicate.response)?.response
      };
    }
    if (duplicates.length > 0) return { status: 'rejected', code: 'replay_conflict' };

    try {
      let created = await db.$transaction(async tx => {
        let createdIds: string[] = [];
        for (let dispatch of input.dispatches) {
          let trigger = await tx.slateTriggerReceiverTrigger.findUnique({
            where: { id: dispatch.bindings.receiverTriggerId },
            include: {
              boundSecrets: { include: { secret: { select: { id: true } } } },
              receiver: { include: { tenant: true } }
            }
          });
          if (
            !trigger ||
            trigger.receiver.id !== input.receiverId ||
            trigger.tombstonedAt ||
            trigger.ingressDisabledAt ||
            trigger.registrationGeneration !== dispatch.bindings.registrationGeneration ||
            trigger.registrationVersion !== dispatch.bindings.registrationVersion ||
            trigger.verificationSpecHash !== dispatch.bindings.specHash
          ) throw new Error('mapped_output_invalid');

          if (dispatch.proposedState) {
            let updated = await tx.slateTriggerReceiverTrigger.updateMany({
              where: {
                oid: trigger.oid,
                authoritativeStateVersion: dispatch.proposedState.expectedPriorVersion
              },
              data: {
                state: dispatch.proposedState.value as Prisma.InputJsonValue,
                authoritativeStateVersion: { increment: 1 }
              }
            });
            if (updated.count !== 1) throw new Error('state_cas_conflict');
          }

          let identities = dispatchIdentities(dispatch);
          for (let [index, identity] of identities.entries()) {
            let eventInputId = getId('slateTriggerEventInput');
            let claimId = getId('slateTriggerWebhookReplayClaim');
            let outboxId = getId('slateTriggerWebhookDispatchOutbox');
            let acceptedPayload = dispatch.inputs[index]!;
            assertBoundedStoredPayload(acceptedPayload);
            let retentionExpiresAt = new Date(now.getTime() + WEBHOOK_OUTBOX_RETENTION_MS);
            await tx.slateTriggerEventInput.create({
              data: {
                ...eventInputId,
                receiverOid: trigger.receiverOid,
                receiverTriggerOid: trigger.oid,
                actionOid: trigger.actionOid,
                slateOid: trigger.receiver.slateOid,
                slateInstanceOid: trigger.receiver.slateInstanceOid,
                input: acceptedPayload as Prisma.InputJsonValue
              }
            });
            let callbackSecretIds = trigger.boundSecrets.map(binding => binding.secret.id).sort();
            let claim = await tx.slateTriggerWebhookReplayClaim.create({
              data: {
                ...claimId,
                receiverOid: trigger.receiverOid,
                receiverTriggerOid: trigger.oid,
                requestOid: request.oid,
                eventInputOid: eventInputId.oid,
                kind: 'dispatch',
                status: 'queued',
                specHash: dispatch.bindings.specHash,
                ruleId: dispatch.bindings.ruleId,
                itemBindingHash: identity.itemBindingHash,
                deliveryIdHash: identity.deliveryIdHash,
                itemAdapterId: dispatch.bindings.itemAdapterId,
                itemAdapterVersion: adapterVersion(dispatch.bindings.itemAdapterId),
                originalRequestHash: input.originalRequestHash,
                dispatchRequestHash: dispatch.bindings.dispatchRequestHash,
                callbackSecretIds,
                expiresAt: retentionExpiresAt
              }
            });
            let signalIdempotencyKey = computeHubSignalIdempotencyKey({
              tenantId: trigger.receiver.tenant.id,
              receiverTriggerId: trigger.id,
              specHash: dispatch.bindings.specHash,
              ruleId: dispatch.bindings.ruleId,
              deliveryIdHash: identity.deliveryIdHash,
              itemBindingHash: identity.itemBindingHash,
              adapterVersion: adapterVersion(dispatch.bindings.itemAdapterId),
              originalRequestHash: input.originalRequestHash,
              dispatchRequestHash: dispatch.bindings.dispatchRequestHash,
              outboxId: outboxId.id,
              eventInputId: eventInputId.id
            });
            await tx.slateTriggerWebhookDispatchOutbox.create({
              data: {
                ...outboxId,
                receiverOid: trigger.receiverOid,
                receiverTriggerOid: trigger.oid,
                replayClaimOid: claim.oid,
                eventInputOid: eventInputId.oid,
                tenantId: trigger.receiver.tenant.id,
                adapterCandidateId: identity.candidateId,
                itemBindingHash: identity.itemBindingHash,
                deliveryIdHashes: identity.deliveryIdHashes,
                itemAdapterId: dispatch.bindings.itemAdapterId,
                itemAdapterVersion: adapterVersion(dispatch.bindings.itemAdapterId),
                originalRequestHash: input.originalRequestHash,
                dispatchRequestHash: dispatch.bindings.dispatchRequestHash,
                acceptedPayload: acceptedPayload as Prisma.InputJsonValue,
                acceptedPayloadExpiresAt: retentionExpiresAt,
                signalIdempotencyKey,
                localEventId: getId('slateTriggerEvent').id,
                localSourceId: hashValue('metorial.webhook-local-source', {
                  claimId: claim.id,
                  candidateId: identity.candidateId
                }),
                retentionExpiresAt
              }
            });
            createdIds.push(eventInputId.id);
          }
        }

        for (let sync of input.syncs) {
          let trigger = await tx.slateTriggerReceiverTrigger.findUnique({
            where: { id: sync.bindings.receiverTriggerId },
            include: {
              boundSecrets: { include: { secret: { select: { id: true } } } },
              receiver: true
            }
          });
          if (
            !trigger ||
            trigger.receiver.id !== input.receiverId ||
            trigger.tombstonedAt ||
            trigger.ingressDisabledAt ||
            trigger.registrationGeneration !== sync.bindings.registrationGeneration ||
            trigger.registrationVersion !== sync.bindings.registrationVersion ||
            trigger.verificationSpecHash !== sync.bindings.specHash
          ) throw new Error('mapped_output_invalid');
          let identity = syncIdentity(sync);
          assertBoundedStoredPayload(sync.response);
          await persistCapturedCallbackSecretsInTransaction({
            tx,
            receiverTriggerId: trigger.id,
            capturedSecrets: sync.capturedSecrets
          });
          let callbackSecretIds = (
            await tx.slateTriggerReceiverSecret.findMany({
              where: { receiverTriggerOid: trigger.oid },
              select: { secret: { select: { id: true } } }
            })
          )
            .map(binding => binding.secret.id)
            .sort();
          await tx.slateTriggerWebhookReplayClaim.create({
            data: {
              ...getId('slateTriggerWebhookReplayClaim'),
              receiverOid: trigger.receiverOid,
              receiverTriggerOid: trigger.oid,
              requestOid: request.oid,
              kind: 'sync_response',
              status: 'responded',
              specHash: sync.bindings.specHash,
              ruleId: sync.bindings.ruleId,
              itemBindingHash: identity.itemBindingHash,
              deliveryIdHash: identity.deliveryIdHash,
              itemAdapterId: sync.bindings.itemAdapterId,
              itemAdapterVersion: adapterVersion(sync.bindings.itemAdapterId),
              originalRequestHash: input.originalRequestHash,
              dispatchRequestHash: sync.bindings.dispatchRequestHash,
              callbackSecretIds,
              syncResponse: sync.response as Prisma.InputJsonValue,
              syncResponseExpiresAt: new Date(
                now.getTime() + Math.max(1, sync.replayTtlSeconds) * 1000
              ),
              expiresAt: new Date(
                now.getTime() +
                  Math.max(
                    WEBHOOK_REPLAY_DEFAULT_RETENTION_MS,
                    Math.max(1, sync.replayTtlSeconds) * 1000
                  )
              )
            }
          });
        }

        await tx.slateTriggerWebhookRequest.update({
          where: { oid: request.oid },
          data: {
            capturedRequestExpiresAt: new Date(
              Math.max(
                request.capturedRequestExpiresAt!.getTime(),
                now.getTime() + WEBHOOK_OUTBOX_RETENTION_MS
              )
            )
          }
        });
        return createdIds;
      });

      if (created.length) {
        await slateTriggerEventProcessQueue.addManyWithOps(
          created.map(eventInputId => ({
            data: { eventInputId },
            opts: { id: eventInputId }
          }))
        );
      }
      return {
        status: 'committed',
        commitId: hashValue('metorial.webhook-atomic-commit', input)
      };
    } catch (error) {
      if (error instanceof Error && error.message === 'state_cas_conflict') {
        return { status: 'rejected', code: 'state_cas_conflict' };
      }
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        return { status: 'rejected', code: 'replay_conflict' };
      }
      return { status: 'rejected', code: 'mapped_output_invalid' };
    }
  }

  async claimDueOutbox(d: { owner?: string; now?: Date; leaseMs?: number }) {
    let now = d.now ?? new Date();
    let candidate = await db.slateTriggerWebhookDispatchOutbox.findFirst({
      where: {
        readyAt: { not: null, lte: now },
        nextAttemptAt: { lte: now },
        OR: [
          { status: { in: ['pending', 'retryable'] } },
          { status: 'leased', leaseExpiresAt: { lte: now } }
        ]
      },
      orderBy: [{ nextAttemptAt: 'asc' }, { oid: 'asc' }]
    });
    if (!candidate) return null;
    return await this.claimOutbox({
      outboxId: candidate.id,
      owner: d.owner ?? `hub-outbox:${randomUUID()}`,
      now,
      leaseMs: d.leaseMs
    });
  }

  async claimOutbox(d: { outboxId: string; owner: string; now?: Date; leaseMs?: number }) {
    let now = d.now ?? new Date();
    let leaseMs = d.leaseMs ?? WEBHOOK_OUTBOX_LEASE_MS;
    let claimed = await db.slateTriggerWebhookDispatchOutbox.updateMany({
      where: {
        id: d.outboxId,
        readyAt: { not: null, lte: now },
        nextAttemptAt: { lte: now },
        OR: [
          { status: { in: ['pending', 'retryable'] } },
          { status: 'leased', leaseExpiresAt: { lte: now } }
        ]
      },
      data: {
        status: 'leased',
        leaseOwner: d.owner,
        leaseExpiresAt: new Date(now.getTime() + leaseMs),
        attemptCount: { increment: 1 }
      }
    });
    if (claimed.count !== 1) return null;
    return await db.slateTriggerWebhookDispatchOutbox.findUnique({
      where: { id: d.outboxId }
    });
  }

  async renewLease(d: { outboxId: string; owner: string; now?: Date; leaseMs?: number }) {
    let now = d.now ?? new Date();
    let renewed = await db.slateTriggerWebhookDispatchOutbox.updateMany({
      where: {
        id: d.outboxId,
        status: 'leased',
        leaseOwner: d.owner,
        leaseExpiresAt: { gt: now }
      },
      data: { leaseExpiresAt: new Date(now.getTime() + (d.leaseMs ?? WEBHOOK_OUTBOX_LEASE_MS)) }
    });
    return renewed.count === 1;
  }

  async retryLeased(d: { outboxId: string; owner: string; safeCode: string; now?: Date }) {
    let now = d.now ?? new Date();
    let current = await db.slateTriggerWebhookDispatchOutbox.findFirst({
      where: { id: d.outboxId, status: 'leased', leaseOwner: d.owner }
    });
    if (!current) return false;
    if (current.attemptCount >= WEBHOOK_OUTBOX_MAX_ATTEMPTS) {
      return await this.deadLetter({ ...d, now });
    }
    let updated = await db.slateTriggerWebhookDispatchOutbox.updateMany({
      where: { oid: current.oid, status: 'leased', leaseOwner: d.owner },
      data: {
        status: 'retryable',
        leaseOwner: null,
        leaseExpiresAt: null,
        safeTerminalCode: d.safeCode,
        nextAttemptAt: new Date(
          now.getTime() + computeWebhookOutboxBackoffMs({ attemptCount: current.attemptCount })
        )
      }
    });
    return updated.count === 1;
  }

  async deadLetter(d: { outboxId: string; owner: string; safeCode: string; now?: Date }) {
    let now = d.now ?? new Date();
    return await db.$transaction(async tx => {
      let outbox = await tx.slateTriggerWebhookDispatchOutbox.findFirst({
        where: { id: d.outboxId, status: 'leased', leaseOwner: d.owner }
      });
      if (!outbox) return false;
      let updated = await tx.slateTriggerWebhookDispatchOutbox.updateMany({
        where: { oid: outbox.oid, status: 'leased', leaseOwner: d.owner },
        data: {
          status: 'dead_letter',
          leaseOwner: null,
          leaseExpiresAt: null,
          safeTerminalCode: d.safeCode,
          deadLetterMetadata: { code: d.safeCode, at: now.toISOString() }
        }
      });
      if (updated.count !== 1) return false;
      await tx.slateTriggerWebhookReplayClaim.update({
        where: { oid: outbox.replayClaimOid },
        data: { status: 'failed_terminal', leaseExpiresAt: null }
      });
      return true;
    });
  }

  async confirmDelivered(d: {
    outboxId: string;
    owner: string;
    signalEventId: string;
    now?: Date;
  }) {
    let now = d.now ?? new Date();
    return await db.$transaction(async tx => {
      let outbox = await tx.slateTriggerWebhookDispatchOutbox.findFirst({
        where: { id: d.outboxId, status: 'leased', leaseOwner: d.owner }
      });
      if (!outbox) return false;
      let updated = await tx.slateTriggerWebhookDispatchOutbox.updateMany({
        where: { oid: outbox.oid, status: 'leased', leaseOwner: d.owner },
        data: {
          status: 'delivered',
          leaseOwner: null,
          leaseExpiresAt: null,
          deliveredAt: now,
          confirmedSignalEventId: d.signalEventId
        }
      });
      if (updated.count !== 1) return false;
      await tx.slateTriggerWebhookReplayClaim.update({
        where: { oid: outbox.replayClaimOid },
        data: { status: 'delivered', leaseExpiresAt: null }
      });
      await tx.slateTriggerEvent.updateMany({
        where: { id: outbox.localEventId },
        data: { signalEventId: d.signalEventId, deliveryStatus: 'sent' }
      });
      return true;
    });
  }

  async recordFilteredCallbackEvent() {
    return null;
  }

  async confirmFiltered(d: { outboxId: string; owner: string; now?: Date }) {
    return await this.confirmDelivered({
      ...d,
      signalEventId: ''
    });
  }

  async redrive(d: { outboxId: string; tenantId: string; now?: Date }) {
    let now = d.now ?? new Date();
    let updated = await db.slateTriggerWebhookDispatchOutbox.updateMany({
      where: {
        id: d.outboxId,
        tenantId: d.tenantId,
        status: 'dead_letter',
        retentionExpiresAt: { gt: now }
      },
      data: {
        status: 'retryable',
        attemptCount: 0,
        nextAttemptAt: now,
        safeTerminalCode: null,
        deadLetterMetadata: Prisma.DbNull
      }
    });
    return updated.count === 1;
  }

  async dispatchLeased(d: {
    outboxId: string;
    owner: string;
    beforeLeaseRelease?: () => Promise<void>;
  }) {
    let outbox = await db.slateTriggerWebhookDispatchOutbox.findFirst({
      where: { id: d.outboxId, status: 'leased', leaseOwner: d.owner }
    });
    if (!outbox || !outbox.signalRequest || !outbox.signalRequestFingerprint) {
      throw new Error('Webhook outbox is not ready for Signal dispatch');
    }
    let request = parseHubSignalIdempotentRequest(outbox.signalRequest);
    if (computeHubSignalRequestFingerprint(request) !== outbox.signalRequestFingerprint) {
      throw new Error('Webhook outbox Signal fingerprint conflict');
    }
    let event;
    try {
      event = await signal.event.createIdempotent(request);
    } catch (error) {
      let classified = classifySignalDispatchError(error);
      if (classified.terminal) {
        await this.deadLetter({
          outboxId: outbox.id,
          owner: d.owner,
          safeCode: classified.code
        });
        throw error;
      }
      try {
        event = await signal.event.getByIdempotencyKey({
          tenantId: request.tenantId,
          idempotencyKey: request.idempotencyKey
        });
      } catch {
        throw error;
      }
    }
    if (event.requestFingerprint !== outbox.signalRequestFingerprint) {
      await this.deadLetter({
        outboxId: outbox.id,
        owner: d.owner,
        safeCode: 'idempotency_payload_conflict'
      });
      throw new Error('Signal idempotency request fingerprint conflict');
    }
    await d.beforeLeaseRelease?.();
    let confirmed = await this.confirmDelivered({
      outboxId: outbox.id,
      owner: d.owner,
      signalEventId: event.id
    });
    if (!confirmed) throw new Error('Webhook outbox delivery ownership was lost');
    return event;
  }
}

export let slateTriggerWebhookReplayService = new SlateTriggerWebhookReplayService();
