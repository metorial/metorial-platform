import { createHmac } from 'crypto';

export let aresSyncEventTypes = [
  'user.changed',
  'sso_tenant.changed',
  'sso_user.changed',
  'sso_user_membership.changed'
] as const;

export type AresSyncEventType = (typeof aresSyncEventTypes)[number];

export let aresSsoUserSyncEventTypes = [
  'sso_user.changed',
  'sso_user_membership.changed'
] as const satisfies readonly AresSyncEventType[];

export type AresSsoUserSyncEventType = (typeof aresSsoUserSyncEventTypes)[number];

export type AresSyncEvent =
  | {
      type: 'user.changed';
      data: { appId: string; userId: string; revision: string };
    }
  | {
      type: 'sso_tenant.changed';
      data: { appId: string; tenantId: string; revision: string };
    }
  | {
      type: AresSsoUserSyncEventType;
      data: { appId: string; tenantId: string; ssoUserId: string; revision: string };
    };

export let signAresSyncEventBody = (input: { secret: string; body: string }) => {
  let timestamp = Math.floor(Date.now() / 1000).toString();
  let signature = createHmac('sha256', input.secret)
    .update(`${timestamp}.${input.body}`)
    .digest('hex');

  return `t=${timestamp},v1=${signature}`;
};
