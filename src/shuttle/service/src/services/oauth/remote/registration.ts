import { Service } from '@lowerdeck/service';
import { db } from '../../../db';
import { getId } from '../../../id';
import { OAuthUtils } from '../../../lib/oauth/oauthUtils';
import { getRegistrationBlocker } from '../../../lib/oauth/registrationRetry';

class remoteOAuthRegistrationServiceImpl {
  async runAutoRegistration(d: { connectionId: string }) {
    let connection = await db.remoteOAuthConnection.findFirst({
      where: { id: d.connectionId },
      include: {
        config: true,
        tenant: true,
        _count: {
          select: { remoteOAuthConnectionAuthTokens: true, serverAuthConfigs: true }
        }
      }
    });
    if (!connection) return { ok: false as const, reason: 'not_found' as const };

    let blocker = getRegistrationBlocker({
      connection,
      boundTokenCount: connection._count.remoteOAuthConnectionAuthTokens,
      boundAuthConfigCount: connection._count.serverAuthConfigs
    });
    if (blocker) return { ok: false as const, reason: 'skipped' as const, blocker };

    if (!OAuthUtils.supportsAuthRegistration(connection.config.config)) {
      await db.remoteOAuthConnection.update({
        where: { oid: connection.oid },
        data: {
          discoveryStatus: 'failed',
          errorCode: 'auto_registration_unsupported',
          errorMessage: `OAuth provider does not support auto-registration.`
        }
      });

      return { ok: false as const, reason: 'unsupported' as const };
    }

    let attempt = connection.registrationAttemptCount + 1;
    await db.remoteOAuthConnection.update({
      where: { oid: connection.oid },
      data: {
        registrationAttemptCount: attempt,
        lastRegistrationAttemptAt: new Date()
      }
    });

    let reg = await OAuthUtils.registerClient({
      tenant: connection.tenant,
      config: connection.config.config,
      owner: {
        config: connection.config,
        connection
      }
    });

    if (reg?.ok) {
      await db.remoteOAuthConnection.update({
        where: { oid: connection.oid },
        data: {
          registrationOid: reg.registration.oid,
          clientId: reg.registration.clientId,
          discoveryStatus: 'succeeded',
          errorCode: null,
          errorMessage: null,
          registrationAttemptCount: 0
        }
      });

      await db.remoteOAuthConnectionEvent.create({
        data: {
          ...getId('remoteOAuthConnectionEvent'),
          connectionOid: connection.oid,
          type: 'auto_registration_succeeded',
          metadata: {
            clientId: reg.registration.clientId,
            attempt
          }
        }
      });

      return { ok: true as const, connection, registration: reg.registration };
    }

    let isTransient = reg?.isTransient ?? false;
    let baseErrorMessage =
      reg?.message ??
      'OAuth client registration failed because the provider could not be reached';
    let errorMessage = isTransient
      ? `${baseErrorMessage}. Try again later.`
      : `${baseErrorMessage}. Configure OAuth client credentials manually to continue.`;

    await db.remoteOAuthConnection.update({
      where: { oid: connection.oid },
      data: {
        discoveryStatus: 'failed',
        errorCode: 'auto_registration_failed',
        errorMessage,
        registrationAttemptCount: isTransient ? connection.registrationAttemptCount : attempt
      }
    });

    await db.remoteOAuthConnectionEvent.create({
      data: {
        ...getId('remoteOAuthConnectionEvent'),
        connectionOid: connection.oid,
        type: 'auto_registration_failed',
        metadata: {
          errorCode: 'auto_registration_failed',
          attempt,
          status: reg?.status ?? null,
          oauthCode: reg?.oauthCode ?? null,
          retryable: isTransient
        }
      }
    });

    return { ok: false as const, reason: 'failed' as const, isTransient };
  }
}

export let remoteOAuthRegistrationService = Service.create(
  'remoteOAuthRegistration',
  () => new remoteOAuthRegistrationServiceImpl()
).build();
