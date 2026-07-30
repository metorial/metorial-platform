import { createHmac } from 'crypto';

export let aresSyncEventTypes = ['user.changed', 'sso_tenant.changed'] as const;

export type AresSyncEventType = (typeof aresSyncEventTypes)[number];

// TODO: ares still needs to emit `sso_user.changed` for SSO user attribute updates and
// `sso_user_membership.changed` for group/role assignment changes (SAML and SCIM). Consumers
// then have to apply them; until that exists only the group/role catalog is delivered.
export type AresSyncEvent =
  | {
      type: 'user.changed';
      data: { appId: string; userId: string; revision: string };
    }
  | {
      type: 'sso_tenant.changed';
      data: { appId: string; tenantId: string; revision: string };
    };

export let signAresSyncEventBody = (input: { secret: string; body: string }) => {
  let timestamp = Math.floor(Date.now() / 1000).toString();
  let signature = createHmac('sha256', input.secret)
    .update(`${timestamp}.${input.body}`)
    .digest('hex');

  return `t=${timestamp},v1=${signature}`;
};
