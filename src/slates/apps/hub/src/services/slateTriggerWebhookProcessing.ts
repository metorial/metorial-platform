import { createLock } from '@lowerdeck/lock';
import { db } from '../db';
import { env } from '../env';
import type { TriggerWebhookRequestPayload } from '../lib/triggerWebhook';
import { redactWebhookHeaders, redactWebhookUrl } from '../lib/webhookRequestCapture';
import { WEBHOOK_PAYLOAD_TERMINAL_RETENTION_MS } from './slateTriggerWebhookRequest';

let webhookLock: ReturnType<typeof createLock> | undefined;

export let getSlateTriggerWebhookLock = () => {
  webhookLock ??= createLock({
    name: 'shub/trg/webhook/lock',
    redisUrl: env.service.REDIS_URL
  });
  return webhookLock;
};

type TriggerWebhookBody = TriggerWebhookRequestPayload['body'];

let headerTuples = (headers: unknown): [string, string][] => {
  if (Array.isArray(headers)) {
    return headers.flatMap(header =>
      Array.isArray(header) &&
      header.length === 2 &&
      typeof header[0] === 'string' &&
      typeof header[1] === 'string'
        ? [[header[0], header[1]] as [string, string]]
        : []
    );
  }
  if (headers && typeof headers === 'object') {
    return Object.entries(headers).flatMap(([name, value]) =>
      typeof value === 'string' ? ([[name, value]] as [string, string][]) : []
    );
  }
  return [];
};

/** The common terminal choke point. Raw request bytes are never archived here. */
export let finalizeWebhookRequest = async (d: {
  request: {
    id: string;
    receiverTriggerId: string | null;
    receiverId: string | null;
    url: string;
    method: string;
    headers: unknown;
    createdAt: Date;
  };
  body: TriggerWebhookBody;
  ownerToken?: string;
  queueClaimToken?: string;
  outcome?: 'accepted' | 'rejected' | 'failed';
  safeRejectionCode?: string;
  now?: Date;
}) => {
  let now = d.now ?? new Date();
  let pathSecret = (() => {
    try {
      let parts = new URL(d.request.url).pathname.split('/').filter(Boolean);
      let webhookIndex = parts.findIndex(
        part => part === 'webhook' || part === 'receiver-webhook'
      );
      return webhookIndex >= 0 && parts.length > webhookIndex + 2
        ? decodeURIComponent(parts[webhookIndex + 2]!)
        : undefined;
    } catch {
      return undefined;
    }
  })();
  let redactedUrl = redactWebhookUrl(d.request.url, pathSecret);
  let redactedHeaders = redactWebhookHeaders(headerTuples(d.request.headers));

  return await db.$transaction(async tx => {
    let owned = await tx.slateTriggerWebhookRequest.findFirst({
      where: {
        id: d.request.id,
        processedAt: null,
        ...(d.ownerToken
          ? {
              syncOwnerToken: d.ownerToken,
              syncOwnerCommitStartedAt: { not: null }
            }
          : {}),
        ...(d.queueClaimToken
          ? { queueClaimToken: d.queueClaimToken, queueClaimState: 'owned' }
          : {})
      },
      select: {
        payload: { select: { expiresAt: true } }
      }
    });
    if (!owned) return false;
    let finalized = await tx.slateTriggerWebhookRequest.updateMany({
      where: {
        id: d.request.id,
        processedAt: null,
        ...(d.ownerToken
          ? {
              syncOwnerToken: d.ownerToken,
              syncOwnerCommitStartedAt: { not: null }
            }
          : {}),
        ...(d.queueClaimToken
          ? { queueClaimToken: d.queueClaimToken, queueClaimState: 'owned' }
          : {})
      },
      data: {
        processedAt: now,
        bodyStorageKey: null,
        body: null,
        url: redactedUrl,
        headers: redactedHeaders,
        redactedUrl,
        redactedHeaders,
        outcome: d.outcome ?? 'accepted',
        safeRejectionCode: d.safeRejectionCode,
        terminalFailureAt: (d.outcome ?? 'accepted') === 'failed' ? now : null,
        syncOwnerToken: null,
        syncOwnerExpiresAt: null,
        syncOwnerCommitStartedAt: null,
        queueClaimState: null,
        queueClaimToken: null,
        queueClaimedAt: null
      }
    });
    if (finalized.count !== 1) {
      throw new Error('Webhook finalization ownership was lost');
    }

    await tx.slateTriggerWebhookRequestPayload.updateMany({
      where: { request: { id: d.request.id }, consumedAt: null },
      data: {
        consumedAt: now,
        terminalOutcome: d.outcome ?? 'accepted',
        // Task 7 may already have extended this payload for replay/outbox recovery. Terminal
        // redaction must never shorten that live reference window.
        expiresAt: new Date(
          Math.max(
            owned.payload?.expiresAt.getTime() ?? 0,
            now.getTime() + WEBHOOK_PAYLOAD_TERMINAL_RETENTION_MS
          )
        )
      }
    });
    return true;
  });
};
