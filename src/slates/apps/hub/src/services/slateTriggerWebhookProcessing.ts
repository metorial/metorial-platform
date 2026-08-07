import { createLock } from '@lowerdeck/lock';
import { db } from '../db';
import { env } from '../env';
import {
  getTriggerWebhookRequestStorageKey,
  type TriggerWebhookRequestPayload
} from '../lib/triggerWebhook';
import { invocationsBucketRecord, storage } from '../storage';

let webhookLock: ReturnType<typeof createLock> | undefined;

export let getSlateTriggerWebhookLock = () => {
  webhookLock ??= createLock({
    name: 'shub/trg/webhook/lock',
    redisUrl: env.service.REDIS_URL
  });

  return webhookLock;
};

type TriggerWebhookBody = TriggerWebhookRequestPayload['body'];

export let finalizeWebhookRequest = async (d: {
  request: {
    id: string;
    receiverTriggerId: string | null;
    receiverId: string | null;
    url: string;
    method: string;
    headers: Record<string, string>;
    createdAt: Date;
  };
  body: TriggerWebhookBody;
  ownerToken?: string;
}) => {
  if (d.ownerToken) {
    let ownsRequest = await db.slateTriggerWebhookRequest.findFirst({
      where: {
        id: d.request.id,
        processedAt: null,
        syncOwnerToken: d.ownerToken,
        syncOwnerCommitStartedAt: { not: null }
      },
      select: { id: true }
    });
    if (!ownsRequest) return false;
  }

  let bodyStorageKey = d.body ? getTriggerWebhookRequestStorageKey(d.request.id) : null;

  if (d.body && bodyStorageKey) {
    await storage.putObject(
      invocationsBucketRecord.bucket,
      bodyStorageKey,
      JSON.stringify({
        id: d.request.id,
        receiverTriggerId: d.request.receiverTriggerId,
        receiverId: d.request.receiverId,
        url: d.request.url,
        method: d.request.method,
        headers: d.request.headers,
        body: d.body,
        createdAt: d.request.createdAt
      })
    );
  }

  let finalized = await db.slateTriggerWebhookRequest.updateMany({
    where: {
      id: d.request.id,
      processedAt: null,
      ...(d.ownerToken
        ? {
            syncOwnerToken: d.ownerToken,
            syncOwnerCommitStartedAt: { not: null }
          }
        : {})
    },
    data: {
      processedAt: new Date(),
      bodyStorageKey,
      body: null,
      syncOwnerToken: null,
      syncOwnerExpiresAt: null,
      syncOwnerCommitStartedAt: null
    }
  });
  return finalized.count === 1;
};
