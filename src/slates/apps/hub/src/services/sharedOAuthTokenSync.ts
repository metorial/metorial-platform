import { getSentry } from '@lowerdeck/sentry';
import { db } from '../db';
import { extractExpiresAt } from '../lib/extractExpiresAt';
import {
  changedOutputEntries,
  getRefreshToken,
  type SharedOAuthIdentity
} from '../lib/sharedOAuthTokens';
import { secretService } from './secret';

let Sentry = getSentry();

let SYNC_CONCURRENCY = 5;

// Some providers (e.g. Slack) issue the same token pair to every install of an
// app in a workspace. Keeps configs holding that pair in sync after a refresh.
export let syncSharedOAuthTokens = async (d: {
  source: SharedOAuthIdentity & { authConfigId: string };
  previousOutput: Record<string, any> | undefined;
  newOutput: Record<string, any> | undefined;
}) => {
  let previousRefreshToken = getRefreshToken(d.previousOutput);
  if (!previousRefreshToken || !d.source.profileUid) return { synced: 0 };

  let changes = changedOutputEntries(d.previousOutput, d.newOutput);
  if (!('refreshToken' in changes)) return { synced: 0 };

  let siblings = await db.slateAuthConfig.findMany({
    where: {
      oid: { not: d.source.authConfigOid },
      type: 'oauth_automated',
      errorCode: null,
      slateOid: d.source.slateOid,
      profileUid: d.source.profileUid,
      authMethod: { key: d.source.authMethodKey },
      oauthCredentials: { clientId: d.source.clientId },
      secret: { status: 'active' }
    },
    include: { secret: true, tenant: true }
  });

  let syncOne = async (sibling: (typeof siblings)[number]) => {
    let secretData = await secretService.DANGEROUSLY_decryptSecret({
      secret: sibling.secret,
      purpose: 'slate_authentication_configuration',
      tenant: sibling.tenant,
      note: `oauth-sibling-sync cfg:${sibling.id}`
    });

    if (getRefreshToken(secretData.output) !== previousRefreshToken) return false;

    let currentSecret = await db.secret.findUnique({ where: { oid: sibling.secret.oid } });
    if (!currentSecret || currentSecret.status !== 'active') return false;

    secretData.output = { ...secretData.output, ...changes };

    await secretService.DANGEROUSLY_updateSecret({
      secret: currentSecret,
      purpose: 'slate_authentication_configuration',
      tenant: sibling.tenant,
      secretData
    });

    await db.slateAuthConfig.updateMany({
      where: { oid: sibling.oid },
      data: { tokenExpiresAt: extractExpiresAt(secretData.output) }
    });

    console.info(
      `OAUTH.sibling_sync.synced source=${d.source.authConfigId} sibling=${sibling.id}`
    );
    return true;
  };

  let synced = 0;

  for (let i = 0; i < siblings.length; i += SYNC_CONCURRENCY) {
    let batch = siblings.slice(i, i + SYNC_CONCURRENCY);
    let results = await Promise.allSettled(batch.map(syncOne));

    results.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        if (result.value) synced++;
        return;
      }

      let sibling = batch[index]!;
      console.error(
        `OAUTH.sibling_sync.failed source=${d.source.authConfigId} sibling=${sibling.id}`,
        result.reason
      );
      Sentry.captureException(result.reason, {
        extra: { sourceAuthConfigId: d.source.authConfigId, siblingAuthConfigId: sibling.id }
      });
    });
  }

  return { synced };
};
