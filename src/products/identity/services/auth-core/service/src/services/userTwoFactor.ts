import { Encryption } from '@lowerdeck/encryption';
import {
  badRequestError,
  forbiddenError,
  notFoundError,
  ServiceError
} from '@lowerdeck/error';
import { Service } from '@lowerdeck/service';
import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
  type AuthenticationResponseJSON,
  type RegistrationResponseJSON
} from '@simplewebauthn/server';
import { createHash, randomBytes } from 'node:crypto';
import { generateSecret, generateURI, verify } from 'otplib';
import QRCode from 'qrcode';
import { addMinutes, subMinutes } from 'date-fns';
import type { AuthIntent } from '../../prisma/generated/client';
import { addAfterTransactionHook, db, withTransaction } from '../db';
import { env } from '../env';
import { getId, ID } from '../id';
import type { Context } from '../lib/context';
import { withUserPasswordLock } from '../lib/passwordLock';
import { auditLogService } from './auditLog';

let setupMinutes = 10;
let challengeMinutes = 5;
let failureLimit = 10;
let userFailureLimit = 30;

export let hashTwoFactorSecret = (value: string) =>
  createHash('sha256').update(value).digest('hex');

let invalid = () =>
  new ServiceError(
    forbiddenError({
      code: 'two_factor_invalid',
      message: 'Verification is no longer valid. Please start again.'
    })
  );

let encryption = () => {
  if (!env.keys.TWO_FACTOR_ENCRYPTION_KEY)
    throw new ServiceError(forbiddenError({ message: 'Two-factor setup is not configured.' }));
  return new Encryption(env.keys.TWO_FACTOR_ENCRYPTION_KEY);
};

export let verifyTotp = async (secret: string, token: string, lastTimeStep?: number) => {
  if (!/^\d{6}$/.test(token)) return { valid: false as const };
  let result = await verify({
    secret,
    token,
    epochTolerance: 30,
    ...(lastTimeStep !== undefined ? { afterTimeStep: lastTimeStep } : {})
  });
  return result.valid && 'timeStep' in result && typeof result.timeStep === 'number'
    ? { valid: true as const, timeStep: result.timeStep }
    : { valid: false as const };
};

let rp = () => ({
  id: env.service.WEBAUTHN_RP_ID ?? new URL(env.service.ARES_AUTH_URL).hostname,
  origin: new URL(env.service.ARES_AUTH_URL).origin
});

export type TwoFactorIdentity = { appId: string; userId: string };

export type TwoFactorSetupIdentity = {
  setupId: string;
  clientSecret: string;
  deviceId: string;
};

class UserTwoFactorServiceImpl {
  private async user(d: TwoFactorIdentity) {
    let user = await db.user.findFirst({
      where: { id: d.userId, app: { id: d.appId }, status: 'active', type: 'user' }
    });
    if (!user) throw new ServiceError(notFoundError('user'));
    return user;
  }

  private async lockUser(userOid: bigint) {
    return withTransaction(
      async tdb => {
        let rows = await tdb.$queryRaw<
          Array<{ twoFactorRevision: number }>
        >`SELECT "twoFactorRevision" FROM "User" WHERE "oid" = ${userOid} AND "status" = 'active' AND "type" = 'user' FOR UPDATE`;
        if (!rows[0]) throw invalid();
        return rows[0].twoFactorRevision;
      },
      { ifExists: true }
    );
  }

  async get(d: TwoFactorIdentity) {
    let user = await this.user(d);
    let [factors, remainingRecoveryCodes] = await Promise.all([
      db.userTwoFactor.findMany({
        where: { userOid: user.oid },
        orderBy: { createdAt: 'asc' }
      }),
      db.userRecoveryCode.count({ where: { userOid: user.oid, consumedAt: null } })
    ]);
    return {
      enabled: factors.length > 0,
      revision: user.twoFactorRevision,
      remainingRecoveryCodes,
      canManage:
        !!env.keys.TWO_FACTOR_ENCRYPTION_KEY &&
        env.service.TWO_FACTOR_SETUP_ENABLED === 'true',
      factors: factors.map(factor => ({
        id: factor.id,
        method: factor.method,
        name: factor.name,
        createdAt: factor.createdAt
      }))
    };
  }

  async startSetup(
    d: TwoFactorIdentity & {
      sessionId: string;
      method?: 'totp' | 'passkey';
      callbackUrl: string;
      returnUrl: string;
      expiresAt: Date;
      context: Context;
    }
  ) {
    encryption();
    if (env.service.TWO_FACTOR_SETUP_ENABLED !== 'true')
      throw new ServiceError(
        forbiddenError({ message: 'Two-factor setup is not available yet.' })
      );
    let user = await this.user(d);
    return withUserPasswordLock(user.id, async () => {
      user = await this.user(d);
      let session = await db.authDeviceUserSession.findFirst({
        where: {
          id: d.sessionId,
          userOid: user.oid,
          appOid: user.appOid,
          loggedOutAt: null,
          expiresAt: { gt: new Date() }
        }
      });
      if (!session) throw invalid();

      let recent = await db.userTwoFactorSetup.count({
        where: { userOid: user.oid, createdAt: { gt: subMinutes(new Date(), 10) } }
      });
      if (recent >= 10)
        throw new ServiceError(
          forbiddenError({ message: 'Too many setup requests. Please try again later.' })
        );

      if (!d.method && !(await db.userTwoFactor.count({ where: { userOid: user.oid } })))
        throw invalid();
      if (
        d.method === 'totp' &&
        (await db.userTwoFactor.findFirst({ where: { userOid: user.oid, method: 'totp' } }))
      )
        throw new ServiceError(
          badRequestError({ message: 'An authenticator app is already enabled.' })
        );

      let clientSecret = await ID.generateId('userTwoFactorSetup_secret');
      let id = getId('userTwoFactorSetup');
      let encryptedSecret =
        d.method === 'totp'
          ? await encryption().encrypt({ entityId: id.id, secret: generateSecret() })
          : null;

      let setup = await db.userTwoFactorSetup.create({
        data: {
          ...id,
          secretHash: hashTwoFactorSecret(clientSecret),
          userOid: user.oid,
          sessionOid: session.oid,
          method: d.method,
          status: d.method ? 'pending' : 'ready',
          revision: user.twoFactorRevision,
          encryptedSecret,
          callbackUrl: d.callbackUrl,
          returnUrl: d.returnUrl,
          expiresAt: new Date(
            Math.min(
              addMinutes(new Date(), setupMinutes).getTime(),
              session.expiresAt.getTime(),
              new Date(d.expiresAt).getTime()
            )
          )
        }
      });

      let url = new URL('/two-factor/setup', env.service.ARES_AUTH_URL);
      url.hash = new URLSearchParams({
        setup_id: setup.id,
        client_secret: clientSecret
      }).toString();
      return { setupId: setup.id, url: url.toString(), expiresAt: setup.expiresAt };
    });
  }

  private async setup(d: TwoFactorSetupIdentity, allowExpired = false) {
    let setup = await db.userTwoFactorSetup.findFirst({
      where: {
        id: d.setupId,
        secretHash: hashTwoFactorSecret(d.clientSecret),
        expiresAt: allowExpired ? undefined : { gt: new Date() },
        status: allowExpired ? undefined : { not: 'cancelled' },
        session: {
          device: { id: d.deviceId },
          loggedOutAt: allowExpired ? undefined : null,
          expiresAt: allowExpired ? undefined : { gt: new Date() }
        },
        user: { status: 'active', type: 'user' }
      },
      include: { user: true, session: true }
    });
    if (!setup || (!allowExpired && setup.failures >= failureLimit)) throw invalid();
    return setup;
  }

  async getSetup(d: TwoFactorSetupIdentity) {
    let setup = await this.setup(d, true);
    let expired =
      setup.expiresAt <= new Date() ||
      setup.session.expiresAt <= new Date() ||
      !!setup.session.loggedOutAt ||
      setup.status === 'cancelled' ||
      setup.failures >= failureLimit;
    let status = expired ? ('expired' as const) : setup.status;

    let secret =
      status === 'pending' && setup.method === 'totp' && setup.encryptedSecret
        ? await encryption().decrypt({ entityId: setup.id, encrypted: setup.encryptedSecret })
        : null;
    let uri = secret
      ? generateURI({ issuer: 'Metorial', label: setup.user.email, secret })
      : null;
    let callback = new URL(setup.callbackUrl);
    callback.searchParams.set('setup_id', setup.id);
    return {
      id: setup.id,
      method: setup.method,
      status,
      email: expired ? '' : setup.user.email,
      secret,
      qrCode: uri ? await QRCode.toDataURL(uri, { margin: 2, width: 240 }) : null,
      callbackUrl: callback.toString(),
      returnUrl: setup.returnUrl,
      expiresAt: setup.expiresAt
    };
  }

  async confirmTotp(d: TwoFactorSetupIdentity & { code: string }) {
    let setup = await this.setup(d);
    return withUserPasswordLock(setup.user.id, async () => {
      setup = await this.setup(d);
      if (setup.status !== 'pending' || setup.method !== 'totp' || !setup.encryptedSecret)
        throw invalid();

      let secret = await encryption().decrypt({
        entityId: setup.id,
        encrypted: setup.encryptedSecret
      });
      let result = await verifyTotp(secret, d.code);

      let updated = await db.userTwoFactorSetup.updateMany({
        where: { oid: setup.oid, status: 'pending' },
        data: result.valid
          ? { status: 'ready', lastTimeStep: result.timeStep, name: 'Authenticator App' }
          : { failures: { increment: 1 } }
      });
      if (!updated.count) throw invalid();

      if (!result.valid)
        throw new ServiceError(
          badRequestError({
            message: 'That code didn’t work. Try the latest code from your app.'
          })
        );

      return this.getSetup(d);
    });
  }

  async registrationOptions(d: TwoFactorSetupIdentity) {
    let setup = await this.setup(d);
    if (setup.status !== 'pending' || setup.method !== 'passkey') throw invalid();

    let existing = await db.userTwoFactor.findMany({
      where: { userOid: setup.userOid, method: 'passkey' }
    });
    let options = await generateRegistrationOptions({
      rpName: 'Metorial',
      rpID: rp().id,
      userName: setup.user.email,
      userID: new TextEncoder().encode(setup.user.id),
      attestationType: 'none',
      authenticatorSelection: { residentKey: 'preferred', userVerification: 'required' },
      excludeCredentials: existing.map(factor => ({ id: factor.credentialId! }))
    });
    await db.userTwoFactorSetup.update({
      where: { oid: setup.oid },
      data: {
        challenge: options.challenge,
        challengeExpiresAt: addMinutes(new Date(), challengeMinutes)
      }
    });
    return options;
  }

  async confirmPasskey(
    d: TwoFactorSetupIdentity & { response: RegistrationResponseJSON; name: string }
  ) {
    let setup = await this.setup(d);
    return withUserPasswordLock(setup.user.id, async () => {
      setup = await this.setup(d);
      if (
        setup.status !== 'pending' ||
        setup.method !== 'passkey' ||
        !setup.challenge ||
        !setup.challengeExpiresAt ||
        setup.challengeExpiresAt <= new Date() ||
        !d.name.trim()
      )
        throw invalid();
      let challenge = setup.challenge;
      let claimed = await db.userTwoFactorSetup.updateMany({
        where: { oid: setup.oid, status: 'pending', challenge },
        data: { challenge: null, challengeExpiresAt: null }
      });
      if (!claimed.count) throw invalid();

      let result;
      try {
        result = await verifyRegistrationResponse({
          response: d.response,
          expectedChallenge: challenge,
          expectedOrigin: rp().origin,
          expectedRPID: rp().id,
          requireUserVerification: true
        });
      } catch {
        await db.userTwoFactorSetup.updateMany({
          where: { oid: setup.oid, status: 'pending' },
          data: { failures: { increment: 1 } }
        });
        throw invalid();
      }
      if (!result.verified || !result.registrationInfo) {
        await db.userTwoFactorSetup.updateMany({
          where: { oid: setup.oid, status: 'pending' },
          data: { failures: { increment: 1 } }
        });
        throw invalid();
      }
      let { credential, credentialDeviceType, credentialBackedUp } = result.registrationInfo;
      let updated = await db.userTwoFactorSetup.updateMany({
        where: { oid: setup.oid, status: 'pending' },
        data: {
          status: 'ready',
          name: d.name.trim(),
          credentialId: credential.id,
          publicKey: Buffer.from(credential.publicKey),
          counter: BigInt(credential.counter),
          transports: credential.transports ?? [],
          deviceType: credentialDeviceType,
          backedUp: credentialBackedUp
        }
      });
      if (!updated.count) throw invalid();

      return this.getSetup(d);
    });
  }

  async finalize(
    d: TwoFactorIdentity & { setupId: string; sessionId: string; context: Context }
  ) {
    let user = await this.user(d);
    return withUserPasswordLock(user.id, () =>
      withTransaction(async tdb => {
        let revision = await this.lockUser(user.oid);
        await tdb.$queryRaw`SELECT "oid" FROM "UserTwoFactorSetup" WHERE "id" = ${d.setupId} AND "userOid" = ${user.oid} FOR UPDATE`;

        let setup = await tdb.userTwoFactorSetup.findFirst({
          where: {
            id: d.setupId,
            userOid: user.oid,
            expiresAt: { gt: new Date() },
            session: { id: d.sessionId, loggedOutAt: null, expiresAt: { gt: new Date() } }
          }
        });
        if (!setup) throw invalid();
        if (setup.status === 'completed') return { completed: true };
        if (setup.status !== 'ready' || setup.revision !== revision) throw invalid();
        let count = await tdb.userTwoFactor.count({ where: { userOid: user.oid } });
        if (setup.method) {
          if (
            setup.method === 'totp' &&
            (await tdb.userTwoFactor.findFirst({
              where: { userOid: user.oid, method: 'totp' }
            }))
          )
            throw invalid();
          let secret = setup.encryptedSecret
            ? await encryption().decrypt({
                entityId: setup.id,
                encrypted: setup.encryptedSecret
              })
            : null;
          let id = getId('userTwoFactor');
          await tdb.userTwoFactor.create({
            data: {
              ...id,
              userOid: user.oid,
              method: setup.method,
              name: setup.name!,
              encryptedSecret: secret
                ? await encryption().encrypt({ entityId: id.id, secret })
                : null,
              lastTimeStep: setup.lastTimeStep,
              credentialId: setup.credentialId,
              publicKey: setup.publicKey,
              counter: setup.counter,
              transports: setup.transports,
              deviceType: setup.deviceType,
              backedUp: setup.backedUp
            }
          });
        } else if (!count) throw invalid();

        let encryptedRecoveryCodes: string | null = null;
        if (!count || !setup.method) {
          let codes = Array.from({ length: 10 }, () =>
            randomBytes(10)
              .toString('hex')
              .toUpperCase()
              .match(/.{1,5}/g)!
              .join('-')
          );
          await tdb.userRecoveryCode.deleteMany({ where: { userOid: user.oid } });
          await tdb.userRecoveryCode.createMany({
            data: codes.map(code => ({
              ...getId('userRecoveryCode'),
              userOid: user.oid,
              hash: hashTwoFactorSecret(code.replaceAll('-', ''))
            }))
          });
          encryptedRecoveryCodes = await encryption().encrypt({
            entityId: setup.id,
            secret: JSON.stringify(codes)
          });
        }
        await tdb.user.update({
          where: { oid: user.oid },
          data: { twoFactorRevision: { increment: 1 } }
        });
        await tdb.userTwoFactorSetup.update({
          where: { oid: setup.oid },
          data: {
            status: 'completed',
            completedAt: new Date(),
            encryptedRecoveryCodes,
            encryptedSecret: null,
            publicKey: null,
            challenge: null
          }
        });
        this.audit(user, setup.method ? 'enrolled' : 'recovery_regenerated', d.context);
        return { completed: true };
      })
    );
  }

  async takeRecoveryCodes(d: TwoFactorSetupIdentity) {
    let setup = await this.setup(d);
    return withTransaction(async tdb => {
      let consumed = await tdb.userTwoFactorSetup.updateMany({
        where: { oid: setup.oid, status: 'completed', encryptedRecoveryCodes: { not: null } },
        data: { encryptedRecoveryCodes: null }
      });
      if (!consumed.count || !setup.encryptedRecoveryCodes) return { codes: [] as string[] };
      let codes: string[] = JSON.parse(
        await encryption().decrypt({
          entityId: setup.id,
          encrypted: setup.encryptedRecoveryCodes
        })
      );
      return { codes };
    });
  }

  async cancel(d: TwoFactorSetupIdentity) {
    let setup = await this.setup(d);
    await db.userTwoFactorSetup.updateMany({
      where: { oid: setup.oid, status: { in: ['pending', 'ready'] } },
      data: { status: 'cancelled', encryptedSecret: null, challenge: null, publicKey: null }
    });
    return { returnUrl: setup.returnUrl };
  }

  async remove(d: TwoFactorIdentity & { factorId?: string; context: Context }) {
    let user = await this.user(d);
    await withUserPasswordLock(user.id, () =>
      withTransaction(async tdb => {
        await this.lockUser(user.oid);
        let removed = await tdb.userTwoFactor.deleteMany({
          where: { userOid: user.oid, ...(d.factorId ? { id: d.factorId } : {}) }
        });
        if (!removed.count) return;
        await tdb.user.update({
          where: { oid: user.oid },
          data: { twoFactorRevision: { increment: 1 } }
        });
        if (!(await tdb.userTwoFactor.count({ where: { userOid: user.oid } })))
          await tdb.userRecoveryCode.deleteMany({ where: { userOid: user.oid } });
        this.audit(user, d.factorId ? 'factor_removed' : 'disabled', d.context);
      })
    );
    return this.get(d);
  }

  private audit(user: { oid: bigint; appOid: bigint }, action: string, context: Context) {
    addAfterTransactionHook(() =>
      auditLogService.log({
        appOid: user.appOid,
        userOid: user.oid,
        type: `user.two_factor.${action}`,
        ip: context.ip,
        ua: context.ua
      })
    );
  }

  async afterPrimary(intent: AuthIntent) {
    return withTransaction(
      async tdb => {
        if (!intent.userOid || !['email_code', 'password'].includes(intent.type)) return true;
        let revision = await this.lockUser(intent.userOid);
        let count = await tdb.userTwoFactor.count({ where: { userOid: intent.userOid } });
        await tdb.authIntent.update({
          where: { oid: intent.oid },
          data: { twoFactorRevision: revision }
        });

        if (!count) return true;
        let step = await tdb.authIntentStep.findFirst({
          where: { authIntentOid: intent.oid, type: 'two_factor' }
        });
        if (!step)
          await tdb.authIntentStep.create({
            data: {
              ...getId('authIntentStep'),
              authIntentOid: intent.oid,
              type: 'two_factor',
              index: 1
            }
          });

        return !!step?.verifiedAt;
      },
      { ifExists: true }
    );
  }

  async assertVerified(d: {
    userOid: bigint;
    authIntentOid: bigint | null;
    loginMethod: string | null;
    deviceOid?: bigint;
    appOid?: bigint;
  }) {
    if (d.loginMethod !== 'email' && d.loginMethod !== 'password') return;
    return withTransaction(
      async tdb => {
        let revision = await this.lockUser(d.userOid);
        if (!d.authIntentOid && d.loginMethod === 'email' && d.deviceOid && d.appOid) {
          let existingSession = await tdb.authDeviceUserSession.findFirst({
            where: {
              userOid: d.userOid,
              deviceOid: d.deviceOid,
              appOid: d.appOid,
              loggedOutAt: null,
              expiresAt: { gt: new Date() }
            }
          });
          if (existingSession) return;
        }

        let intent = d.authIntentOid
          ? await tdb.authIntent.findUnique({
              where: { oid: d.authIntentOid },
              include: { steps: true }
            })
          : null;
        let enabled = await tdb.userTwoFactor.count({ where: { userOid: d.userOid } });
        if (
          !intent ||
          intent.userOid !== d.userOid ||
          intent.type !== (d.loginMethod === 'password' ? 'password' : 'email_code') ||
          (enabled &&
            (!intent.verifiedAt ||
              intent.twoFactorRevision !== revision ||
              !intent.steps.some(step => step.type === 'two_factor' && step.verifiedAt))) ||
          (intent.twoFactorRevision !== null && intent.twoFactorRevision !== revision)
        )
          throw invalid();
      },
      { ifExists: true }
    );
  }

  private async loginStep(d: { authIntentId: string; stepId: string }) {
    return withTransaction(
      async tdb => {
        let intent = await tdb.authIntent.findUnique({
          where: { id: d.authIntentId },
          include: { steps: true, user: true }
        });
        let step = intent?.steps.find(step => step.id === d.stepId);
        if (
          !intent?.user ||
          !step ||
          step.type !== 'two_factor' ||
          step.verifiedAt ||
          intent.consumedAt ||
          intent.expiresAt <= new Date() ||
          intent.steps.some(previous => previous.index < step.index && !previous.verifiedAt) ||
          intent.twoFactorRevision !== intent.user.twoFactorRevision
        )
          throw invalid();
        let [failures, userFailures] = await Promise.all([
          tdb.authIntentVerificationAttempt.count({
            where: { authIntentOid: intent.oid, method: 'two_factor', status: 'failure' }
          }),
          tdb.authIntentVerificationAttempt.count({
            where: {
              method: 'two_factor',
              status: 'failure',
              authIntent: { userOid: intent.userOid },
              createdAt: { gt: subMinutes(new Date(), 10) }
            }
          })
        ]);
        if (failures >= failureLimit || userFailures >= userFailureLimit)
          throw new ServiceError(
            forbiddenError({
              code: 'two_factor_rate_limited',
              message: 'Too many verification attempts. Please sign in again later.'
            })
          );

        return { intent, step, user: intent.user };
      },
      { ifExists: true }
    );
  }

  async loginOptions(d: { authIntentId: string; stepId: string }) {
    let { user } = await this.loginStep(d);
    let factors = await db.userTwoFactor.findMany({ where: { userOid: user.oid } });
    return {
      totp: factors.some(factor => factor.method === 'totp'),
      passkey: factors.some(factor => factor.method === 'passkey')
    };
  }

  async authenticationOptions(d: { authIntentId: string; stepId: string }) {
    let { step, user } = await this.loginStep(d);
    let factors = await db.userTwoFactor.findMany({
      where: { userOid: user.oid, method: 'passkey' }
    });
    if (!factors.length) throw invalid();
    let options = await generateAuthenticationOptions({
      rpID: rp().id,
      userVerification: 'required',
      allowCredentials: factors.map(factor => ({ id: factor.credentialId! }))
    });
    await db.authIntentStep.update({
      where: { oid: step.oid },
      data: {
        challenge: options.challenge,
        challengeExpiresAt: addMinutes(new Date(), challengeMinutes)
      }
    });
    return options;
  }

  async verifyLogin(d: {
    authIntentId: string;
    stepId: string;
    input:
      | { type: 'totp' | 'recovery_code'; code: string }
      | { type: 'passkey'; response: AuthenticationResponseJSON };
    context: Context;
  }) {
    let initial = await this.loginStep(d);
    let success = await withUserPasswordLock(initial.user.id, () =>
      withTransaction(async tdb => {
        await this.lockUser(initial.user.oid);
        let { intent, step, user } = await this.loginStep(d);
        let accepted = false;
        if (d.input.type === 'recovery_code') {
          let hash = hashTwoFactorSecret(d.input.code.replace(/[-\s]/g, '').toUpperCase());
          let consumed = await tdb.userRecoveryCode.updateMany({
            where: { userOid: user.oid, hash, consumedAt: null },
            data: { consumedAt: new Date() }
          });
          accepted = consumed.count === 1;
          if (accepted) this.audit(user, 'recovery_used', d.context);
        } else if (d.input.type === 'totp') {
          let factor = await tdb.userTwoFactor.findFirst({
            where: { userOid: user.oid, method: 'totp' }
          });
          if (factor?.encryptedSecret) {
            let secret = await encryption().decrypt({
              entityId: factor.id,
              encrypted: factor.encryptedSecret
            });
            let result = await verifyTotp(
              secret,
              d.input.code,
              factor.lastTimeStep ?? undefined
            );
            if (result.valid) {
              await tdb.userTwoFactor.update({
                where: { oid: factor.oid },
                data: { lastTimeStep: result.timeStep, lastUsedAt: new Date() }
              });
              accepted = true;
            }
          }
        } else if (d.input.type === 'passkey') {
          let factor = await tdb.userTwoFactor.findFirst({
            where: { userOid: user.oid, credentialId: d.input.response.id, method: 'passkey' }
          });
          await tdb.authIntentStep.update({
            where: { oid: step.oid },
            data: { challenge: null, challengeExpiresAt: null }
          });
          if (
            factor?.publicKey &&
            step.challenge &&
            step.challengeExpiresAt &&
            step.challengeExpiresAt > new Date()
          ) {
            try {
              let result = await verifyAuthenticationResponse({
                response: d.input.response,
                expectedChallenge: step.challenge,
                expectedOrigin: rp().origin,
                expectedRPID: rp().id,
                requireUserVerification: true,
                credential: {
                  id: factor.credentialId!,
                  publicKey: new Uint8Array(factor.publicKey),
                  counter: Number(factor.counter)
                }
              });
              if (result.verified) {
                await tdb.userTwoFactor.update({
                  where: { oid: factor.oid },
                  data: {
                    counter: BigInt(result.authenticationInfo.newCounter),
                    lastUsedAt: new Date()
                  }
                });
                accepted = true;
              }
            } catch {
              accepted = false;
            }
          }
        }

        await tdb.authIntentVerificationAttempt.create({
          data: {
            ...getId('authIntentVerificationAttempt'),
            authIntentOid: intent.oid,
            stepId: step.id,
            method: 'two_factor',
            status: accepted ? 'success' : 'failure'
          }
        });
        if (accepted) {
          await tdb.authIntentStep.update({
            where: { oid: step.oid },
            data: { verifiedAt: new Date() }
          });
          await tdb.authIntent.update({
            where: { oid: intent.oid },
            data: { verifiedAt: new Date() }
          });
        }
        this.audit(user, accepted ? 'challenge_succeeded' : 'challenge_failed', d.context);
        return accepted;
      })
    );
    if (!success)
      throw new ServiceError(
        badRequestError({
          code: 'two_factor_incorrect',
          message: 'Verification failed. Try again or use another method.'
        })
      );
  }
}

export let userTwoFactorService = Service.create(
  'userTwoFactorService',
  () => new UserTwoFactorServiceImpl()
).build();
