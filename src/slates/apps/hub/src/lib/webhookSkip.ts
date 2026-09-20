export let WEBHOOK_SKIP_REASON_INTEGRATION_REJECTED = 'integration_rejected_request';

export type WebhookSkip = { reason: string };

// Pre-`skipped` SDKs can only reject via "no events + 4xx"; 5xx is an integration failure and must reach the provider.
export let resolveWebhookSkip = (result: {
  events: unknown[];
  response?: { status: number } | null;
  skipped?: WebhookSkip | null;
}): WebhookSkip | null => {
  if (result.skipped) return result.skipped;

  let status = result.response?.status;
  if (result.events.length === 0 && status !== undefined && status >= 400 && status < 500) {
    return { reason: WEBHOOK_SKIP_REASON_INTEGRATION_REJECTED };
  }

  return null;
};
