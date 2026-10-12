import {
  badRequestError,
  forbiddenError,
  notFoundError,
  ServiceError
} from '@lowerdeck/error';
import { Service } from '@lowerdeck/service';
import { generateCustomId } from '@lowerdeck/id';
import { addMinutes, subMinutes } from 'date-fns';
import type { User } from '../../prisma/generated/client';
import { db, withTransaction } from '../db';
import { getId } from '../id';
import type { Context } from '../lib/context';
import { withUserPasswordLock } from '../lib/passwordLock';
import { turnstileVerifier } from '../lib/turnstile';
import { auditLogService } from './auditLog';

let passwordMemoryCost = 65536;
let passwordTimeCost = 2;
let intentFailureLimit = 5;
let userFailureLimit = 10;

export let isValidPasswordLength = (password: string) => {
  let length = Array.from(password).length;
  return length >= 12 && length <= 128;
};

export let isValidPassword = (password: string) =>
  isValidPasswordLength(password) &&
  /\p{Lu}/u.test(password) &&
  /\p{Ll}/u.test(password) &&
  /\p{Nd}/u.test(password) &&
  /[\p{P}\p{S}]/u.test(password);

class UserPasswordServiceImpl {
  private async getUser(d: { appId: string; userId: string }) {
    let user = await db.user.findFirst({
      where: { id: d.userId, app: { id: d.appId }, status: 'active', type: 'user' }
    });
    if (!user) throw new ServiceError(notFoundError('user'));

    return user;
  }

  async canManagePassword(user: User) {
    if (
      user.status != 'active' ||
      user.type != 'user' ||
      user.owner != 'self' ||
      !user.isFullyCreated
    ) {
      return false;
    }

    return withTransaction(
      async tdb => {
        let [app, account, ssoIdentity] = await Promise.all([
          tdb.app.findUnique({ where: { oid: user.appOid } }),
          user.accountOid ? tdb.account.findUnique({ where: { oid: user.accountOid } }) : null,
          tdb.userIdentity.findFirst({
            where: { userOid: user.oid, ssoUserProfileOid: { not: null } }
          })
        ]);

        return (
          !!app &&
          !app.disableEmailAuth &&
          !ssoIdentity &&
          (!account || (account.status == 'active' && account.allowEmailLogin))
        );
      },
      { ifExists: true }
    );
  }

  async assertVerifiedPassword(d: { userOid: bigint; authIntentOid: bigint }) {
    return withTransaction(
      async tdb => {
        let [intent, user] = await Promise.all([
          tdb.authIntent.findUnique({ where: { oid: d.authIntentOid } }),
          tdb.user.findUnique({ where: { oid: d.userOid } })
        ]);
        let credentials = await tdb.$queryRaw<Array<{ version: string }>>`
          SELECT "version" FROM "UserPassword"
          WHERE "userOid" = ${d.userOid}
          FOR UPDATE
        `;

        if (
          !user ||
          intent?.type != 'password' ||
          intent.userOid != user.oid ||
          intent.appOid != user.appOid ||
          !intent.verifiedAt ||
          !intent.passwordVersion ||
          credentials[0]?.version != intent.passwordVersion ||
          !(await this.canManagePassword(user))
        ) {
          throw new ServiceError(
            forbiddenError({
              message: 'Password verification is no longer valid. Please sign in again.'
            })
          );
        }
      },
      { ifExists: true }
    );
  }

  async get(d: { appId: string; userId: string }) {
    let user = await this.getUser(d);
    let [password, canManagePassword] = await Promise.all([
      db.userPassword.findUnique({ where: { userOid: user.oid } }),
      this.canManagePassword(user)
    ]);

    return {
      hasPassword: !!password,
      canManagePassword,
      updatedAt: password?.updatedAt ?? null
    };
  }

  async set(d: { appId: string; userId: string; password: string; context: Context }) {
    if (!isValidPassword(d.password)) {
      throw new ServiceError(
        badRequestError({
          message:
            'Use 12 or more characters with an uppercase letter, a lowercase letter, a number, and a special character.'
        })
      );
    }

    let user = await this.getUser(d);
    if (!(await this.canManagePassword(user))) {
      throw new ServiceError(
        forbiddenError({ message: 'Passwords are unavailable for this account.' })
      );
    }

    let hash = await Bun.password.hash(d.password, {
      algorithm: 'argon2id',
      memoryCost: passwordMemoryCost,
      timeCost: passwordTimeCost
    });

    return withUserPasswordLock(user.id, async () => {
      user = await this.getUser(d);
      if (!(await this.canManagePassword(user))) {
        throw new ServiceError(
          forbiddenError({ message: 'Passwords are unavailable for this account.' })
        );
      }

      let previous = await db.userPassword.findUnique({ where: { userOid: user.oid } });
      let version = generateCustomId('upv_');
      let password = await db.userPassword.upsert({
        where: { userOid: user.oid },
        create: { ...getId('userPassword'), userOid: user.oid, hash, version },
        update: { hash, version }
      });

      auditLogService.log({
        appOid: user.appOid,
        userOid: user.oid,
        type: previous ? 'user.password.changed' : 'user.password.set',
        ip: d.context.ip,
        ua: d.context.ua
      });

      return { hasPassword: true, canManagePassword: true, updatedAt: password.updatedAt };
    });
  }

  async remove(d: { appId: string; userId: string; context: Context }) {
    return withUserPasswordLock(d.userId, async () => {
      let user = await this.getUser(d);
      if (!(await this.canManagePassword(user))) {
        throw new ServiceError(
          forbiddenError({ message: 'Passwords are unavailable for this account.' })
        );
      }

      let deleted = await db.userPassword.deleteMany({ where: { userOid: user.oid } });
      if (deleted.count) {
        auditLogService.log({
          appOid: user.appOid,
          userOid: user.oid,
          type: 'user.password.removed',
          ip: d.context.ip,
          ua: d.context.ua
        });
      }

      return { hasPassword: false, canManagePassword: true, updatedAt: null };
    });
  }

  async verify(d: { authIntentId: string; stepId: string; password: string }) {
    let intent = await db.authIntent.findUnique({
      where: { id: d.authIntentId },
      include: { user: true }
    });
    if (!intent?.user)
      throw new ServiceError(forbiddenError({ message: 'Invalid authentication step.' }));

    return withUserPasswordLock(intent.user.id, async () => {
      let current = await db.authIntent.findUnique({
        where: { id: d.authIntentId },
        include: { user: true, steps: true }
      });
      let step = current?.steps.find(step => step.id == d.stepId);
      if (
        !current?.user ||
        current.type != 'password' ||
        current.consumedAt ||
        current.verifiedAt ||
        current.expiresAt <= new Date() ||
        step?.type != 'password' ||
        step.verifiedAt ||
        current.steps.some(previous => previous.index < step.index && !previous.verifiedAt)
      ) {
        throw new ServiceError(forbiddenError({ message: 'Invalid authentication step.' }));
      }
      if (turnstileVerifier.enabled && !current.captchaVerifiedAt) {
        throw new ServiceError(
          forbiddenError({ message: 'Please complete verification before continuing.' })
        );
      }
      if (!(await this.canManagePassword(current.user))) {
        throw new ServiceError(
          forbiddenError({ message: 'Password login is unavailable for this account.' })
        );
      }

      let [intentFailures, userFailures, credential] = await Promise.all([
        db.authIntentVerificationAttempt.count({
          where: { authIntentOid: current.oid, method: 'password', status: 'failure' }
        }),
        db.authIntentVerificationAttempt.count({
          where: {
            method: 'password',
            status: 'failure',
            createdAt: { gt: subMinutes(new Date(), 10) },
            authIntent: { userOid: current.userOid, appOid: current.appOid }
          }
        }),
        db.userPassword.findUnique({ where: { userOid: current.user.oid } })
      ]);
      if (intentFailures >= intentFailureLimit || userFailures >= userFailureLimit) {
        throw new ServiceError(
          forbiddenError({
            message: 'Too many password attempts. Please use an email code or try again later.'
          })
        );
      }

      let success = !!credential && (await Bun.password.verify(d.password, credential.hash));
      await withTransaction(async tdb => {
        let fresh = await tdb.authIntent.findUnique({ where: { oid: current.oid } });
        let freshStep = await tdb.authIntentStep.findUnique({ where: { oid: step.oid } });
        let freshUser = await tdb.user.findUnique({ where: { oid: current.user!.oid } });
        let freshCredential = await tdb.userPassword.findUnique({
          where: { userOid: current.user!.oid }
        });
        if (
          !fresh ||
          fresh.consumedAt ||
          fresh.verifiedAt ||
          fresh.expiresAt <= new Date() ||
          freshStep?.type != 'password' ||
          freshStep.verifiedAt
        ) {
          throw new ServiceError(forbiddenError({ message: 'Invalid authentication step.' }));
        }

        if (
          !freshUser ||
          !(await this.canManagePassword(freshUser)) ||
          (success &&
            (!freshCredential ||
              freshCredential.hash != credential!.hash ||
              freshCredential.version != credential!.version))
        ) {
          throw new ServiceError(forbiddenError({ message: 'Invalid authentication step.' }));
        }

        await tdb.authIntentVerificationAttempt.create({
          data: {
            ...getId('authIntentVerificationAttempt'),
            authIntentOid: current.oid,
            stepId: step.id,
            method: 'password',
            status: success ? 'success' : 'failure'
          }
        });
        if (success) {
          let verifiedAt = new Date();
          await tdb.authIntentStep.update({
            where: { oid: step.oid },
            data: { verifiedAt }
          });
          await tdb.authIntent.update({
            where: { oid: current.oid },
            data: {
              verifiedAt,
              expiresAt: addMinutes(verifiedAt, 30),
              passwordVersion: credential!.version
            }
          });
        }
      });

      if (!success)
        throw new ServiceError(
          badRequestError({ message: 'The password you entered is incorrect.' })
        );
    });
  }
}

export let userPasswordService = Service.create(
  'userPasswordService',
  () => new UserPasswordServiceImpl()
).build();
