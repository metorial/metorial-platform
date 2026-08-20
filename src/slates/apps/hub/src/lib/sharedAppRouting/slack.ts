import { parseWebhookJsonBody } from '../webhookVerification';
import type { SharedAppExternalIdentity, SharedAppVendorAdapter } from './index';

let exactString = (value: unknown) =>
  typeof value === 'string' && value.length > 0 && value.length <= 512 ? value : null;

let identityFromRecord = (
  record: Record<string, unknown>
): SharedAppExternalIdentity | null => {
  let team = record.team;
  let teamId =
    exactString(record.team_id) ??
    (team && typeof team === 'object' && !Array.isArray(team)
      ? exactString((team as Record<string, unknown>).id)
      : null);
  let appId = exactString(record.api_app_id);
  return teamId && appId ? { externalAppId: appId, externalAccountId: teamId } : null;
};

let parseSlackBody = (
  request: Parameters<SharedAppVendorAdapter['extractAuthenticatedIdentity']>[0]
) => {
  try {
    let json = parseWebhookJsonBody(request);
    if (json && typeof json === 'object' && !Array.isArray(json)) {
      return json as Record<string, unknown>;
    }
  } catch {
    // Slack interactions are form encoded and carry a JSON `payload` field.
  }
  if (!request.body.present) return null;
  let form = new URLSearchParams(Buffer.from(request.body.base64, 'base64').toString('utf8'));
  let payloads = form.getAll('payload');
  if (payloads.length === 1) {
    try {
      let value = JSON.parse(payloads[0]!);
      return value && typeof value === 'object' && !Array.isArray(value)
        ? (value as Record<string, unknown>)
        : null;
    } catch {
      return null;
    }
  }
  return Object.fromEntries(form.entries());
};

export let slackSharedAppAdapter: SharedAppVendorAdapter = {
  family: 'slack',
  preset: 'slack.v0',
  securityHeaders: ['x-slack-signature', 'x-slack-request-timestamp'],
  extractAuthenticatedIdentity: request => {
    let record = parseSlackBody(request);
    return record ? identityFromRecord(record) : null;
  }
};
