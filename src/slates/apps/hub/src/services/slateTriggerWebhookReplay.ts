import {
  AmbiguousCanonicalHeadersError,
  computeIdempotentEventRequestFingerprintV1
} from '@metorial-platform-systems/signal-protocol';
import { createHash, createHmac, randomUUID } from 'node:crypto';
import { computeWebhookActionSpecHashV1, slatesWebhookHttp } from '@slates/proto';
import {
  Prisma,
  SlateTriggerEventDeliveryStatus,
  SlateTriggerReceiverDeliveryMode
} from '../../prisma/generated/client';
import { db } from '../db';
import { createHubVersionedEncryptionKeyring } from '../encryption';
import { env } from '../env';
import { getId } from '../id';
import type {
  WebhookAtomicCommitInput,
  WebhookAtomicDispatch,
  WebhookAtomicSync,
  WebhookAtomicCommitResult
} from '../lib/webhookVerification';
import { computeWebhookStateHash } from '../lib/webhookVerification';
import { computeWebhookWireRequestHash, parseWebhookWireRequest } from '../lib/webhookWire';
import { prepareWebhookItemAdapter } from '../lib/webhookVerification/itemAdapters';
import {
  decryptWebhookRequestPayloadEnvelope,
  encryptWebhookRequestPayload
} from './slateTriggerWebhookRequestCrypto';
import { slateTriggerReceiverSecretService } from './slateTriggerReceiverSecret';
import { signal } from '../signal';
import { slateTriggerEventProcessQueue } from '../queues/trigger/eventQueues';
import { recordCallbackEventLifecycle } from './callbackEventLifecycle';

export let WEBHOOK_REPLAY_DEFAULT_RETENTION_MS = 24 * 60 * 60 * 1000;
export let WEBHOOK_OUTBOX_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;
export let WEBHOOK_OUTBOX_LEASE_MS = 30_000;
export let WEBHOOK_OUTBOX_MAX_ATTEMPTS = 8;

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

let canonicalJson = (value: unknown): string => {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') {
    return JSON.stringify(value);
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error('Canonical number must be finite');
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (typeof value === 'object' && value !== null) {
    let record = value as Record<string, unknown>;
    return `{${Object.keys(record)
      .filter(key => record[key] !== undefined)
      .sort()
      .map(key => `${JSON.stringify(key)}:${canonicalJson(record[key])}`)
      .join(',')}}`;
  }
  throw new Error('Value is outside canonical JSON');
};

let replayKey = () => env.slates.SLATES_WEBHOOK_REPLAY_KEY ?? env.encryption.ENCRYPTION_KEY;

export let hashAuthenticatedWebhookDeliveryId = (d: {
  receiverTriggerId: string;
  specHash: string;
  ruleId: string;
  itemBindingHash: string;
  deliveryId: string;
}) =>
  createHmac('sha256', replayKey())
    .update('metorial.webhook-replay-delivery\0v1\0', 'utf8')
    .update(canonicalJson(d), 'utf8')
    .digest('hex');

let hashValue = (domain: string, value: unknown) =>
  createHash('sha256')
    .update(`${domain}\0v1\0`, 'utf8')
    .update(canonicalJson(value), 'utf8')
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

export let computeHubSignalRequestFingerprint = (request: HubSignalIdempotentRequest) => {
  try {
    return computeIdempotentEventRequestFingerprintV1(request);
  } catch (error) {
    if (error instanceof AmbiguousCanonicalHeadersError) {
      throw new Error('Non-canonical Signal headers');
    }
    throw error;
  }
};

let getReplayResponseKeyring = () => createHubVersionedEncryptionKeyring();

let syncResponseContext = (d: {
  claimId: string;
  receiverTriggerId: string;
  specHash: string;
  ruleId: string;
  keyVersion: number;
  aadVersion: number;
}) => ['metorial', 'webhook-sync-response', 'v1', ...Object.values(d)].join('|');

let encryptSyncResponse = async (d: {
  claimId: string;
  receiverTriggerId: string;
  specHash: string;
  ruleId: string;
  response: unknown;
}) => {
  let keyring = getReplayResponseKeyring();
  let keyVersion = keyring.activeKeyVersion;
  let aadVersion = env.encryption.ENCRYPTION_ACTIVE_AAD_VERSION ?? 1;
  return {
    encrypted: await keyring.encrypt({
      secret: canonicalJson(d.response),
      entityId: syncResponseContext({
        claimId: d.claimId,
        receiverTriggerId: d.receiverTriggerId,
        specHash: d.specHash,
        ruleId: d.ruleId,
        keyVersion,
        aadVersion
      }),
      encryptionKeyVersion: keyVersion,
      aadVersion
    }),
    keyVersion,
    aadVersion
  };
};

let decryptSyncResponse = async (claim: {
  id: string;
  receiverTrigger: { id: string };
  specHash: string;
  ruleId: string;
  encryptedSyncResponse: string | null;
  syncResponseEncryptionKeyVersion: number | null;
  syncResponseAadVersion: number | null;
}) => {
  if (
    !claim.encryptedSyncResponse ||
    claim.syncResponseEncryptionKeyVersion === null ||
    claim.syncResponseAadVersion === null
  )
    return undefined;
  let plaintext = await getReplayResponseKeyring().decrypt({
    encrypted: claim.encryptedSyncResponse,
    entityId: syncResponseContext({
      claimId: claim.id,
      receiverTriggerId: claim.receiverTrigger.id,
      specHash: claim.specHash,
      ruleId: claim.ruleId,
      keyVersion: claim.syncResponseEncryptionKeyVersion,
      aadVersion: claim.syncResponseAadVersion
    }),
    encryptionKeyVersion: claim.syncResponseEncryptionKeyVersion,
    aadVersion: claim.syncResponseAadVersion
  });
  return JSON.parse(plaintext);
};

type PreparedIdentity = {
  itemBindingHash: string;
  deliveryIdHashes: string[];
  deliveryIdHash: string;
  candidateId: string;
};

let identitiesForDispatch = (dispatch: WebhookAtomicDispatch): PreparedIdentity[] =>
  dispatch.inputs.map((input, index) => {
    let candidateId =
      typeof input.candidateId === 'string' ? input.candidateId : `receiver:${index}`;
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

let identityForSync = (sync: WebhookAtomicSync): PreparedIdentity => {
  let itemBindingHash = hashValue('metorial.webhook-replay-sync-item', {
    receiverTriggerId: sync.bindings.receiverTriggerId,
    ruleId: sync.bindings.ruleId,
    selectedItems: sync.bindings.selectedItems.map(item => item.bindingHash)
  });
  let rawIds = sync.replayClaim?.deliveryIds.length
    ? [...sync.replayClaim.deliveryIds]
    : [...sync.replayKeys];
  let deliveryIdHashes = rawIds
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

let isUniqueConflict = (error: unknown) =>
  typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002';

export let classifySignalDispatchError = (error: unknown) => {
  let data =
    typeof error === 'object' && error !== null && 'data' in error
      ? (error as { data?: { code?: unknown; status?: unknown } }).data
      : undefined;
  let code = typeof data?.code === 'string' ? data.code : '';
  let status = typeof data?.status === 'number' ? data.status : undefined;
  if (code === 'idempotency_payload_conflict') {
    return { type: 'terminal' as const, safeCode: code };
  }
  if (status === 401 || code === 'unauthorized') {
    return { type: 'terminal' as const, safeCode: 'signal_authentication_failed' };
  }
  if (status === 403 || code === 'forbidden') {
    return { type: 'terminal' as const, safeCode: 'signal_authorization_failed' };
  }
  if (status !== undefined && status >= 400 && status < 500) {
    return { type: 'terminal' as const, safeCode: 'signal_request_rejected' };
  }
  if (status !== undefined && status >= 500) {
    return { type: 'ambiguous' as const, safeCode: 'signal_server_error' };
  }
  return { type: 'ambiguous' as const, safeCode: 'signal_transport' };
};

class AtomicCommitRejection extends Error {
  constructor(
    readonly code: 'replay_conflict' | 'state_cas_conflict' | 'mapped_output_invalid'
  ) {
    super(code);
  }
}

let adapterVersion = (adapterId: string | undefined) =>
  adapterId === 'graph.body_value.v1' ? 1 : adapterId === undefined ? null : 0;

export class SlateTriggerWebhookReplayService {
  async lookupBeforeMapping(d: {
    bindings: WebhookAtomicDispatch['bindings'];
    replayKeys: readonly string[];
    selectedItems: WebhookAtomicDispatch['bindings']['selectedItems'];
    kind: 'sync_response' | 'dispatch';
  }) {
    let candidates = d.selectedItems.length
      ? d.selectedItems.map(item => ({
          candidateId: item.candidateId,
          itemBindingHash: item.bindingHash,
          deliveryIds: [...item.deliveryIds]
        }))
      : [
          {
            candidateId: 'receiver:0',
            itemBindingHash:
              d.kind === 'sync_response'
                ? hashValue('metorial.webhook-replay-sync-item', {
                    receiverTriggerId: d.bindings.receiverTriggerId,
                    ruleId: d.bindings.ruleId,
                    selectedItems: d.selectedItems.map(item => item.bindingHash)
                  })
                : hashValue('metorial.webhook-replay-item', {
                    receiverTriggerId: d.bindings.receiverTriggerId,
                    ruleId: d.bindings.ruleId,
                    index: 0
                  }),
            deliveryIds: [...d.replayKeys]
          }
        ];
    let found: { candidateId: string; claim: any }[] = [];
    for (let candidate of candidates) {
      let deliveryIdHashes = candidate.deliveryIds
        .map(deliveryId =>
          hashAuthenticatedWebhookDeliveryId({
            receiverTriggerId: d.bindings.receiverTriggerId,
            specHash: d.bindings.specHash,
            ruleId: d.bindings.ruleId,
            itemBindingHash: candidate.itemBindingHash,
            deliveryId
          })
        )
        .sort();
      let claim = await db.slateTriggerWebhookReplayClaim.findFirst({
        where: {
          receiverTrigger: { id: d.bindings.receiverTriggerId },
          specHash: d.bindings.specHash,
          ruleId: d.bindings.ruleId,
          itemBindingHash: candidate.itemBindingHash,
          deliveryIdHash: hashValue('metorial.webhook-replay-delivery-set', deliveryIdHashes)
        },
        include: { receiverTrigger: { select: { id: true } } }
      });
      if (claim) found.push({ candidateId: candidate.candidateId, claim });
    }
    let sync = found.find(item => item.claim.kind === 'sync_response')?.claim;
    return {
      duplicateCandidateIds: found.map(item => item.candidateId),
      ...(sync ? { response: await decryptSyncResponse(sync) } : {})
    };
  }

  private async confirmDuplicate(input: WebhookAtomicCommitInput) {
    let expected = [
      ...input.dispatches.flatMap(dispatch =>
        identitiesForDispatch(dispatch).map(identity => ({
          bindings: dispatch.bindings,
          identity
        }))
      ),
      ...input.syncs.map(sync => ({
        bindings: sync.bindings,
        identity: identityForSync(sync)
      }))
    ];
    if (!expected.length) return null;
    let claims = await Promise.all(
      expected.map(item =>
        db.slateTriggerWebhookReplayClaim.findFirst({
          where: {
            receiverTrigger: { id: item.bindings.receiverTriggerId },
            specHash: item.bindings.specHash,
            ruleId: item.bindings.ruleId,
            itemBindingHash: item.identity.itemBindingHash,
            deliveryIdHash: item.identity.deliveryIdHash
          },
          include: { receiverTrigger: { select: { id: true } } }
        })
      )
    );
    if (claims.some(claim => !claim)) return null;
    let syncClaim = claims.find(claim => claim?.kind === 'sync_response');
    let response = syncClaim ? await decryptSyncResponse(syncClaim) : undefined;
    return { commitId: claims[0]!.id, response };
  }

  private async hasAnyCommittedIdentity(input: WebhookAtomicCommitInput) {
    let expected = [
      ...input.dispatches.flatMap(dispatch =>
        identitiesForDispatch(dispatch).map(identity => ({
          bindings: dispatch.bindings,
          identity
        }))
      ),
      ...input.syncs.map(sync => ({
        bindings: sync.bindings,
        identity: identityForSync(sync)
      }))
    ];
    for (let item of expected) {
      if (
        await db.slateTriggerWebhookReplayClaim.findFirst({
          where: {
            receiverTrigger: { id: item.bindings.receiverTriggerId },
            specHash: item.bindings.specHash,
            ruleId: item.bindings.ruleId,
            itemBindingHash: item.identity.itemBindingHash,
            deliveryIdHash: item.identity.deliveryIdHash
          },
          select: { oid: true }
        })
      )
        return true;
    }
    return false;
  }

  async lookupCommitted(input: WebhookAtomicCommitInput) {
    return await this.confirmDuplicate(input);
  }

  async commit(input: WebhookAtomicCommitInput): Promise<WebhookAtomicCommitResult> {
    let commitNow = new Date();
    let dispatchPrepared = input.dispatches.map(dispatch => ({
      dispatch,
      identities: identitiesForDispatch(dispatch),
      rows: dispatch.inputs.map(() => ({
        eventInput: getId('slateTriggerEventInput'),
        claim: getId('slateTriggerWebhookReplayClaim'),
        outbox: getId('slateTriggerWebhookDispatchOutbox'),
        localEvent: getId('slateTriggerEvent')
      }))
    }));
    let syncPrepared = await Promise.all(
      input.syncs.map(async sync => {
        let claim = getId('slateTriggerWebhookReplayClaim');
        return {
          sync,
          claim,
          identity: identityForSync(sync),
          response: await encryptSyncResponse({
            claimId: claim.id,
            receiverTriggerId: sync.bindings.receiverTriggerId,
            specHash: sync.bindings.specHash,
            ruleId: sync.bindings.ruleId,
            response: sync.response
          })
        };
      })
    );

    try {
      let result = await db.$transaction(async tx => {
        let request = await tx.slateTriggerWebhookRequest.findUnique({
          where: { id: input.requestId },
          include: { payload: true }
        });
        if (
          !request?.payload ||
          request.processedAt ||
          request.payload.receiverId !== input.receiverId ||
          request.requestHash !== input.originalRequestHash
        ) {
          return { status: 'rejected', code: 'mapped_output_invalid' } as const;
        }
        let originalRequest = await decryptWebhookRequestPayloadEnvelope({
          tenantId: request.payload.tenantId,
          receiverId: request.payload.receiverId,
          requestId: request.id,
          encryptedRequest: request.payload.encryptedRequest,
          encryptionVersion: request.payload.encryptionVersion,
          aadVersion: request.payload.aadVersion
        });
        if (computeWebhookWireRequestHash(originalRequest) !== input.originalRequestHash) {
          return { status: 'rejected', code: 'mapped_output_invalid' } as const;
        }

        let allBindings = [
          ...input.dispatches.map(item => item.bindings),
          ...input.syncs.map(item => item.bindings)
        ];
        let triggers = new Map<string, any>();
        for (let bindings of allBindings) {
          let trigger = await tx.slateTriggerReceiverTrigger.findUnique({
            where: { id: bindings.receiverTriggerId },
            include: {
              action: true,
              receiver: { include: { tenant: true, slate: true, slateInstance: true } }
            }
          });
          let contract = trigger?.action.spec as Record<string, any> | undefined;
          let http = contract
            ? slatesWebhookHttp.safeParse(contract.invocation?.http ?? {})
            : null;
          let ingress = http?.success ? http.data.ingress : undefined;
          let rules =
            ingress?.kind === 'receiver_route'
              ? ingress.verification.mechanism === 'path_secret_only'
                ? []
                : ingress.verification.rules
              : ingress?.kind === 'shared_provisioned_app'
                ? ingress.verification.rules
                : [];
          let sharedAuthority = bindings.sharedAppAuthority;
          let sharedBinding = sharedAuthority
            ? await tx.slateProvisionedTenantAppProjection.findUnique({
                where: { provisionedTenantAppId: sharedAuthority.bindingProjectionId },
                include: { routeProjection: true }
              })
            : null;
          let sharedSecretReferences = sharedAuthority
            ? [
                ...sharedAuthority.authenticatedPathSecrets.map(secret => ({
                  ...secret,
                  purpose: 'app_route_path'
                })),
                ...sharedAuthority.authenticatedVendorSecrets.map(secret => ({
                  ...secret,
                  purpose: 'vendor_verification'
                }))
              ]
            : [];
          let sharedCredentialRows =
            sharedBinding && sharedSecretReferences.length > 0
              ? await tx.slateProvisionedAppRouteSecret.findMany({
                  where: {
                    provisionedRouteId: sharedBinding.routeProjection.provisionedRouteId,
                    routeGeneration: sharedBinding.routeGeneration,
                    id: { in: sharedSecretReferences.map(secret => secret.id) }
                  }
                })
              : [];
          let sharedCredentialsValid = Boolean(
            sharedAuthority &&
            sharedAuthority.authenticatedPathSecrets.length > 0 &&
            sharedAuthority.authenticatedVendorSecrets.length > 0 &&
            sharedSecretReferences.length <= 16 &&
            new Set(
              sharedSecretReferences.map(
                secret => `${secret.purpose}:${secret.id}:${secret.version}`
              )
            ).size === sharedSecretReferences.length &&
            sharedSecretReferences.every(reference =>
              sharedCredentialRows.some(
                row =>
                  row.id === reference.id &&
                  row.secretVersion === reference.version &&
                  row.purpose === reference.purpose &&
                  row.vendor === sharedBinding?.routeProjection.vendor &&
                  row.credentialOwnerRef ===
                    sharedBinding?.routeProjection.credentialOwnerRef &&
                  (row.status === 'active' || row.status === 'retiring') &&
                  row.validFrom <= commitNow &&
                  (row.status === 'active' ||
                    (row.validUntil !== null && row.validUntil > commitNow))
              )
            )
          );
          let sharedAuthorityValid =
            ingress?.kind === 'shared_provisioned_app'
              ? Boolean(
                  sharedAuthority &&
                  sharedCredentialsValid &&
                  request.authenticatedBoundaryKind === 'shared_provisioned_app' &&
                  request.authenticatedBindingHash === sharedAuthority.bindingHash &&
                  trigger?.source === 'webhook' &&
                  trigger.tombstonedAt === null &&
                  trigger.ingressDisabledAt === null &&
                  trigger.verificationSpecHash === bindings.specHash &&
                  trigger?.verificationMechanism === 'hub' &&
                  trigger.receiver.status === 'active' &&
                  trigger.receiver.tombstonedAt === null &&
                  sharedBinding &&
                  sharedBinding.status === 'active' &&
                  sharedBinding.tombstonedAt === null &&
                  (sharedBinding.expiresAt === null || sharedBinding.expiresAt > commitNow) &&
                  sharedBinding.projectionDigest === sharedAuthority.bindingProjectionDigest &&
                  sharedBinding.generation === sharedAuthority.bindingGeneration &&
                  sharedBinding.purpose === 'shared_provisioned_app' &&
                  sharedBinding.externalOwnershipKey ===
                    sharedAuthority.externalOwnershipKey &&
                  sharedBinding.tenantOid === trigger?.receiver.tenantOid &&
                  sharedBinding.receiverOid === trigger?.receiverOid &&
                  sharedBinding.receiverTriggerOid === trigger?.oid &&
                  sharedBinding.hubReceiverGeneration === bindings.registrationGeneration &&
                  sharedBinding.triggerActionId === bindings.actionId &&
                  sharedBinding.triggerSpecHash === bindings.specHash &&
                  sharedBinding.routeProjection.provisionedRouteId ===
                    sharedAuthority.routeProjectionId &&
                  sharedBinding.routeProjection.status === 'active' &&
                  sharedBinding.routeProjection.purpose === 'shared_provisioned_app' &&
                  sharedBinding.routeProjection.tombstonedAt === null &&
                  (sharedBinding.routeProjection.expiresAt === null ||
                    sharedBinding.routeProjection.expiresAt > commitNow) &&
                  sharedBinding.routeGeneration === sharedAuthority.routeGeneration &&
                  sharedBinding.routeProjection.generation ===
                    sharedAuthority.routeGeneration &&
                  sharedBinding.routeProjection.projectionDigest ===
                    sharedAuthority.routeProjectionDigest &&
                  sharedBinding.routeIdentifier ===
                    sharedBinding.routeProjection.routeIdentifier &&
                  sharedBinding.vendor === sharedBinding.routeProjection.vendor &&
                  ingress.routeFamily === sharedBinding.vendor &&
                  ingress.verification.mechanism === 'hub'
                )
              : !sharedAuthority && request.authenticatedBoundaryKind === 'receiver_route';
          if (
            !trigger ||
            bindings.requestId !== input.requestId ||
            bindings.receiverId !== input.receiverId ||
            bindings.originalRequestHash !== input.originalRequestHash ||
            trigger.receiver.id !== input.receiverId ||
            request.receiverOwnerId !== trigger.receiver.id ||
            request.tenantId !== trigger.receiver.tenant.id ||
            trigger.action.key !== bindings.actionId ||
            !contract ||
            contract.specHash !== bindings.specHash ||
            computeWebhookActionSpecHashV1(contract as never) !== bindings.specHash ||
            trigger.registrationGeneration !== bindings.registrationGeneration ||
            !sharedAuthorityValid ||
            (bindings.ruleId !== 'path_secret_only' &&
              !rules.some(rule => rule.id === bindings.ruleId))
          ) {
            return { status: 'rejected', code: 'mapped_output_invalid' } as const;
          }
          if (trigger.registrationVersion !== bindings.registrationVersion) {
            throw new AtomicCommitRejection('state_cas_conflict');
          }
          triggers.set(bindings.receiverTriggerId, trigger);
        }

        // Reconstruct every accepted item boundary from the encrypted original request. The
        // provider's mapped inputs and copied bindings are never treated as authority here.
        for (let prepared of dispatchPrepared) {
          let dispatch = prepared.dispatch;
          let acceptedRequest = parseWebhookWireRequest(dispatch.acceptedRequest);
          if (
            prepared.identities.length !== dispatch.inputs.length ||
            computeWebhookWireRequestHash(acceptedRequest) !==
              dispatch.bindings.dispatchRequestHash
          ) {
            return { status: 'rejected', code: 'mapped_output_invalid' } as const;
          }
          if (dispatch.bindings.itemAdapterId) {
            let adapter = prepareWebhookItemAdapter(
              dispatch.bindings.itemAdapterId,
              originalRequest
            );
            let authoritative = adapter.reconstruct(
              dispatch.bindings.selectedItems.map(item => item.candidateId)
            );
            if (
              adapterVersion(adapter.id) !== 1 ||
              authoritative.dispatchRequestHash !== dispatch.bindings.dispatchRequestHash ||
              computeWebhookWireRequestHash(authoritative.request) !==
                computeWebhookWireRequestHash(acceptedRequest) ||
              authoritative.selected.length !== dispatch.bindings.selectedItems.length ||
              authoritative.selected.some((item, index) => {
                let bound = dispatch.bindings.selectedItems[index];
                return (
                  !bound ||
                  item.candidateId !== bound.candidateId ||
                  item.bindingHash !== bound.bindingHash ||
                  canonicalJson(item.deliveryIds) !== canonicalJson(bound.deliveryIds)
                );
              }) ||
              dispatch.inputs.length !== authoritative.selected.length ||
              new Set(dispatch.inputs.map(mapped => mapped.candidateId)).size !==
                dispatch.inputs.length ||
              dispatch.inputs.some(
                mapped =>
                  typeof mapped.candidateId !== 'string' ||
                  !authoritative.selected.some(
                    candidate => candidate.candidateId === mapped.candidateId
                  )
              )
            ) {
              return { status: 'rejected', code: 'mapped_output_invalid' } as const;
            }
          } else if (
            dispatch.bindings.selectedItems.length !== 0 ||
            dispatch.inputs.length !== 1 ||
            dispatch.bindings.dispatchRequestHash !== input.originalRequestHash
          ) {
            return { status: 'rejected', code: 'mapped_output_invalid' } as const;
          }
        }

        let requiredPayloadExpiry = new Date(
          commitNow.getTime() +
            Math.max(
              input.dispatches.length > 0 ? WEBHOOK_OUTBOX_RETENTION_MS : 0,
              ...input.dispatches.map(
                dispatch => Math.max(1, dispatch.replayTtlSeconds) * 1000
              ),
              ...input.syncs.map(sync => Math.max(1, sync.replayTtlSeconds) * 1000)
            )
        );
        if (request.payload.expiresAt < requiredPayloadExpiry) {
          let retained = await tx.slateTriggerWebhookRequestPayload.updateMany({
            where: { oid: request.payload.oid, expiresAt: request.payload.expiresAt },
            data: { expiresAt: requiredPayloadExpiry }
          });
          if (retained.count !== 1) {
            throw new AtomicCommitRejection('mapped_output_invalid');
          }
          request.payload.expiresAt = requiredPayloadExpiry;
        }

        // Win every proposed-state CAS before inserting claims. Any later exception still rolls
        // these writes back because they are part of this same Hub transaction.
        let proposed = new Map<string, WebhookAtomicDispatch>();
        for (let dispatch of input.dispatches) {
          if (!dispatch.proposedState) continue;
          let prior = proposed.get(dispatch.bindings.receiverTriggerId);
          if (
            prior &&
            canonicalJson(prior.proposedState) !== canonicalJson(dispatch.proposedState)
          )
            throw new AtomicCommitRejection('mapped_output_invalid');
          proposed.set(dispatch.bindings.receiverTriggerId, dispatch);
        }
        for (let dispatch of proposed.values()) {
          let trigger = triggers.get(dispatch.bindings.receiverTriggerId)!;
          if (
            computeWebhookStateHash(trigger.state) !==
              dispatch.proposedState!.expectedPriorHash ||
            trigger.registrationVersion !== dispatch.proposedState!.expectedPriorVersion
          )
            throw new AtomicCommitRejection('state_cas_conflict');
          let won = await tx.slateTriggerReceiverTrigger.updateMany({
            where: {
              oid: trigger.oid,
              registrationGeneration: dispatch.bindings.registrationGeneration,
              registrationVersion: dispatch.proposedState!.expectedPriorVersion
            },
            data: {
              state: dispatch.proposedState!.value as Prisma.InputJsonValue,
              registrationVersion: { increment: 1 }
            }
          });
          if (won.count !== 1) {
            throw new AtomicCommitRejection('state_cas_conflict');
          }
        }

        for (let item of syncPrepared) {
          let trigger = triggers.get(item.sync.bindings.receiverTriggerId)!;
          let expiresAt = new Date(
            commitNow.getTime() + Math.max(1, item.sync.replayTtlSeconds) * 1000
          );
          await tx.slateTriggerWebhookReplayClaim.create({
            data: {
              ...item.claim,
              receiverOid: trigger.receiverOid,
              receiverTriggerOid: trigger.oid,
              requestOid: request.oid,
              kind: 'sync_response',
              status: 'responded',
              specHash: item.sync.bindings.specHash,
              ruleId: item.sync.bindings.ruleId,
              itemBindingHash: item.identity.itemBindingHash,
              deliveryIdHash: item.identity.deliveryIdHash,
              itemAdapterId: item.sync.bindings.itemAdapterId,
              itemAdapterVersion: adapterVersion(item.sync.bindings.itemAdapterId),
              originalRequestHash: item.sync.bindings.originalRequestHash,
              dispatchRequestHash: item.sync.bindings.dispatchRequestHash,
              capturedSecretBindings: Object.fromEntries(
                Object.entries(item.sync.capturedSecrets).map(([name, secret]) => [
                  name,
                  secret.version
                ])
              ),
              encryptedSyncResponse: item.response.encrypted,
              syncResponseEncryptionKeyVersion: item.response.keyVersion,
              syncResponseAadVersion: item.response.aadVersion,
              expiresAt
            }
          });
          // Reserve the authenticated replay identity first inside the transaction. A racing
          // duplicate then loses on uniqueness before it can contend with the captured-secret
          // CAS; any later secret failure still rolls this claim back atomically.
          if (Object.keys(item.sync.capturedSecrets).length) {
            await (
              slateTriggerReceiverSecretService as any
            ).persistCapturedRegistrationSecretsInTransaction({
              tx,
              authority: {
                receiverTrigger: trigger,
                specHash: item.sync.bindings.specHash,
                rule: { id: item.sync.bindings.ruleId }
              },
              capturedSecrets: item.sync.capturedSecrets,
              actor: {
                actorId: 'authenticated_webhook_sync',
                requestId: input.requestId
              },
              now: new Date()
            });
          }
        }

        for (let prepared of dispatchPrepared) {
          let trigger = triggers.get(prepared.dispatch.bindings.receiverTriggerId)!;
          let acceptedRequest = parseWebhookWireRequest(prepared.dispatch.acceptedRequest);
          for (let index = 0; index < prepared.dispatch.inputs.length; index += 1) {
            let inputValue = prepared.dispatch.inputs[index]!;
            let identity = prepared.identities[index]!;
            let ids = prepared.rows[index]!;
            let encryptedPayload = await encryptWebhookRequestPayload({
              tenantId: trigger.receiver.tenant.id,
              receiverId: trigger.receiver.id,
              requestId: ids.outbox.id,
              request: acceptedRequest
            });
            let expiresAt = new Date(
              commitNow.getTime() + Math.max(1, prepared.dispatch.replayTtlSeconds) * 1000
            );
            let localSourceId = hashValue('metorial.webhook-local-source', {
              receiverTriggerId: trigger.id,
              outboxId: ids.outbox.id,
              input: inputValue
            });
            let signalIdempotencyKey = computeHubSignalIdempotencyKey({
              tenantId: trigger.receiver.tenant.id,
              receiverTriggerId: trigger.id,
              specHash: prepared.dispatch.bindings.specHash,
              ruleId: prepared.dispatch.bindings.ruleId,
              deliveryIdHash: identity.deliveryIdHash,
              itemBindingHash: identity.itemBindingHash,
              adapterVersion: prepared.dispatch.bindings.itemAdapterId ? 1 : 0,
              originalRequestHash: prepared.dispatch.bindings.originalRequestHash,
              dispatchRequestHash: prepared.dispatch.bindings.dispatchRequestHash,
              outboxId: ids.outbox.id,
              eventInputId: ids.eventInput.id
            });
            await tx.slateTriggerEventInput.create({
              data: {
                ...ids.eventInput,
                receiverOid: trigger.receiverOid,
                receiverTriggerOid: trigger.oid,
                actionOid: trigger.actionOid,
                slateOid: trigger.receiver.slateOid,
                slateInstanceOid: trigger.receiver.slateInstanceOid,
                input: inputValue as Prisma.InputJsonValue
              }
            });
            await tx.slateTriggerWebhookReplayClaim.create({
              data: {
                ...ids.claim,
                receiverOid: trigger.receiverOid,
                receiverTriggerOid: trigger.oid,
                requestOid: request.oid,
                eventInputOid: ids.eventInput.oid,
                kind: 'dispatch',
                status: 'queued',
                specHash: prepared.dispatch.bindings.specHash,
                ruleId: prepared.dispatch.bindings.ruleId,
                itemBindingHash: identity.itemBindingHash,
                deliveryIdHash: identity.deliveryIdHash,
                itemAdapterId: prepared.dispatch.bindings.itemAdapterId,
                itemAdapterVersion: adapterVersion(prepared.dispatch.bindings.itemAdapterId),
                originalRequestHash: prepared.dispatch.bindings.originalRequestHash,
                dispatchRequestHash: prepared.dispatch.bindings.dispatchRequestHash,
                expiresAt
              }
            });
            await tx.slateTriggerWebhookDispatchOutbox.create({
              data: {
                ...ids.outbox,
                receiverOid: trigger.receiverOid,
                receiverTriggerOid: trigger.oid,
                replayClaimOid: ids.claim.oid,
                eventInputOid: ids.eventInput.oid,
                requestPayloadOid: request.payload.oid,
                tenantId: trigger.receiver.tenant.id,
                signalTenantId: trigger.receiver.tenant.signalTenantId,
                adapterCandidateId: identity.candidateId,
                itemBindingHash: identity.itemBindingHash,
                deliveryIdHashes: identity.deliveryIdHashes,
                itemAdapterId: prepared.dispatch.bindings.itemAdapterId,
                itemAdapterVersion: adapterVersion(prepared.dispatch.bindings.itemAdapterId),
                originalRequestHash: prepared.dispatch.bindings.originalRequestHash,
                dispatchRequestHash: prepared.dispatch.bindings.dispatchRequestHash,
                encryptedAcceptedPayload: encryptedPayload.encryptedRequest,
                acceptedPayloadEncryptionKeyVersion: encryptedPayload.encryptionVersion,
                acceptedPayloadAadVersion: encryptedPayload.aadVersion,
                signalIdempotencyKey,
                localEventId: ids.localEvent.id,
                localSourceId,
                retentionExpiresAt: new Date(commitNow.getTime() + WEBHOOK_OUTBOX_RETENTION_MS)
              }
            });
          }
        }
        return {
          status: 'committed',
          commitId: hashValue('metorial.webhook-atomic-commit', {
            requestId: input.requestId,
            claims: [
              ...dispatchPrepared.flatMap(item => item.rows.map(row => row.claim.id)),
              ...syncPrepared.map(item => item.claim.id)
            ]
          })
        } as const;
      });
      if (result.status === 'committed') {
        try {
          let committedRequest = await db.slateTriggerWebhookRequest.findUniqueOrThrow({
            where: { id: input.requestId },
            select: { oid: true }
          });
          let created = await db.slateTriggerWebhookReplayClaim.findMany({
            where: { requestOid: committedRequest.oid, kind: 'dispatch' },
            select: { eventInput: { select: { id: true } } }
          });
          await slateTriggerEventProcessQueue.addManyWithOps(
            created.flatMap(claim =>
              claim.eventInput
                ? [
                    {
                      data: { eventInputId: claim.eventInput.id },
                      opts: { id: claim.eventInput.id }
                    }
                  ]
                : []
            )
          );
        } catch {
          console.error('Webhook event-input enqueue failed after atomic commit', {
            requestId: input.requestId,
            safeErrorCode: 'webhook_event_input_enqueue_failed'
          });
        }
      }
      return result;
    } catch (error) {
      if (error instanceof AtomicCommitRejection) {
        return { status: 'rejected', code: error.code };
      }
      if (!isUniqueConflict(error)) throw error;
      let duplicate = await this.confirmDuplicate(input);
      if (duplicate) {
        return {
          status: 'duplicate',
          commitId: duplicate.commitId,
          ...(duplicate.response ? { response: duplicate.response } : {})
        };
      }
      // A sibling may have won between batch preflight and this transaction. Force the runtime
      // through its fresh-state/remap loop so committed siblings are filtered and only the still
      // fresh candidates are mapped and inserted on the next attempt.
      if (await this.hasAnyCommittedIdentity(input)) {
        return { status: 'rejected', code: 'state_cas_conflict' };
      }
      return { status: 'rejected', code: 'replay_conflict' };
    }
  }

  async claimDueOutbox(d: { owner?: string; now?: Date; leaseMs?: number }) {
    let owner = d.owner ?? randomUUID();
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
    let leaseExpiresAt = new Date(now.getTime() + (d.leaseMs ?? WEBHOOK_OUTBOX_LEASE_MS));
    let won = await db.slateTriggerWebhookDispatchOutbox.updateMany({
      where: {
        oid: candidate.oid,
        nextAttemptAt: { lte: now },
        OR: [
          { status: { in: ['pending', 'retryable'] } },
          { status: 'leased', leaseExpiresAt: { lte: now } }
        ]
      },
      data: {
        status: 'leased',
        leaseOwner: owner,
        leaseExpiresAt,
        attemptCount: { increment: 1 }
      }
    });
    if (won.count !== 1) return null;
    let claimed = await db.slateTriggerWebhookDispatchOutbox.findUnique({
      where: { oid: candidate.oid }
    });
    if (claimed) {
      await db.slateTriggerWebhookReplayClaim.updateMany({
        where: { oid: claimed.replayClaimOid },
        data: { leaseExpiresAt }
      });
    }
    return claimed;
  }

  async claimOutbox(d: { outboxId: string; owner: string; now?: Date; leaseMs?: number }) {
    let now = d.now ?? new Date();
    let leaseExpiresAt = new Date(now.getTime() + (d.leaseMs ?? WEBHOOK_OUTBOX_LEASE_MS));
    let won = await db.slateTriggerWebhookDispatchOutbox.updateMany({
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
        leaseExpiresAt,
        attemptCount: { increment: 1 }
      }
    });
    if (won.count !== 1) return null;
    let claimed = await db.slateTriggerWebhookDispatchOutbox.findUnique({
      where: { id: d.outboxId }
    });
    if (claimed) {
      await db.slateTriggerWebhookReplayClaim.updateMany({
        where: { oid: claimed.replayClaimOid },
        data: { leaseExpiresAt }
      });
    }
    return claimed;
  }

  async renewLease(d: { outboxId: string; owner: string; now?: Date; leaseMs?: number }) {
    let now = d.now ?? new Date();
    let updated = await db.slateTriggerWebhookDispatchOutbox.updateMany({
      where: {
        id: d.outboxId,
        status: 'leased',
        leaseOwner: d.owner,
        leaseExpiresAt: { gt: now }
      },
      data: {
        leaseExpiresAt: new Date(now.getTime() + (d.leaseMs ?? WEBHOOK_OUTBOX_LEASE_MS))
      }
    });
    if (updated.count === 1) {
      let outbox = await db.slateTriggerWebhookDispatchOutbox.findUnique({
        where: { id: d.outboxId },
        select: { replayClaimOid: true }
      });
      if (outbox) {
        await db.slateTriggerWebhookReplayClaim.updateMany({
          where: { oid: outbox.replayClaimOid },
          data: {
            leaseExpiresAt: new Date(now.getTime() + (d.leaseMs ?? WEBHOOK_OUTBOX_LEASE_MS))
          }
        });
      }
    }
    return updated.count === 1;
  }

  async retryLeased(d: { outboxId: string; owner: string; safeCode: string; now?: Date }) {
    let now = d.now ?? new Date();
    let current = await db.slateTriggerWebhookDispatchOutbox.findFirst({
      where: {
        id: d.outboxId,
        status: 'leased',
        leaseOwner: d.owner,
        leaseExpiresAt: { gt: now }
      }
    });
    if (!current) return false;
    if (current.attemptCount >= WEBHOOK_OUTBOX_MAX_ATTEMPTS) {
      return await this.deadLetter({ ...d, safeCode: 'attempts_exhausted' });
    }
    let backoffMs = computeWebhookOutboxBackoffMs({
      attemptCount: current.attemptCount
    });
    let updated = await db.slateTriggerWebhookDispatchOutbox.updateMany({
      where: {
        oid: current.oid,
        status: 'leased',
        leaseOwner: d.owner,
        leaseExpiresAt: { gt: now }
      },
      data: {
        status: 'retryable',
        leaseOwner: null,
        leaseExpiresAt: null,
        nextAttemptAt: new Date(now.getTime() + backoffMs),
        safeTerminalCode: d.safeCode
      }
    });
    if (updated.count === 1) {
      await db.slateTriggerWebhookReplayClaim.updateMany({
        where: { oid: current.replayClaimOid },
        data: { status: 'failed_retryable', leaseExpiresAt: null }
      });
    }
    return updated.count === 1;
  }

  async deadLetter(d: { outboxId: string; owner: string; safeCode: string; now?: Date }) {
    let now = d.now ?? new Date();
    return await db.$transaction(async tx => {
      let current = await tx.slateTriggerWebhookDispatchOutbox.findFirst({
        where: {
          id: d.outboxId,
          status: 'leased',
          leaseOwner: d.owner,
          leaseExpiresAt: { gt: now }
        }
      });
      if (!current) return false;
      let updated = await tx.slateTriggerWebhookDispatchOutbox.updateMany({
        where: {
          oid: current.oid,
          status: 'leased',
          leaseOwner: d.owner,
          leaseExpiresAt: { gt: now }
        },
        data: {
          status: 'dead_letter',
          leaseOwner: null,
          leaseExpiresAt: null,
          safeTerminalCode: d.safeCode,
          deadLetterMetadata: { code: d.safeCode }
        }
      });
      if (updated.count !== 1) return false;
      await tx.slateTriggerWebhookReplayClaim.update({
        where: { oid: current.replayClaimOid },
        data: { status: 'failed_terminal', leaseExpiresAt: null }
      });
      return true;
    });
  }

  async confirmDelivered(d: {
    outboxId: string;
    owner: string;
    signalEventId: string;
    signalFingerprint: string;
    now?: Date;
  }) {
    let now = d.now ?? new Date();
    return await db.$transaction(async tx => {
      let current = await tx.slateTriggerWebhookDispatchOutbox.findFirst({
        where: {
          id: d.outboxId,
          status: 'leased',
          leaseOwner: d.owner,
          leaseExpiresAt: { gt: now }
        }
      });
      if (!current || current.signalRequestFingerprint !== d.signalFingerprint) return false;
      let updated = await tx.slateTriggerWebhookDispatchOutbox.updateMany({
        where: {
          oid: current.oid,
          status: 'leased',
          leaseOwner: d.owner,
          leaseExpiresAt: { gt: now }
        },
        data: {
          status: 'delivered',
          confirmedSignalEventId: d.signalEventId,
          deliveredAt: new Date(),
          leaseOwner: null,
          leaseExpiresAt: null,
          safeTerminalCode: null
        }
      });
      if (updated.count !== 1) return false;
      await tx.slateTriggerWebhookReplayClaim.update({
        where: { oid: current.replayClaimOid },
        data: { status: 'delivered', leaseExpiresAt: null }
      });
      let localEvent = await tx.slateTriggerEvent.findUnique({
        where: { id: current.localEventId },
        select: { deliveryStatus: true, signalEventId: true }
      });
      if (
        !localEvent ||
        (localEvent.signalEventId !== '' && localEvent.signalEventId !== d.signalEventId)
      )
        throw new Error('Webhook outbox local event CAS conflict');
      let localUpdated = await tx.slateTriggerEvent.updateMany({
        where: { id: current.localEventId, signalEventId: localEvent.signalEventId },
        data: {
          signalEventId: d.signalEventId,
          deliveryStatus:
            localEvent.deliveryStatus === 'pending' ? 'sent' : localEvent.deliveryStatus
        }
      });
      if (localUpdated.count !== 1) {
        throw new Error('Webhook outbox local delivered CAS lost');
      }
      return true;
    });
  }

  async recordFilteredCallbackEvent(d: Parameters<typeof recordCallbackEventLifecycle>[0]) {
    return await recordCallbackEventLifecycle(d);
  }

  async confirmFiltered(d: { outboxId: string; owner: string; now?: Date }) {
    let now = d.now ?? new Date();
    return await db.$transaction(async tx => {
      let current = await tx.slateTriggerWebhookDispatchOutbox.findFirst({
        where: {
          id: d.outboxId,
          status: 'leased',
          leaseOwner: d.owner,
          leaseExpiresAt: { gt: now }
        }
      });
      if (!current) return false;
      let updated = await tx.slateTriggerWebhookDispatchOutbox.updateMany({
        where: {
          oid: current.oid,
          status: 'leased',
          leaseOwner: d.owner,
          leaseExpiresAt: { gt: now }
        },
        data: {
          status: 'delivered',
          confirmedSignalEventId: null,
          deliveredAt: now,
          leaseOwner: null,
          leaseExpiresAt: null,
          safeTerminalCode: 'event_type_filtered'
        }
      });
      if (updated.count !== 1) return false;
      await tx.slateTriggerWebhookReplayClaim.update({
        where: { oid: current.replayClaimOid },
        data: { status: 'delivered', leaseExpiresAt: null }
      });
      let localEvent = await tx.slateTriggerEvent.findUnique({
        where: { id: current.localEventId },
        select: { signalEventId: true }
      });
      if (!localEvent || localEvent.signalEventId !== '') {
        throw new Error('Filtered webhook outbox local event CAS conflict');
      }
      let localUpdated = await tx.slateTriggerEvent.updateMany({
        where: { id: current.localEventId, signalEventId: '' },
        data: { deliveryStatus: SlateTriggerEventDeliveryStatus.skipped }
      });
      if (localUpdated.count !== 1) {
        throw new Error('Webhook outbox local filtered CAS lost');
      }
      return true;
    });
  }

  async redrive(d: { outboxId: string; tenantId: string; now?: Date }) {
    let updated = await db.slateTriggerWebhookDispatchOutbox.updateMany({
      where: { id: d.outboxId, tenantId: d.tenantId, status: 'dead_letter' },
      data: {
        status: 'pending',
        nextAttemptAt: d.now ?? new Date(),
        attemptCount: 0,
        leaseOwner: null,
        leaseExpiresAt: null,
        safeTerminalCode: null,
        deadLetterMetadata: Prisma.DbNull
      }
    });
    return updated.count === 1;
  }

  async dispatchLeased(d: {
    outboxId: string;
    owner: string;
    now?: Date;
    beforeLeaseRelease?: () => Promise<void>;
  }) {
    let now = d.now ?? new Date();
    let outbox = await db.slateTriggerWebhookDispatchOutbox.findFirst({
      where: {
        id: d.outboxId,
        status: 'leased',
        leaseOwner: d.owner,
        leaseExpiresAt: { gt: now }
      },
      include: {
        receiverTrigger: {
          include: {
            action: true,
            receiver: { include: { tenant: true } }
          }
        },
        eventInput: true
      }
    });
    if (!outbox || !outbox.signalRequest || !outbox.signalRequestFingerprint) return false;
    let request = outbox.signalRequest as unknown as HubSignalIdempotentRequest;
    let receiverTrigger = outbox.receiverTrigger;
    if (
      receiverTrigger &&
      receiverTrigger.receiver.deliveryMode === SlateTriggerReceiverDeliveryMode.callback_v2 &&
      receiverTrigger.eventTypes.length > 0 &&
      !receiverTrigger.eventTypes.includes(request.eventType)
    ) {
      await this.recordFilteredCallbackEvent({
        receiver: receiverTrigger.receiver as any,
        action: receiverTrigger.action,
        event: {
          id: outbox.eventInput.id,
          status: 'skipped',
          type: request.eventType,
          sourceId: outbox.localSourceId,
          input: outbox.eventInput.input as Record<string, any> | null
        }
      });
      await d.beforeLeaseRelease?.();
      return await this.confirmFiltered({
        outboxId: outbox.id,
        owner: d.owner
      });
    }
    let create = async () => await signal.event.createIdempotent(request);
    let event: Awaited<ReturnType<typeof create>>;
    try {
      event = await create();
    } catch (error) {
      let classification = classifySignalDispatchError(error);
      if (classification.type === 'terminal') {
        await d.beforeLeaseRelease?.();
        await this.deadLetter({
          outboxId: outbox.id,
          owner: d.owner,
          safeCode: classification.safeCode
        });
        return false;
      }
      // A transport timeout is ambiguous: tenant-scoped lookup is the recovery oracle.
      try {
        event = await signal.event.getByIdempotencyKey({
          tenantId: request.tenantId,
          idempotencyKey: request.idempotencyKey
        });
      } catch (lookupError) {
        let lookupCode =
          typeof lookupError === 'object' && lookupError !== null && 'data' in lookupError
            ? String((lookupError as any).data?.code ?? '')
            : '';
        if (lookupCode === 'idempotency_payload_conflict') {
          await d.beforeLeaseRelease?.();
          await this.deadLetter({ outboxId: outbox.id, owner: d.owner, safeCode: lookupCode });
          return false;
        }
        let lookupClassification = classifySignalDispatchError(lookupError);
        if (lookupCode !== 'not_found' && lookupClassification.type === 'terminal') {
          await d.beforeLeaseRelease?.();
          await this.deadLetter({
            outboxId: outbox.id,
            owner: d.owner,
            safeCode: lookupClassification.safeCode
          });
          return false;
        }
        await d.beforeLeaseRelease?.();
        await this.retryLeased({
          outboxId: outbox.id,
          owner: d.owner,
          safeCode: lookupCode === 'not_found' ? 'signal_event_not_found' : 'signal_transport'
        });
        return false;
      }
    }
    if (
      typeof event !== 'object' ||
      event === null ||
      typeof event.id !== 'string' ||
      event.id.length === 0 ||
      typeof event.requestFingerprint !== 'string'
    ) {
      await d.beforeLeaseRelease?.();
      await this.deadLetter({
        outboxId: outbox.id,
        owner: d.owner,
        safeCode: 'signal_invalid_response'
      });
      return false;
    }
    if (event.requestFingerprint !== outbox.signalRequestFingerprint) {
      await d.beforeLeaseRelease?.();
      await this.deadLetter({
        outboxId: outbox.id,
        owner: d.owner,
        safeCode: 'idempotency_payload_conflict'
      });
      return false;
    }
    await d.beforeLeaseRelease?.();
    return await this.confirmDelivered({
      outboxId: outbox.id,
      owner: d.owner,
      signalEventId: event.id,
      signalFingerprint: event.requestFingerprint
    });
  }
}

export let slateTriggerWebhookReplayService = new SlateTriggerWebhookReplayService();
