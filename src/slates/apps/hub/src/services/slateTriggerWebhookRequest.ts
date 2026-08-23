import { badRequestError, notFoundError, ServiceError } from '@lowerdeck/error';
import { Service } from '@lowerdeck/service';
import { db } from '../db';
import { getId } from '../id';
import type { TriggerWebhookRequestPayload } from '../lib/triggerWebhook';
import { slateTriggerWebhookQueue } from '../queues/trigger/webhook';

class slateTriggerWebhookRequestServiceImpl {
  async createWebhookRequest(d: {
    receiverTriggerId?: string;
    receiverId?: string;
    request: TriggerWebhookRequestPayload;
    enqueue?: boolean;
  }) {
    if (Boolean(d.receiverTriggerId) === Boolean(d.receiverId)) {
      throw new ServiceError(
        badRequestError({
          message: 'Exactly one webhook target is required.'
        })
      );
    }

    if (d.receiverTriggerId) {
      let receiverTrigger = await db.slateTriggerReceiverTrigger.findFirst({
        where: { id: d.receiverTriggerId },
        select: { id: true }
      });
      if (!receiverTrigger) {
        throw new ServiceError(notFoundError('slate.trigger.receiver_trigger'));
      }
    }

    if (d.receiverId) {
      let receiver = await db.slateTriggerReceiver.findFirst({
        where: { id: d.receiverId },
        select: { id: true }
      });
      if (!receiver) {
        throw new ServiceError(notFoundError('slate.trigger.receiver'));
      }
    }

    let record = await db.slateTriggerWebhookRequest.create({
      data: {
        ...getId('slateTriggerWebhookRequest'),
        receiverTriggerId: d.receiverTriggerId,
        receiverId: d.receiverId,
        url: d.request.url,
        method: d.request.method,
        headers: d.request.headers,
        body: d.request.body
      }
    });

    if (d.enqueue !== false) {
      await this.enqueueWebhookRequest({ webhookRequestId: record.id });
    }

    return record;
  }

  async enqueueWebhookRequest(d: {
    webhookRequestId: string;
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
      where: {
        id: d.webhookRequestId,
        processedAt: null,
        syncOwnerToken: null
      },
      data: {
        syncOwnerToken: d.ownerToken,
        syncOwnerExpiresAt: d.expiresAt,
        syncOwnerCommitStartedAt: null
      }
    });
    return result.count === 1;
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
      data: {
        syncOwnerCommitStartedAt: new Date()
      }
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
      data: {
        syncCompletedReceiverTriggerIds: { push: d.receiverTriggerId }
      }
    });
    return result.count === 1;
  }

  async releaseSyncOwnership(d: { webhookRequestId: string; ownerToken: string }) {
    await db.slateTriggerWebhookRequest.updateMany({
      where: {
        id: d.webhookRequestId,
        processedAt: null,
        syncOwnerToken: d.ownerToken
      },
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
