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
import { markAresUserChanged } from '../queues/syncCallback';
import { auditLogService } from './auditLog';

export class EmailInUseError extends ServiceError<ReturnType<typeof conflictError>> {
  constructor() {
    super(conflictError({ message: 'This email is already in use' }));
  }
}

let isUniqueConstraintError = (e: any) => e?.code === 'P2002';

class UserServiceImpl {
  async getSyncSnapshot(d: { user: User }) {
    let user = await db.user.findUniqueOrThrow({
      where: { oid: d.user.oid },
      include: {
        userEmails: { include: { domain: true }, orderBy: { id: 'asc' } },
        userIdentities: {
          include: {
            provider: { include: { oauthProvider: true, ssoTenant: true } }
          },
          orderBy: { id: 'asc' }
        },
        userTermsAgreements: {
          include: { type: true },
          orderBy: { id: 'asc' }
        }
      }
    });

    return {
      revision: user.syncRevision.toString(),
      user: {
        id: user.id,
        status: user.status,
        email: user.email,
        name: user.name,
        firstName: user.firstName,
        lastName: user.lastName,
        image: user.image,
        lastLoginAt: user.lastLoginAt,
        lastActiveAt: user.lastActiveAt,
        deletedAt: user.deletedAt,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt
      },
      emails: user.userEmails.map(email => ({
        id: email.id,
        email: email.email,
        normalizedEmail: email.normalizedEmail,
        domain: email.domain.domain,
        isPrimary: email.isPrimary,
        verifiedAt: email.verifiedAt,
        lastResentAt: email.lastResentAt,
        createdAt: email.createdAt,
        updatedAt: email.updatedAt
      })),
      identities: user.userIdentities.map(identity => ({
        id: identity.id,
        provider: {
          identifier: identity.provider.oauthProvider
            ? identity.provider.oauthProvider.provider
            : identity.provider.ssoTenant
              ? `sso:${identity.provider.ssoTenant.id}`
              : `ares:${identity.provider.id}`,
          name: identity.provider.name
        },
        uid: identity.uid,
        name: identity.name,
        firstName: identity.firstName,
        lastName: identity.lastName,
        email: identity.email,
        photoUrl: identity.photoUrl,
        createdAt: identity.createdAt,
        updatedAt: identity.updatedAt
      })),
      termsAgreements: user.userTermsAgreements.map(agreement => ({
        id: agreement.id,
        terms: {
          identifier: agreement.type.identifier,
          version: agreement.type.version,
          name: agreement.type.name
        },
        ip: agreement.ip,
        ua: agreement.ua,
        acceptedAt: agreement.createdAt
      }))
    };
  }

  async applyProjection(d: {
    app: App;
    input: {
      userId?: string | null;
      authorityRevision: string;
      email: string;
      name: string;
      firstName: string;
      lastName: string;
      image: PrismaJson.EntityImage;
      status: 'active' | 'deleted';
      lastLoginAt: Date | null;
      lastActiveAt: Date | null;
      deletedAt: Date | null;
      emails: Array<{ email: string; isPrimary: boolean; isVerified: boolean }>;
      termsAgreements: Array<{
        terms: { identifier: string; version: string; name: string };
        ip: string;
        ua: string | null;
        acceptedAt: Date;
      }>;
    };
  }) {
    let authorityRevision = BigInt(d.input.authorityRevision);
    let resolveExisting = async () => {
      let byId = d.input.userId
        ? await db.user.findFirst({ where: { id: d.input.userId, appOid: d.app.oid } })
        : null;
      return (
        byId ??
        (await db.user.findFirst({ where: { appOid: d.app.oid, email: d.input.email } }))
      );
    };

    let existing = await resolveExisting();
    if (
      existing?.hyperplaneRevision != null &&
      existing.hyperplaneRevision >= authorityRevision
    ) {
      return existing;
    }

    let apply = async () =>
      await withTransaction(async tdb => {
        if (existing) {
          await tdb.$queryRaw`
            SELECT "oid"
            FROM "User"
            WHERE "oid" = ${existing.oid}
            FOR UPDATE
          `;
          existing = await tdb.user.findUniqueOrThrow({ where: { oid: existing.oid } });

          if (
            existing.hyperplaneRevision != null &&
            existing.hyperplaneRevision >= authorityRevision
          ) {
            return existing;
          }
        }

        let lastLoginAt =
          !existing?.lastLoginAt ||
          (d.input.lastLoginAt && d.input.lastLoginAt > existing.lastLoginAt)
            ? d.input.lastLoginAt
            : existing.lastLoginAt;
        let lastActiveAt =
          !existing?.lastActiveAt ||
          (d.input.lastActiveAt && d.input.lastActiveAt > existing.lastActiveAt)
            ? d.input.lastActiveAt
            : existing.lastActiveAt;
        let user = existing
          ? await tdb.user.update({
              where: { oid: existing.oid },
              data: {
                email: d.input.email,
                name: d.input.name,
                firstName: d.input.firstName,
                lastName: d.input.lastName,
                image: d.input.image,
                status: d.input.status,
                deletedAt: d.input.deletedAt,
                lastLoginAt,
                lastActiveAt,
                hyperplaneRevision: authorityRevision
              }
            })
          : await tdb.user.create({
              data: {
                ...getId('user'),
                ...(d.input.userId ? { id: d.input.userId } : {}),
                appOid: d.app.oid,
                tenantOid: d.app.defaultTenantOid!,
                type: 'user',
                owner: 'self',
                status: d.input.status,
                email: d.input.email,
                name: d.input.name,
                firstName: d.input.firstName,
                lastName: d.input.lastName,
                image: d.input.image,
                deletedAt: d.input.deletedAt,
                lastLoginAt,
                lastActiveAt,
                hyperplaneRevision: authorityRevision
              }
            });

        await this.setEmails({ user, emails: d.input.emails, suppressSync: true });

        for (let agreement of d.input.termsAgreements) {
          let type = await tdb.userTermsType.upsert({
            where: {
              identifier_version: {
                identifier: agreement.terms.identifier,
                version: agreement.terms.version
              }
            },
            create: { ...getId('userTermsType'), ...agreement.terms },
            update: { name: agreement.terms.name }
          });
          let currentAgreement = await tdb.userTermsAgreement.findUnique({
            where: { userOid_typeOid: { userOid: user.oid, typeOid: type.oid } }
          });
          if (!currentAgreement) {
            await tdb.userTermsAgreement.create({
              data: {
                ...getId('userTermsAgreement'),
                userOid: user.oid,
                typeOid: type.oid,
                ip: agreement.ip,
                ua: agreement.ua,
                createdAt: agreement.acceptedAt
              }
            });
          } else if (agreement.acceptedAt < currentAgreement.createdAt) {
            await tdb.userTermsAgreement.update({
              where: { oid: currentAgreement.oid },
              data: {
                ip: agreement.ip,
                ua: agreement.ua,
                createdAt: agreement.acceptedAt
              }
            });
          }
        }
        return user;
      });

    try {
      return await apply();
    } catch (e) {
      if (!isUniqueConstraintError(e)) throw e;

      // A login flow inserted the row for this email between our lookup and
      // our insert. Re-resolve so the projection lands as an update instead.
      existing = await resolveExisting();
      if (!existing) throw e;

      return await apply();
    }
  }

  async linkToAccount(d: { user: User }) {
    let { domain } = parseEmail(d.user.email);
    let accountDomain = await db.accountDomain.findUnique({
      where: {
        appOid_domain: {
          appOid: d.user.appOid,
          domain
        }
      },
      include: { account: true }
    });
    let accountOid =
      accountDomain?.account.status == 'active' ? accountDomain.accountOid : null;

    if (d.user.accountOid == accountOid) return d.user;
    return await db.user.update({
      where: { oid: d.user.oid },
      data: { accountOid }
    });
  }

  async findByEmailSafe(d: { email: string; app: App }) {
    // Emails are always persisted lower-cased, but identity providers assert
    // them in whatever casing they please.
    let email = d.email.trim().toLowerCase();

    return await db.user.findFirst({
      where: {
        appOid: d.app.oid,
        OR: [
          { email },
          {
            userEmails: {
              some: {
                email,
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
        let { domain } = parseEmail(d.email);
        let accountDomain = await tdb.accountDomain.findUnique({
          where: {
            appOid_domain: {
              appOid: d.app.oid,
              domain
            }
          },
          include: { account: true }
        });
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
            accountOid:
              accountDomain?.account.status == 'active' ? accountDomain.accountOid : null,
            tenantOid: d.app.defaultTenantOid!,

            isFullyCreated: d.type === 'standard_user',

            image: { type: 'default' }
          }
        });

        await this.createTermsAgreement({
          user,
          context: d.context,
          terms: [terms.privacyPolicy, terms.termsOfService],
          suppressSync: true
        });

        await this.createEmail({
          email: d.email,
          user,
          app: d.app,
          context: d.context,
          isForNewUser: true,
          suppressSync: true
        });

        addAfterTransactionHook(() => userEvents.fire('create', user));
        await markAresUserChanged({ userId: user.id, db: tdb });

        auditLogService.log({
          appOid: d.app.oid,
          type: 'user.created',
          userOid: user.oid,
          ip: d.context.ip,
          ua: d.context.ua
        });

        return user;
      } catch (e: any) {
        if (isUniqueConstraintError(e)) throw new EmailInUseError();

        console.error('Error creating user:', e);
        throw e;
      }
    });
  }

  /**
   * Resolves the user owning an email, creating one if there is none yet.
   *
   * A user row for a given email can be written by several independent
   * writers -- an interactive login, and the hyperplane projection that lands
   * SCIM-provisioned users into this cell. A lookup that comes back empty is
   * therefore not a guarantee that the insert will succeed, so treat a unique
   * constraint violation as "somebody else got there first" and adopt their
   * row rather than failing the caller.
   *
   * Must not be called from inside a transaction: recovering from the
   * conflict requires the failed insert to have been rolled back first.
   */
  async resolveOrCreateUser(d: {
    email: string;
    firstName: string;
    lastName: string;
    acceptedTerms: boolean;
    context: Context;
    app: App;
    type: 'standard_user' | 'pre_created_user';
  }): Promise<{ user: User; created: boolean }> {
    let existing = await this.findByEmailSafe({ email: d.email, app: d.app });
    if (existing) return { user: existing, created: false };

    try {
      return { user: await this.createUser(d), created: true };
    } catch (e) {
      if (!(e instanceof EmailInUseError) && !isUniqueConstraintError(e)) throw e;

      let raced = await this.findByEmailSafe({ email: d.email, app: d.app });
      if (!raced) throw e;

      return { user: raced, created: false };
    }
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
              include: { account: true }
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
    suppressSync?: boolean;
  }) {
    d.email = d.email.trim().toLowerCase();

    return withTransaction(async tdb => {
      let existingEmail = await tdb.userEmail.findFirst({
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

        throw new EmailInUseError();
      }

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

      if (!d.suppressSync) {
        await markAresUserChanged({ userId: d.user.id, db: tdb });
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

      await markAresUserChanged({ userOid: email.userOid, db: tdb });

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

      let parsedEmail = parseEmail(d.email.email);
      let accountDomain = await tdb.accountDomain.findUnique({
        where: {
          appOid_domain: {
            appOid: d.user.appOid,
            domain: parsedEmail.domain
          }
        },
        include: { account: true }
      });
      let user = await tdb.user.update({
        where: { oid: d.user.oid },
        data: {
          email: d.email.email,
          accountOid:
            accountDomain?.account.status == 'active' ? accountDomain.accountOid : null
        }
      });

      await addAfterTransactionHook(() => userEvents.fire('update', user!));
      await markAresUserChanged({ userId: user.id, db: tdb });

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

      await markAresUserChanged({ userId: d.user.id, db: tdb });

      return email;
    });
  }

  async createTermsAgreement(i: {
    user: User;
    terms: (UserTermsType | Promise<UserTermsType>)[];
    context: Context;
    suppressSync?: boolean;
  }) {
    return withTransaction(async db => {
      for (let termProm of i.terms) {
        let term = await termProm;

        await db.userTermsAgreement.upsert({
          where: { userOid_typeOid: { userOid: i.user.oid, typeOid: term.oid } },
          create: {
            ...getId('userTermsAgreement'),
            userOid: i.user.oid,
            typeOid: term.oid,
            ip: i.context.ip,
            ua: i.context.ua
          },
          update: {}
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
      if (!i.suppressSync) {
        await markAresUserChanged({ userId: i.user.id, db });
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
      await markAresUserChanged({ userId: user.id, db: tdb });

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
      await markAresUserChanged({ userId: user.id, db: tdb });

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
    suppressSync?: boolean;
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
        let parsedEmail = parseEmail(primary.email);
        let accountDomain = await tdb.accountDomain.findUnique({
          where: {
            appOid_domain: {
              appOid: d.user.appOid,
              domain: parsedEmail.domain
            }
          },
          include: { account: true }
        });
        await tdb.user.update({
          where: { oid: d.user.oid },
          data: {
            email: primary.email,
            accountOid:
              accountDomain?.account.status == 'active' ? accountDomain.accountOid : null
          }
        });
      }

      if (!d.suppressSync) {
        await markAresUserChanged({ userId: d.user.id, db: tdb });
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
