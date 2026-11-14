import { Context } from '@metorial/context';
import {
  ConsumerProfile,
  ID,
  OAuthAuthorization,
  Prisma,
  withTransaction
} from '@metorial/db';
import { addYears } from 'date-fns';

let OAUTH_CONSUMER_SESSION_LIFETIME_YEARS = 100;

export let ensureOAuthConsumerSession = async (d: {
  oauthAuthorization: OAuthAuthorization;
  consumerProfile: ConsumerProfile;
  context: Context;
}) =>
  await withTransaction(async db => {
    let session = {
      consumerProfileOid: d.consumerProfile.oid,
      ua: d.context.ua ?? 'unknown',
      ip: d.context.ip,
      expiresAt: addYears(new Date(), OAUTH_CONSUMER_SESSION_LIFETIME_YEARS),
      loggedOutAt: null,
      lastUsedAt: new Date()
    };

    return await db.consumerSession.upsert({
      where: { oauthAuthorizationOid: d.oauthAuthorization.oid },
      create: {
        id: await ID.generateId('consumerSession'),
        tokenNonce: await ID.generateId('clientSecret'),
        oauthAuthorizationOid: d.oauthAuthorization.oid,
        ...session
      },
      update: session
    });
  });

export let revokeOAuthConsumerSessions = async (d: {
  oauthAuthorization: Prisma.OAuthAuthorizationWhereInput;
}) =>
  await withTransaction(async db => {
    await db.consumerSession.updateMany({
      where: {
        oauthAuthorization: d.oauthAuthorization,
        loggedOutAt: null
      },
      data: { loggedOutAt: new Date() }
    });
  });

export let revokeOAuthConsumerSession = async (d: {
  oauthAuthorization: Pick<OAuthAuthorization, 'oid'>;
}) =>
  await revokeOAuthConsumerSessions({
    oauthAuthorization: { oid: d.oauthAuthorization.oid }
  });
