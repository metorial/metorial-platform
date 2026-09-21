export let WEBHOOK_SKIP_REASON_INTEGRATION_REJECTED = 'integration_rejected_request';

export type WebhookSkip = { reason: string };

// Older SDKs reject via "no events + 4xx"; retryable responses must still reach the provider.
export let resolveWebhookSkip = (result: {
  events: unknown[];
  response?: { status: number } | null;
  skipped?: WebhookSkip | null;
}): WebhookSkip | null => {
  if (result.skipped) return result.skipped;

  let status = result.response?.status;
  if (
    result.events.length === 0 &&
    status !== undefined &&
    status >= 400 &&
    status < 500 &&
    status !== 408 &&
    status !== 425 &&
    status !== 429
  ) {
    return { reason: WEBHOOK_SKIP_REASON_INTEGRATION_REJECTED };
  }

  return null;
};
