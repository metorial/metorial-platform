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
      },
      captureErrors: connection.registrationAttemptCount == 0
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

    let inner = (reg?.error.payload as any)?.error || 'unknown_error';

    let jsonInner = inner;
    try {
      jsonInner = JSON.stringify(inner);
    } catch (e) {}

    let isTransient = reg?.isTransient ?? false;

    await db.remoteOAuthConnection.update({
      where: { oid: connection.oid },
      data: {
        discoveryStatus: 'failed',
        errorCode: 'auto_registration_failed',
        errorMessage: `Failed to auto-register OAuth client for connection: ${jsonInner}`,
        registrationAttemptCount: isTransient ? connection.registrationAttemptCount : attempt
      }
    });

    await db.remoteOAuthConnectionEvent.create({
      data: {
        ...getId('remoteOAuthConnectionEvent'),
        connectionOid: connection.oid,
        type: 'auto_registration_failed',
        metadata: {
          error: inner,
          attempt,
          status: reg?.status ?? null
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
