import { parseWebhookJsonBody } from '../webhookVerification';
import type { SharedAppExternalIdentity, SharedAppVendorAdapter } from './index';

let exactId = (value: unknown) => {
  if (typeof value === 'string' && value.length > 0 && value.length <= 512) return value;
  if (typeof value === 'number' && Number.isSafeInteger(value) && value >= 0) {
    return String(value);
  }
  return null;
};

let identityFor = (value: unknown): SharedAppExternalIdentity | null => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  let record = value as Record<string, unknown>;
  let appId = exactId(record.appId);
  let portalId = exactId(record.portalId);
  return appId && portalId ? { externalAppId: appId, externalAccountId: portalId } : null;
};

export let hubspotSharedAppAdapter: SharedAppVendorAdapter = {
  family: 'hubspot',
  preset: 'hubspot.v3',
  securityHeaders: ['x-hubspot-signature-v3', 'x-hubspot-request-timestamp'],
  extractAuthenticatedIdentity: request => {
    let body: unknown;
    try {
      body = parseWebhookJsonBody(request);
    } catch {
      return null;
    }
    let items = Array.isArray(body) ? body : [body];
    if (items.length === 0) return null;
    let identities = items.map(identityFor);
    let first = identities[0];
    if (!first || identities.some(identity => !identity)) return null;
    return identities.every(
      identity =>
        identity!.externalAppId === first.externalAppId &&
        identity!.externalAccountId === first.externalAccountId
    )
      ? first
      : null;
  }
};
