import { createHash } from 'node:crypto';

export type SharedOAuthIdentity = {
  authConfigOid: bigint;
  slateOid: bigint;
  authMethodKey: string;
  clientId: string;
  profileUid: string | null;
};

export let sharedOAuthRefreshLockKey = (identity: SharedOAuthIdentity) => {
  if (!identity.profileUid) return `cfg:${identity.authConfigOid}`;

  let hash = createHash('sha256')
    .update(
      JSON.stringify([
        String(identity.slateOid),
        identity.clientId,
        identity.authMethodKey,
        identity.profileUid
      ])
    )
    .digest('hex');

  return `idn:${hash}`;
};

export let getRefreshToken = (output: Record<string, any> | undefined) => {
  let token = output?.refreshToken;
  return typeof token === 'string' && token.length > 0 ? token : null;
};

export let changedOutputEntries = (
  previous: Record<string, any> | undefined,
  next: Record<string, any> | undefined
) => {
  let changes: Record<string, any> = {};
  if (!next) return changes;

  for (let [key, value] of Object.entries(next)) {
    if (value === undefined) continue;
    if (JSON.stringify(previous?.[key]) !== JSON.stringify(value)) {
      changes[key] = value;
    }
  }

  return changes;
};
