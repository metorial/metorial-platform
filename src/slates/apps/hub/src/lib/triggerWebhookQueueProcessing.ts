export type PendingWebhookQueueRequest = {
  id: string;
  receiverTriggerId: string | null;
  receiverId: string | null;
  syncOwnerToken: string | null;
  syncOwnerExpiresAt: Date | null;
  syncOwnerCommitStartedAt: Date | null;
  syncCompletedReceiverTriggerIds: string[];
};

export type WebhookQueueProcessingDependencies<Request extends PendingWebhookQueueRequest> = {
  loadPendingRequest: (webhookRequestId: string) => Promise<Request | null>;
  usingLock: <T>(key: string, callback: () => Promise<T>) => Promise<T>;
  fenceExpiredOwner: (request: Request) => Promise<void>;
  targetExists: (request: Request) => Promise<boolean>;
  handleTarget: (
    request: Request,
    excludeReceiverTriggerIds: string[],
    onReceiverTriggerCompleted: (receiverTriggerId: string) => Promise<void>
  ) => Promise<void>;
  checkpointTriggerCompleted: (request: Request, receiverTriggerId: string) => Promise<void>;
  finalize: (request: Request) => Promise<unknown>;
  now?: () => Date;
};

export type WebhookQueueProcessingResult = 'processed' | 'skipped' | 'ownerActive';

export let processSlateTriggerWebhookQueueRequest = async <
  Request extends PendingWebhookQueueRequest
>(
  data: { webhookRequestId: string; excludeReceiverTriggerIds?: string[] },
  dependencies: WebhookQueueProcessingDependencies<Request>
): Promise<WebhookQueueProcessingResult> => {
  let request = await dependencies.loadPendingRequest(data.webhookRequestId);
  if (!request) return 'skipped';

  let lockKey = request.receiverTriggerId
    ? request.receiverTriggerId
    : request.receiverId
      ? `receiver:${request.receiverId}`
      : null;
  if (!lockKey) {
    await dependencies.finalize(request);
    return 'processed';
  }

  return dependencies.usingLock(lockKey, async () => {
    // A delayed fallback may have loaded the row before the inline owner completed. Re-reading
    // after lock acquisition is the fence that turns that job into a no-op after late success.
    let lockedRequest = await dependencies.loadPendingRequest(data.webhookRequestId);
    if (!lockedRequest) return 'skipped';

    let now = (dependencies.now ?? (() => new Date()))();
    if (
      lockedRequest.syncOwnerToken &&
      lockedRequest.syncOwnerExpiresAt &&
      lockedRequest.syncOwnerExpiresAt.getTime() > now.getTime()
    ) {
      return 'ownerActive';
    }

    if (lockedRequest.syncOwnerToken) {
      await dependencies.fenceExpiredOwner(lockedRequest);
    }

    if (!(await dependencies.targetExists(lockedRequest))) {
      await dependencies.finalize(lockedRequest);
      return 'processed';
    }

    let excludeReceiverTriggerIds = [
      ...new Set([
        ...(data.excludeReceiverTriggerIds ?? []),
        ...lockedRequest.syncCompletedReceiverTriggerIds
      ])
    ];
    await dependencies.handleTarget(
      lockedRequest,
      excludeReceiverTriggerIds,
      async receiverTriggerId => {
        // This checkpoint closes retries between completed fanout members. A process crash after
        // a provider side effect but before this write remains the queue's at-least-once boundary.
        await dependencies.checkpointTriggerCompleted(lockedRequest, receiverTriggerId);
        if (!lockedRequest.syncCompletedReceiverTriggerIds.includes(receiverTriggerId)) {
          lockedRequest.syncCompletedReceiverTriggerIds.push(receiverTriggerId);
        }
      }
    );
    await dependencies.finalize(lockedRequest);
    return 'processed';
  });
};
