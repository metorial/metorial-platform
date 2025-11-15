import { Context } from '@metorial/context';
import {
  ConsumerProfile,
  ConsumerSession,
  ConsumerSurface,
  db,
  ID,
  SsoUser,
  withTransaction
} from '@metorial/db';
import { badRequestError, ServiceError } from '@metorial/error';
import { generateCode, generatePlainId } from '@metorial/id';
import { Service } from '@metorial/service';
import { Tokens } from '@metorial/tokens';
import { addMinutes, addSeconds } from 'date-fns';
import { env } from '../env';

let consumerSessionToken = new Tokens({
  secret: env.tokens.CONSUMER_SESSION_SECRET
});

let consumerToken = new Tokens({
  secret: env.tokens.CONSUMER_TOKEN_SECRET
});

class consumerAuthServiceImpl {
  async authenticateWithEmailCodeStart(d: {
    surface: ConsumerSurface;
    input: { email: string };
  }) {
    let factor = await db.consumerSurfaceAuthFactor.findFirst({
      where: {
        consumerSurfaceOid: d.surface.oid,
        type: 'email_code',
        status: 'active'
      }
    });
    if (!factor) {
      throw new ServiceError(
        badRequestError({
          message: 'Email authentication is not allowed.'
        })
      );
    }

    let code = await db.consumerAuthCode.create({
      data: {
        id: await ID.generateId('consumerSurfaceAuthFactor'),
        status: 'sent',
        deliveryMethod: 'email',
        code: generateCode(6),
        expiresAt: addMinutes(new Date(), 30),
        email: d.input.email,
        factorOid: factor.oid
      }
    });

    return {
      ...code,
      code: '******'
    };
  }

  async authenticateWithEmailCodeComplete(d: {
    context: Context;
    surface: ConsumerSurface;
    input: { email: string; code: string };
  }) {
    let factor = await db.consumerSurfaceAuthFactor.findFirst({
      where: {
        consumerSurfaceOid: d.surface.oid,
        type: 'email_code',
        status: 'active'
      }
    });
    if (!factor) {
      throw new ServiceError(
        badRequestError({
          message: 'Email authentication is not allowed.'
        })
      );
    }

    let code = await db.consumerAuthCode.findFirst({
      where: {
        factorOid: factor.oid,
        email: d.input.email,
        code: d.input.code,
        status: 'sent'
      }
    });
    if (!code) {
      throw new ServiceError(
        badRequestError({
          message: 'The provided code is invalid.'
        })
      );
    }

    if (code.expiresAt < new Date()) {
      throw new ServiceError(
        badRequestError({
          message: 'The provided code has expired.'
        })
      );
    }

    return withTransaction(async db => {
      await db.consumerAuthCode.update({
        where: { oid: code.oid },
        data: { status: 'verified' }
      });

      let consumerProfile = await this.ensureConsumerProfile({
        surface: d.surface,
        email: d.input.email,
        name: d.input.email.split('@')[0],
        overrideName: false
      });

      return this.createConsumerSession({
        consumerProfile,
        context: d.context,
        consumerSurface: d.surface
      });
    });
  }

  async getSsoFactor(d: { surface: ConsumerSurface; factorId: string }) {
    let factor = await db.consumerSurfaceAuthFactor.findFirst({
      where: {
        consumerSurfaceOid: d.surface.oid,
        id: d.factorId,
        type: 'sso',
        status: 'active'
      }
    });
    if (!factor) {
      throw new ServiceError(
        badRequestError({
          message: 'The provided SSO factor is invalid.'
        })
      );
    }

    return factor;
  }

  async authenticateWithSsoComplete(d: {
    surface: ConsumerSurface;
    ssoUser: SsoUser;
    context: Context;
  }) {
    let consumerProfile = await this.ensureConsumerProfile({
      surface: d.surface,
      email: d.ssoUser.email,
      name:
        `${d.ssoUser.firstName} ${d.ssoUser.lastName}`.trim() || d.ssoUser.email.split('@')[0],
      overrideName: true,
      ssoUser: d.ssoUser
    });

    return this.createConsumerSession({
      consumerProfile,
      context: d.context,
      consumerSurface: d.surface
    });
  }

  async getConsumerSessionToken(d: { session: ConsumerSession }) {
    return await consumerSessionToken.sign({
      type: 'consumer_session',
      data: {
        sessionId: d.session.id,
        nonce: d.session.tokenNonce
      },
      expiresAt: d.session.expiresAt
    });
  }

  async getConsumerAuthToken(d: {}) {}

  private async ensureConsumerProfile(d: {
    surface: ConsumerSurface;
    email: string;
    name: string;
    overrideName: boolean;
    ssoUser?: SsoUser;
  }) {
    return withTransaction(async db => {
      let consumer = await db.consumer.upsert({
        where: {
          email_organizationOid: {
            email: d.email,
            organizationOid: d.surface.organizationOid
          }
        },
        create: {
          id: await ID.generateId('consumer'),
          email: d.email,
          name: d.name,
          organizationOid: d.surface.organizationOid
        },
        update: {
          email: d.email,
          name: d.overrideName ? d.name : undefined
        }
      });

      return await db.consumerProfile.upsert({
        where: {
          email_surfaceOid: {
            email: d.email,
            surfaceOid: d.surface.oid
          }
        },
        create: {
          id: await ID.generateId('consumerProfile'),
          email: d.email,
          name: d.name,

          surfaceOid: d.surface.oid,
          consumerOid: consumer.oid,
          ssoUserOid: d.ssoUser?.oid ?? null,
          organizationOid: d.surface.organizationOid
        },
        update: {
          email: d.email,
          name: d.overrideName ? d.name : undefined
        }
      });
    });
  }

  private async createConsumerSession(d: {
    consumerSurface: ConsumerSurface;
    consumerProfile: ConsumerProfile;
    context: Context;
  }) {
    return withTransaction(async db => {
      return await db.consumerSession.create({
        data: {
          id: await ID.generateId('consumerSurface'),
          tokenNonce: generatePlainId(35),
          ip: d.context.ip,
          ua: d.context.ua ?? 'unknown',
          consumerProfileOid: d.consumerProfile.oid,
          expiresAt: addSeconds(new Date(), d.consumerSurface.sessionExpiryTimeInSeconds)
        }
      });
    });
  }
}

export let consumerAuthService = Service.create(
  'consumerAuthService',
  () => new consumerAuthServiceImpl()
).build();
