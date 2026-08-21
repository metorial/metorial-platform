import { badRequestError, notFoundError, ServiceError } from '@lowerdeck/error';
import { Service } from '@lowerdeck/service';
import { Prisma } from '../../prisma/generated/client';
import { db } from '../db';
import { getId } from '../id';
import { redactWebhookHeaders, redactWebhookUrl } from '../lib/webhookRequestCapture';
import type { WebhookCapturePolicy } from '../lib/webhookCapturePolicy';
import {
  computeWebhookWireBodyHash,
  computeWebhookWireRequestHash,
  parseWebhookWireRequest,
  type WebhookWireRequest
} from '../lib/webhookWire';
import { slateTriggerWebhookQueue } from '../queues/trigger/webhook';
import {
  persistableAuthenticatedBoundary,
  type TrustedReceiverRouteBoundary
} from './slateTriggerWebhookAuthenticatedBoundary';
import type { SharedAppAuthenticatedBoundary } from '../lib/sharedAppRouting';

export let WEBHOOK_PAYLOAD_RETENTION_MS = 15 * 60 * 1000;
export let WEBHOOK_PAYLOAD_TERMINAL_RETENTION_MS = 24 * 60 * 60 * 1000;

let bodyLength = (request: WebhookWireRequest) =>
  request.body.present ? Buffer.from(request.body.base64, 'base64').byteLength : 0;

type ResolvedOwner = {
  tenantId: string;
  receiverId: string;
};

class slateTriggerWebhookRequestServiceImpl {
  private async resolveOwner(d: { receiverTriggerId?: string; receiverId?: string }) {
    if (Boolean(d.receiverTriggerId) === Boolean(d.receiverId)) {
      throw new ServiceError(
        badRequestError({ message: 'Exactly one webhook target is required.' })
      );
    }
    if (d.receiverTriggerId) {
      let receiverTrigger = await db.slateTriggerReceiverTrigger.findFirst({
        where: { id: d.receiverTriggerId },
        select: { receiver: { select: { id: true, tenant: { select: { id: true } } } } }
      });
      if (!receiverTrigger) {
        throw new ServiceError(notFoundError('slate.trigger.receiver_trigger'));
      }
      return {
        tenantId: receiverTrigger.receiver.tenant.id,
        receiverId: receiverTrigger.receiver.id
      } satisfies ResolvedOwner;
    }
    let receiver = await db.slateTriggerReceiver.findFirst({
      where: { id: d.receiverId },
      select: { id: true, tenant: { select: { id: true } } }
    });
    if (!receiver) throw new ServiceError(notFoundError('slate.trigger.receiver'));
    return { tenantId: receiver.tenant.id, receiverId: receiver.id } satisfies ResolvedOwner;
  }

  private async createStoredWebhookRequest(d: {
    receiverTriggerId?: string;
    receiverId?: string;
    wireRequest: WebhookWireRequest;
    pathSecret?: string;
    selectedRule?: string;
    capturePolicy?: WebhookCapturePolicy;
    enqueue?: boolean;
    authenticatedBoundary?: TrustedReceiverRouteBoundary | SharedAppAuthenticatedBoundary;
  }) {
    let owner = await this.resolveOwner(d);
    let wireRequest = d.wireRequest;
    let requestId = getId('slateTriggerWebhookRequest');
    let redactedUrl = redactWebhookUrl(wireRequest.url, d.pathSecret);
    let redactedHeaders = redactWebhookHeaders(wireRequest.headers);
    let authenticatedBoundary = d.authenticatedBoundary
      ? persistableAuthenticatedBoundary({
          boundary: d.authenticatedBoundary,
          tenantId: owner.tenantId,
          receiverId: owner.receiverId
        })
      : {};

    let record = await db.slateTriggerWebhookRequest.create({
        data: {
          ...requestId,
          receiverTriggerId: d.receiverTriggerId,
          receiverId: d.receiverId,
          tenantId: owner.tenantId,
          receiverOwnerId: owner.receiverId,
          url: redactedUrl,
          method: wireRequest.method,
          headers: redactedHeaders,
          body: null,
          redactedUrl,
          redactedHeaders,
          bodyByteLength: bodyLength(wireRequest),
          requestHash: computeWebhookWireRequestHash(wireRequest),
          bodyHash: computeWebhookWireBodyHash(wireRequest),
          selectedRule: d.selectedRule,
          capturePolicyHash: d.capturePolicy?.policyHash,
          captureSpecHashes: d.capturePolicy?.specHashes ?? [],
          captureRuleIds: d.capturePolicy?.ruleIds ?? [],
          ...authenticatedBoundary,
          outcome: 'accepted',
          capturedRequest: wireRequest as unknown as Prisma.InputJsonValue,
          capturedRequestExpiresAt: new Date(Date.now() + WEBHOOK_PAYLOAD_RETENTION_MS)
        }
      });

    if (d.enqueue === true) {
      throw new Error('Webhook requests must be dispatched through a queue ownership claim');
    }
    return record;
  }

  async createCapturedWebhookRequest(d: {
    receiverTriggerId?: string;
    receiverId?: string;
    wireRequest: WebhookWireRequest;
    pathSecret: string;
    selectedRule?: string;
    capturePolicy: WebhookCapturePolicy;
    authenticatedBoundary: TrustedReceiverRouteBoundary;
    enqueue?: boolean;
  }) {
    return await this.createStoredWebhookRequest(d);
  }

  async createCapturedSharedAppWebhookRequest(d: {
    receiverTriggerId: string;
    wireRequest: WebhookWireRequest;
    pathSecret: string;
    authenticatedBoundary: SharedAppAuthenticatedBoundary;
  }) {
    if (
      d.authenticatedBoundary.receiverTriggerId !== d.receiverTriggerId ||
      d.authenticatedBoundary.kind !== 'shared_provisioned_app'
    ) {
      throw new Error('Shared-app request target does not match its authenticated boundary');
    }
    return await this.createStoredWebhookRequest({
      receiverTriggerId: d.receiverTriggerId,
      wireRequest: d.wireRequest,
      pathSecret: d.pathSecret,
      authenticatedBoundary: d.authenticatedBoundary,
      enqueue: false
    });
  }

  async createRejectedWebhookRequest(d: {
    receiverTriggerId?: string;
    receiverId?: string;
    url: string;
    method: string;
    headers?: readonly (readonly [string, string])[];
    pathSecret?: string;
    safeRejectionCode: string;
    capturePolicy?: WebhookCapturePolicy;
  }) {
    let owner: ResolvedOwner | null = null;
    try {
      owner = await this.resolveOwner(d);
    } catch {
      // Rejections for unknown targets are still audit rows, but intentionally have no binding.
    }
    let redactedUrl = redactWebhookUrl(d.url, d.pathSecret);
    let redactedHeaders = redactWebhookHeaders(d.headers ?? []);
    return await db.slateTriggerWebhookRequest.create({
      data: {
        ...getId('slateTriggerWebhookRequest'),
        receiverTriggerId: d.receiverTriggerId,
        receiverId: d.receiverId,
        tenantId: owner?.tenantId,
        receiverOwnerId: owner?.receiverId,
        url: redactedUrl,
        method: d.method,
        headers: redactedHeaders,
        body: null,
        redactedUrl,
        redactedHeaders,
        bodyByteLength: 0,
        capturePolicyHash: d.capturePolicy?.policyHash,
        captureSpecHashes: d.capturePolicy?.specHashes ?? [],
        captureRuleIds: d.capturePolicy?.ruleIds ?? [],
        outcome: 'rejected',
        safeRejectionCode: d.safeRejectionCode,
        processedAt: new Date()
      }
    });
  }

  async loadDecryptedPayload(d: {
    webhookRequestId: string;
    tenantId?: string;
    receiverId?: string;
    now?: Date;
  }) {
    let request = await db.slateTriggerWebhookRequest.findUnique({
      where: { id: d.webhookRequestId },
    });
    if (!request?.capturedRequest) throw new Error('Webhook request payload is unavailable');
    if (!request.capturedRequestExpiresAt || request.capturedRequestExpiresAt <= (d.now ?? new Date())) {
      throw new Error('Webhook request payload has expired');
    }
    let tenantId = d.tenantId ?? request.tenantId;
    let receiverId = d.receiverId ?? request.receiverOwnerId;
    if (!tenantId || !receiverId || tenantId !== request.tenantId || receiverId !== request.receiverOwnerId) {
      throw new Error('Webhook request payload owner binding is invalid');
    }
    return parseWebhookWireRequest(request.capturedRequest);
  }

  async loadAuthenticatedConformancePayload(d: { webhookRequestId: string; now?: Date }) {
    let request = await db.slateTriggerWebhookRequest.findUnique({
      where: { id: d.webhookRequestId },
    });
    if (!request?.capturedRequest || !request.capturedRequestExpiresAt || request.capturedRequestExpiresAt <= (d.now ?? new Date())) {
      throw new Error('Webhook conformance payload is unavailable');
    }
    if (!request.tenantId || !request.receiverOwnerId) {
      throw new Error('Webhook conformance payload binding is invalid');
    }
    let wireRequest = parseWebhookWireRequest(request.capturedRequest);
    return {
      webhookRequestId: request.id,
      wireRequest,
      requestHash: request.requestHash,
      bodyHash: request.bodyHash,
      capturePolicyHash: request.capturePolicyHash
    };
  }

  async loadPayloadForHistoricalRewrite(d: { webhookRequestId: string }) {
    let request = await db.slateTriggerWebhookRequest.findUnique({
      where: { id: d.webhookRequestId },
    });
    if (!request?.capturedRequest) throw new Error('Historical webhook payload is unavailable');
    if (!request.tenantId || !request.receiverOwnerId) {
      throw new Error('Historical webhook payload binding is invalid');
    }
    return parseWebhookWireRequest(request.capturedRequest);
  }

  async enqueueWebhookRequest(d: {
    webhookRequestId: string;
    claimToken: string;
    excludeReceiverTriggerIds?: string[];
    delayMs?: number;
    jobId?: string;
  }) {
    let { delayMs, jobId, ...payload } = d;
    if (delayMs !== undefined || jobId !== undefined) {
      await slateTriggerWebhookQueue.add(payload, { delay: delayMs, id: jobId });
    } else {
      await slateTriggerWebhookQueue.add(payload);
    }
  }

  async claimSyncOwnership(d: {
    webhookRequestId: string;
    ownerToken: string;
    expiresAt: Date;
  }) {
    let result = await db.slateTriggerWebhookRequest.updateMany({
      where: { id: d.webhookRequestId, processedAt: null, syncOwnerToken: null },
      data: {
        syncOwnerToken: d.ownerToken,
        syncOwnerExpiresAt: d.expiresAt,
        syncOwnerCommitStartedAt: null
      }
    });
    return result.count === 1;
  }

  async prepareQueueTakeover(d: {
    webhookRequestId: string;
    ownerToken: string;
    claimToken: string;
  }) {
    return await db.$transaction(async tx => {
      let request = await tx.slateTriggerWebhookRequest.findFirst({
        where: {
          id: d.webhookRequestId,
          capturedRequest: { not: Prisma.JsonNull },
          capturedRequestExpiresAt: { gt: new Date() }
        },
        select: { oid: true }
      });
      if (!request) return false;
      let result = await tx.slateTriggerWebhookRequest.updateMany({
        where: {
          id: d.webhookRequestId,
          processedAt: null,
          syncOwnerToken: d.ownerToken,
          OR: [{ queueClaimToken: null }, { queueClaimToken: d.claimToken }]
        },
        data: {
          queueClaimToken: d.claimToken,
          queueClaimState: 'prepared'
        }
      });
      return result.count === 1;
    });
  }

  async confirmQueueTakeover(d: {
    webhookRequestId: string;
    ownerToken: string;
    claimToken: string;
  }) {
    let result = await db.slateTriggerWebhookRequest.updateMany({
      where: {
        id: d.webhookRequestId,
        processedAt: null,
        syncOwnerToken: d.ownerToken,
        queueClaimToken: d.claimToken,
        queueClaimState: 'prepared'
      },
      data: {
        syncOwnerToken: null,
        syncOwnerExpiresAt: null,
        syncOwnerCommitStartedAt: null,
        queueClaimState: 'owned',
        queueClaimedAt: new Date()
      }
    });
    return result.count === 1;
  }

  async abortPreparedQueueTakeover(d: {
    webhookRequestId: string;
    ownerToken: string;
    claimToken: string;
  }) {
    await db.slateTriggerWebhookRequest.updateMany({
      where: {
        id: d.webhookRequestId,
        processedAt: null,
        syncOwnerToken: d.ownerToken,
        queueClaimToken: d.claimToken,
        queueClaimState: 'prepared'
      },
      data: { queueClaimToken: null, queueClaimState: null, queueClaimedAt: null }
    });
  }

  async ownsSyncContinuation(d: { webhookRequestId: string; ownerToken: string }) {
    return Boolean(
      await db.slateTriggerWebhookRequest.findFirst({
        where: {
          id: d.webhookRequestId,
          processedAt: null,
          syncOwnerToken: d.ownerToken,
          syncOwnerExpiresAt: { gt: new Date() },
          syncOwnerCommitStartedAt: null
        },
        select: { id: true }
      })
    );
  }

  async enterSyncCommit(d: { webhookRequestId: string; ownerToken: string }) {
    let result = await db.slateTriggerWebhookRequest.updateMany({
      where: {
        id: d.webhookRequestId,
        processedAt: null,
        syncOwnerToken: d.ownerToken,
        syncOwnerExpiresAt: { gt: new Date() },
        syncOwnerCommitStartedAt: null
      },
      data: { syncOwnerCommitStartedAt: new Date() }
    });
    return result.count === 1;
  }

  async completeSyncTriggerCommit(d: {
    webhookRequestId: string;
    ownerToken: string;
    receiverTriggerId: string;
    continueRpc: boolean;
  }) {
    let result = await db.slateTriggerWebhookRequest.updateMany({
      where: {
        id: d.webhookRequestId,
        processedAt: null,
        syncOwnerToken: d.ownerToken,
        syncOwnerCommitStartedAt: { not: null },
        NOT: { syncCompletedReceiverTriggerIds: { has: d.receiverTriggerId } }
      },
      data: {
        syncCompletedReceiverTriggerIds: { push: d.receiverTriggerId },
        ...(d.continueRpc ? { syncOwnerCommitStartedAt: null } : {})
      }
    });
    return result.count === 1;
  }

  async recordSyncTriggerSkipped(d: {
    webhookRequestId: string;
    ownerToken: string;
    receiverTriggerId: string;
  }) {
    let result = await db.slateTriggerWebhookRequest.updateMany({
      where: {
        id: d.webhookRequestId,
        processedAt: null,
        syncOwnerToken: d.ownerToken,
        syncOwnerExpiresAt: { gt: new Date() },
        syncOwnerCommitStartedAt: null,
        NOT: { syncCompletedReceiverTriggerIds: { has: d.receiverTriggerId } }
      },
      data: { syncCompletedReceiverTriggerIds: { push: d.receiverTriggerId } }
    });
    return result.count === 1;
  }

  async releaseSyncOwnership(d: { webhookRequestId: string; ownerToken: string }) {
    await db.slateTriggerWebhookRequest.updateMany({
      where: { id: d.webhookRequestId, processedAt: null, syncOwnerToken: d.ownerToken },
      data: {
        syncOwnerToken: null,
        syncOwnerExpiresAt: null,
        syncOwnerCommitStartedAt: null
      }
    });
  }
}

export let slateTriggerWebhookRequestService = Service.create(
  'slateTriggerWebhookRequestService',
  () => new slateTriggerWebhookRequestServiceImpl()
).build();
