import {
  badRequestError,
  conflictError,
  notFoundError,
  preconditionFailedError,
  ServiceError
} from '@lowerdeck/error';
import { Service } from '@lowerdeck/service';
import type { App, User, UserEmail, UserTermsType } from '../../prisma/generated/client';
import { addAfterTransactionHook, db, withTransaction } from '../db';
import { terms } from '../definitions';
import { userEvents } from '../events/user';
import { getId } from '../id';
import type { Context } from '../lib/context';
import { parseEmail } from '../lib/parseEmail';
import { auditLogService } from './auditLog';

class UserServiceImpl {
  async findByEmailSafe(d: { email: string; app: App }) {
    return await db.user.findFirst({
      where: {
        appOid: d.app.oid,
        OR: [
          { email: d.email },
          {
            userEmails: {
              some: {
                email: d.email,
                verifiedAt: { not: null }
              }
            }
          }
        ]
      }
    });
  }

  async findByEmail(d: { email: string; app: App }) {
    let user = await this.findByEmailSafe(d);
    if (!user) throw new ServiceError(notFoundError('user', null));
    return user;
  }

  async createUser(d: {
    email: string;
    firstName: string;
    lastName: string;
    acceptedTerms: boolean;
    context: Context;
    app: App;
    type: 'standard_user' | 'pre_created_user';
  }) {
    if (!d.acceptedTerms) {
      throw new ServiceError(
        badRequestError({
          message: 'You must accept the terms of service'
        })
      );
    }

    d.email = d.email.trim().toLowerCase();

    return withTransaction(async tdb => {
      try {
        let user = await tdb.user.create({
          data: {
            ...getId('user'),

            email: d.email,
            name: `${d.firstName} ${d.lastName}`.trim(),
            firstName: d.firstName.trim(),
            lastName: d.lastName.trim(),

            type: 'user',
            owner: 'self',
            status: 'active',
            appOid: d.app.oid,
            tenantOid: d.app.defaultTenantOid!,

            isFullyCreated: d.type === 'standard_user',

            image: { type: 'default' }
          }
        });

        await this.createTermsAgreement({
          user,
          context: d.context,
          terms: [terms.privacyPolicy, terms.termsOfService]
        });

        await this.createEmail({
          email: d.email,
          user,
          app: d.app,
          context: d.context,
          isForNewUser: true
        });

        addAfterTransactionHook(() => userEvents.fire('create', user));

        auditLogService.log({
          appOid: d.app.oid,
          type: 'user.created',
          userOid: user.oid,
          ip: d.context.ip,
          ua: d.context.ua
        });

        return user;
      } catch (e: any) {
        console.error('Error creating user:', e);

        if (e.code === 'P2002') {
          throw new ServiceError(
            conflictError({
              message: 'This email is already in use'
            })
          );
        }

        throw e;
      }
    });
  }

  async listUserProfile(d: { user: User }) {
    return await db.userIdentity.findMany({
      where: { userOid: d.user.oid },
      orderBy: {
        id: 'asc'
      },
      include: {
        provider: {
          include: {
            oauthProvider: true,
            ssoTenant: {
              include: { ssoTenantDomain: true }
            }
          }
        },
        ssoUserProfile: { include: { user: true } }
      }
    });
  }

  async listUserEmails(d: { user: User }) {
    return await db.userEmail.findMany({
      where: { userOid: d.user.oid },
      orderBy: {
        id: 'asc'
      }
    });
  }

  async createEmail(d: {
    email: string;
    user: User;
    app: App;
    context: Context;
    isForNewUser?: boolean;
  }) {
    d.email = d.email.trim().toLowerCase();

    let existingEmail = await db.userEmail.findFirst({
      where: {
        appOid: d.app.oid,
        email: d.email
      }
    });
    if (existingEmail) {
      if (existingEmail.userOid === d.user.oid) {
        throw new ServiceError(
          conflictError({
            message: 'This email is already associated with your account'
          })
        );
      }

      throw new ServiceError(
        conflictError({
          message: 'This email is already in use'
        })
      );
    }

    return withTransaction(async tdb => {
      let parsedEmail = parseEmail(d.email);

      // Ensure email domain exists
      let domain = await tdb.emailDomain.upsert({
        where: {
          domain: parsedEmail.domain
        },
        create: {
          ...getId('emailDomain'),
          domain: parsedEmail.domain,
          appOid: d.app.oid
        },
        update: {}
      });

      let email = await tdb.userEmail.create({
        data: {
          ...getId('userEmail'),
          domainOid: domain.oid,
          appOid: d.app.oid,
          email: parsedEmail.email,
          normalizedEmail: parsedEmail.normalizedEmail,
          isPrimary: d.isForNewUser,
          verifiedAt: d.isForNewUser ? new Date() : null,
          userOid: d.user.oid
        }
      });

      if (!d.isForNewUser) {
        auditLogService.log({
          appOid: d.app.oid,
          type: 'user.email.added',
          userOid: d.user.oid,
          ip: d.context.ip,
          ua: d.context.ua,
          metadata: { email: parsedEmail.email }
        });
      }

      return email;
    });
  }

  async verifyUserEmail(d: { key: string }) {
    let verification = await db.userEmailVerification.findFirst({
      where: { key: d.key }
    });

    if (!verification) {
      throw new ServiceError(
        notFoundError({
          entity: 'user_email_verification',
          message: 'This verification link is invalid, has expired, or has already been used'
        })
      );
    }

    if (verification?.completedAt) {
      throw new ServiceError(
        conflictError({
          message: 'You have already verified this email'
        })
      );
    }

    return await withTransaction(async tdb => {
      await tdb.userEmailVerification.update({
        where: { key: d.key },
        data: { completedAt: new Date() }
      });

      let email = await tdb.userEmail.update({
        where: { oid: verification.userEmailOid },
        data: { verifiedAt: new Date() }
      });

      auditLogService.log({
        appOid: email.appOid,
        type: 'user.email.verified',
        userOid: email.userOid,
        metadata: { email: email.email }
      });

      return email;
    });
  }

  async setPrimaryEmail(d: { email: UserEmail; user: User; context: Context }) {
    if (d.email.userOid !== d.user.oid) throw new Error('WTF');
    if (d.email.isPrimary) return d.email;
    if (!d.email.verifiedAt) {
      throw new ServiceError(
        preconditionFailedError({
          message: 'Email must be verified before setting as primary'
        })
      );
    }

    return withTransaction(async tdb => {
      // Set all emails to not primary
      await tdb.userEmail.updateMany({
        where: { userOid: d.user.oid },
        data: { isPrimary: false }
      });

      let email = await tdb.userEmail.update({
        where: { id: d.email.id },
        data: { isPrimary: true }
      });

      let user = await tdb.user.update({
        where: { oid: d.user.oid },
        data: { email: d.email.email }
      });

      await addAfterTransactionHook(() => userEvents.fire('update', user!));

      auditLogService.log({
        appOid: user.appOid,
        type: 'user.email.primary_changed',
        userOid: user.oid,
        ip: d.context.ip,
        ua: d.context.ua,
        metadata: { email: d.email.email }
      });

      return email;
    });
  }

  async deleteEmail(d: { email: UserEmail; user: User; context: Context }) {
    if (d.email.userOid !== d.user.oid) throw new Error('WTF');
    if (d.email.isPrimary) {
      throw new ServiceError(
        badRequestError({
          message: 'Primary email cannot be removed'
        })
      );
    }

    return withTransaction(async tdb => {
      let email = await tdb.userEmail.delete({ where: { id: d.email.id } });

      auditLogService.log({
        appOid: email.appOid,
        type: 'user.email.deleted',
        userOid: d.user.oid,
        ip: d.context.ip,
        ua: d.context.ua,
        metadata: { email: email.email }
      });

      return email;
    });
  }

  async createTermsAgreement(i: {
    user: User;
    terms: (UserTermsType | Promise<UserTermsType>)[];
    context: Context;
  }) {
    return withTransaction(async db => {
      for (let termProm of i.terms) {
        let term = await termProm;

        await db.userTermsAgreement.create({
          data: {
            ...getId('userTermsAgreement'),
            userOid: i.user.oid,
            typeOid: term.oid,
            ip: i.context.ip,
            ua: i.context.ua
          }
        });

        await auditLogService.log({
          appOid: i.user.appOid,
          type: 'user.terms_agreement.created',
          userOid: i.user.oid,
          ip: i.context.ip,
          ua: i.context.ua,
          metadata: { terms: term.identifier, version: term.version }
        });
      }
    });
  }

  async updateUser(d: {
    user: User;
    context: Context;
    input: {
      firstName?: string;
      lastName?: string;
      name?: string;
      image?: any; // Use any for now, can be typed properly later
    };
  }) {
    return withTransaction(async tdb => {
      let user = await tdb.user.update({
        where: { oid: d.user.oid },
        data: {
          firstName: d.input.firstName,
          lastName: d.input.lastName,
          name: d.input.name,
          image: d.input.image
        }
      });

      await addAfterTransactionHook(() => userEvents.fire('update', user!));

      auditLogService.log({
        appOid: user.appOid,
        type: 'user.updated',
        userOid: user.oid,
        ip: d.context.ip,
        ua: d.context.ua,
        metadata: {
          fields: Object.keys(d.input).filter(
            k => d.input[k as keyof typeof d.input] !== undefined
          )
        }
      });

      return user;
    });
  }

  async deleteUser(d: { user: User; context: Context }) {
    auditLogService.log({
      appOid: d.user.appOid,
      type: 'user.deleted',
      userOid: d.user.oid,
      ip: d.context.ip,
      ua: d.context.ua
    });

    return withTransaction(async tdb => {
      let user = await tdb.user.update({
        where: { oid: d.user.oid },
        data: {
          deletedAt: new Date(),
          status: 'deleted',
          name: `[DELETED]`,
          firstName: `[DELETED]`,
          lastName: ``,
          email: `deleted_${d.user.oid}@deleted.local`
        }
      });

      await addAfterTransactionHook(() => userEvents.fire('delete', user!));

      await tdb.userEmail.deleteMany({
        where: { userOid: d.user.oid }
      });

      await tdb.authDeviceUserSession.updateMany({
        where: { userOid: d.user.oid },
        data: {
          loggedOutAt: new Date(),
          expiresAt: new Date()
        }
      });

      // Get rid of auth sessions to avoid any potential issues (e.g., logging in with the deleted user)
      await tdb.authIntent.deleteMany({ where: { userOid: d.user.oid } });
      await tdb.authAttempt.deleteMany({ where: { userOid: d.user.oid } });
    });
  }

  async setEmails(d: {
    user: User;
    emails: { email: string; isPrimary: boolean; isVerified: boolean }[];
  }) {
    return withTransaction(async tdb => {
      let existing = await tdb.userEmail.findMany({
        where: { userOid: d.user.oid }
      });

      let existingByEmail = new Map(existing.map(e => [e.email, e]));
      let incomingEmails = new Set(d.emails.map(e => parseEmail(e.email).email));

      // Delete emails that are no longer in the input
      for (let ex of existing) {
        if (!incomingEmails.has(ex.email)) {
          await tdb.userEmail.delete({ where: { oid: ex.oid } });
        }
      }

      let results: UserEmail[] = [];

      for (let input of d.emails) {
        let parsed = parseEmail(input.email);
        let ex = existingByEmail.get(parsed.email);

        if (ex) {
          // Update existing email
          let updated = await tdb.userEmail.update({
            where: { oid: ex.oid },
            data: {
              isPrimary: input.isPrimary,
              verifiedAt: input.isVerified ? (ex.verifiedAt ?? new Date()) : null
            }
          });
          results.push(updated);
        } else {
          // Create new email
          let domain = await tdb.emailDomain.upsert({
            where: { domain: parsed.domain },
            create: {
              ...getId('emailDomain'),
              domain: parsed.domain,
              appOid: d.user.appOid
            },
            update: {}
          });

          let created = await tdb.userEmail.create({
            data: {
              ...getId('userEmail'),
              domainOid: domain.oid,
              appOid: d.user.appOid,
              email: parsed.email,
              normalizedEmail: parsed.normalizedEmail,
              isPrimary: input.isPrimary,
              verifiedAt: input.isVerified ? new Date() : null,
              userOid: d.user.oid
            }
          });
          results.push(created);
        }
      }

      // Sync the user's primary email field
      let primary = results.find(e => e.isPrimary);
      if (primary && primary.email !== d.user.email) {
        await tdb.user.update({
          where: { oid: d.user.oid },
          data: { email: primary.email }
        });
      }

      return results;
    });
  }

  async getUser(d: { userId: string }) {
    let user = await db.user.findUnique({
      where: { id: d.userId },
      include: { userEmails: true }
    });
    if (!user) throw new ServiceError(notFoundError('user', d.userId));

    return user;
  }

  async getManyUsersAsMap({ userIds }: { userIds: string[] }) {
    let users = await db.user.findMany({
      where: {
        id: { in: userIds }
      }
    });

    return new Map(users.map(user => [user.id, user]));
  }
}

export let userService = Service.create('UserService', () => new UserServiceImpl()).build();
