import { Context } from '@metorial/context';
import {
  ConsumerProfile,
  ConsumerSession,
  ConsumerSurface,
  db,
  ID,
  Organization,
  SsoUser,
  SsoUserProfile,
  withTransaction
} from '@metorial/db';
import { badRequestError, ServiceError, unauthorizedError } from '@metorial/error';
import { generateCode, generatePlainId } from '@metorial/id';
import { Service } from '@metorial/service';
import { Tokens } from '@metorial/tokens';
import { addMinutes, addSeconds } from 'date-fns';
import { env } from '../env';
import { authCodeQueue } from '../queues/authCode';

let consumerSessionToken = new Tokens({
  secret: env.tokens.CONSUMER_SESSION_SECRET
});

let consumerToken = new Tokens({
  secret: env.tokens.CONSUMER_TOKEN_SECRET
});

class consumerAuthServiceImpl {
  private ensureSurfaceIsActive(d: { surface: ConsumerSurface }) {
    if (d.surface.status !== 'active') {
      throw new ServiceError(
        badRequestError({
          message: 'The consumer surface is not active.'
        })
      );
    }
  }

  async authenticateWithEmailCodeStart(d: {
    surface: ConsumerSurface;
    input: { email: string };
  }) {
    await this.ensureSurfaceIsActive({ surface: d.surface });

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

    await authCodeQueue.add({
      codeId: code.id
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
    await this.ensureSurfaceIsActive({ surface: d.surface });

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
    await this.ensureSurfaceIsActive({ surface: d.surface });

    let factor = await db.consumerSurfaceAuthFactor.findFirst({
      where: {
        consumerSurfaceOid: d.surface.oid,
        id: d.factorId,
        type: 'sso',
        status: 'active'
      },
      include: {
        ssoTenant: true
      }
    });
    if (!factor || !factor.ssoTenant) {
      throw new ServiceError(
        badRequestError({
          message: 'The provided SSO factor is invalid.'
        })
      );
    }

    return {
      ...factor,
      ssoTenant: factor.ssoTenant!
    };
  }

  async listAuthFactors(d: { surface: ConsumerSurface }) {
    await this.ensureSurfaceIsActive({ surface: d.surface });

    let factors = await db.consumerSurfaceAuthFactor.findMany({
      where: {
        consumerSurfaceOid: d.surface.oid,
        status: 'active'
      },
      include: {
        ssoTenant: true
      }
    });

    return factors;
  }

  async authenticateWithSsoComplete(d: {
    surface: ConsumerSurface;
    ssoUser: SsoUser;
    ssoProfile: SsoUserProfile;
    context: Context;
  }) {
    await this.ensureSurfaceIsActive({ surface: d.surface });

    let consumerProfile = await this.ensureConsumerProfile({
      surface: d.surface,
      email: d.ssoUser.email,
      name:
        `${d.ssoUser.firstName} ${d.ssoUser.lastName}`.trim() || d.ssoUser.email.split('@')[0],
      overrideName: true,
      ssoProfile: d.ssoProfile
    });

    return this.createConsumerSession({
      consumerProfile,
      context: d.context,
      consumerSurface: d.surface
    });
  }

  private async getToken(d: {
    session: ConsumerSession;
    surface: ConsumerSurface;
    type: string;
  }) {
    let expiresAt = addMinutes(new Date(), 10);

    let token = await consumerSessionToken.sign({
      type: d.type,
      data: {
        surfaceId: d.surface.id,
        sessionId: d.session.id,
        nonce: d.session.tokenNonce
      },
      expiresAt: d.session.expiresAt
    });

    return {
      expiresAt,
      token
    };
  }

  async getPortalToken(d: { session: ConsumerSession; surface: ConsumerSurface }) {
    return this.getToken({
      session: d.session,
      surface: d.surface,
      type: 'portal_token'
    });
  }

  async getConsumerToken(d: { session: ConsumerSession; surface: ConsumerSurface }) {
    return this.getToken({
      session: d.session,
      surface: d.surface,
      type: 'consumer_token'
    });
  }

  async getConsumerSessionToken(d: { session: ConsumerSession; surface: ConsumerSurface }) {
    return await consumerSessionToken.sign({
      type: 'consumer_session',
      data: {
        surfaceId: d.surface.id,
        sessionId: d.session.id,
        nonce: d.session.tokenNonce
      },
      expiresAt: d.session.expiresAt
    });
  }

  async authenticateWithConsumerToken(d: { token: string; organization: Organization }) {
    let payload = await consumerToken.verify({
      token: d.token,
      expectedType: 'consumer_token'
    });
    if (!payload.verified) {
      throw new ServiceError(
        unauthorizedError({
          message: 'Invalid consumer token.'
        })
      );
    }

    let session = await db.consumerSession.findFirst({
      where: {
        id: payload.data.sessionId,
        tokenNonce: payload.data.sessionNonce,
        expiresAt: { gt: new Date() }
      },
      include: {
        consumerProfile: {
          include: {
            consumer: true,
            surface: true,
            ssoUsers: {
              include: {
                ssoUser: true
              }
            },
            groups: {
              include: {
                group: true
              }
            }
          }
        }
      }
    });
    if (!session || session.consumerProfile.organizationOid !== d.organization.oid) {
      throw new ServiceError(
        unauthorizedError({
          message: 'Invalid consumer token.'
        })
      );
    }

    return {
      session,
      consumerProfile: session.consumerProfile,
      surface: session.consumerProfile.surface
    };
  }

  async authenticateWithConsumerSessionToken(d: { token: string; surface: ConsumerSurface }) {
    let payload = await consumerSessionToken.verify({
      token: d.token,
      expectedType: 'consumer_session'
    });
    if (!payload.verified) {
      throw new ServiceError(
        unauthorizedError({
          message: 'Invalid consumer session token.'
        })
      );
    }

    let session = await db.consumerSession.findFirst({
      where: {
        id: payload.data.sessionId,
        tokenNonce: payload.data.nonce,
        consumerProfile: {
          surfaceOid: d.surface.oid
        },
        expiresAt: { gt: new Date() }
      },
      include: {
        consumerProfile: {
          include: {
            consumer: true,
            ssoUsers: {
              include: {
                ssoProfile: true,
                ssoUser: true
              }
            }
          }
        }
      }
    });
    if (!session) {
      throw new ServiceError(
        unauthorizedError({
          message: 'Invalid consumer session token.'
        })
      );
    }

    return session;
  }

  async getConsumerAuthToken(d: { session: ConsumerSession; surface: ConsumerSurface }) {
    return await consumerToken.sign({
      type: 'consumer_token',
      data: {
        tokenId: generatePlainId(20),
        surfaceId: d.surface.id,
        sessionId: d.session.id,
        sessionNonce: d.session.tokenNonce
      },
      expiresAt: d.session.expiresAt
    });
  }

  private async ensureConsumerProfile(d: {
    surface: ConsumerSurface;
    email: string;
    name: string;
    overrideName: boolean;
    ssoProfile?: SsoUserProfile;
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

      let profile = await db.consumerProfile.findUnique({
        where: {
          email_surfaceOid: {
            email: d.email,
            surfaceOid: d.surface.oid
          }
        }
      });
      if (profile) {
        profile = await db.consumerProfile.update({
          where: {
            oid: profile.oid
          },
          data: {
            email: d.email,
            name: d.overrideName ? d.name : undefined
          }
        });
        return profile;
      } else {
        let accessTag = await db.accessTag.create({
          data: { instanceOid: d.surface.instanceOid }
        });
        let personalConsumerGroup = await db.consumerGroup.create({
          data: {
            id: await ID.generateId('consumerGroup'),
            name: `Personal Group for ${d.email}`,
            status: 'active',
            type: 'user_access',
            surfaceOid: d.surface.oid,
            accessTagOid: accessTag.oid
          }
        });

        profile = await db.consumerProfile.upsert({
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

            accessTagOid: accessTag.oid,

            surfaceOid: d.surface.oid,
            consumerOid: consumer.oid,
            instanceOid: d.surface.instanceOid,
            organizationOid: d.surface.organizationOid,
            personalConsumerGroupOid: personalConsumerGroup.oid
          },
          update: {
            email: d.email,
            name: d.overrideName ? d.name : undefined
          }
        });
      }

      if (d.ssoProfile) {
        await db.consumerProfileSsoUser.upsert({
          where: {
            consumerProfileOid_ssoProfileOid: {
              consumerProfileOid: profile.oid,
              ssoProfileOid: d.ssoProfile!.oid
            }
          },
          create: {
            consumerProfileOid: profile.oid,
            ssoProfileOid: d.ssoProfile.oid,
            ssoUserOid: d.ssoProfile.ssoUserOid
          },
          update: {}
        });
      }

      return profile;
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
