import { parseWebhookJsonBody } from '../webhookVerification';
import type { SharedAppVendorAdapter } from './index';

let exactString = (value: unknown) =>
  typeof value === 'string' && value.length > 0 && value.length <= 512 ? value : null;

export let zoomSharedAppAdapter: SharedAppVendorAdapter = {
  family: 'zoom',
  preset: 'zoom.v0',
  securityHeaders: ['x-zm-signature', 'x-zm-request-timestamp'],
  extractAuthenticatedIdentity: request => {
    let body: unknown;
    try {
      body = parseWebhookJsonBody(request);
    } catch {
      return null;
    }
    if (!body || typeof body !== 'object' || Array.isArray(body)) return null;
    let payload = (body as Record<string, unknown>).payload;
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return null;
    let accountId = exactString((payload as Record<string, unknown>).account_id);
    return accountId ? { externalAccountId: accountId } : null;
  }
};
