export let WEBHOOK_SKIP_REASON_INTEGRATION_REJECTED = 'integration_rejected_request';

type WebhookSkip = { reason: string; retryable: boolean };

let isRetryableStatus = (status: number) =>
  status >= 500 || status === 408 || status === 425 || status === 429;

// Older SDKs reject via "no events + 4xx"; retryable responses must still reach the provider.
export let resolveWebhookSkip = (result: {
  events: unknown[];
  response?: { status: number } | null;
  skipped?: { reason: string } | null;
}): WebhookSkip | null => {
  let status = result.response?.status;

  if (result.skipped) {
    return {
      reason: result.skipped.reason,
      retryable: status !== undefined && isRetryableStatus(status)
    };
  }

  if (
    result.events.length === 0 &&
    status !== undefined &&
    status >= 400 &&
    status < 500 &&
    !isRetryableStatus(status)
  ) {
    return { reason: WEBHOOK_SKIP_REASON_INTEGRATION_REJECTED, retryable: false };
  }

  return null;
};
