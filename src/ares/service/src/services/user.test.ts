import { beforeEach, describe, expect, it, vi } from 'vitest';

let { db, auditLogService, markAresUserChanged, userEvents } = vi.hoisted(() => ({
  db: {
    user: { findFirst: vi.fn(), create: vi.fn() },
    userEmail: { findFirst: vi.fn(), create: vi.fn() },
    userTermsAgreement: { upsert: vi.fn() },
    accountDomain: { findUnique: vi.fn() },
    emailDomain: { upsert: vi.fn() }
  },
  auditLogService: { log: vi.fn() },
  markAresUserChanged: vi.fn(),
  userEvents: { fire: vi.fn() }
}));

vi.mock('@lowerdeck/service', () => ({
  Service: {
    create: vi.fn((_name: string, factory: () => unknown) => ({
      build: () => factory()
    }))
  }
}));

vi.mock('../db', () => ({
  db,
  withTransaction: async (cb: (tdb: unknown) => Promise<unknown>) => await cb(db),
  addAfterTransactionHook: (hook: () => unknown) => hook()
}));

vi.mock('../definitions', () => ({
  terms: {
    privacyPolicy: { oid: 90n, identifier: 'privacy_policy', version: '1' },
    termsOfService: { oid: 91n, identifier: 'terms_of_service', version: '1' }
  }
}));

vi.mock('../events/user', () => ({ userEvents }));

vi.mock('../queues/syncCallback', () => ({ markAresUserChanged }));

vi.mock('./auditLog', () => ({ auditLogService }));

import { EmailInUseError, userService } from './user';

let app = { oid: 5n, defaultTenantOid: 7n } as any;

let context = { ip: '1.2.3.4', ua: 'agent' };

let input = {
  email: 'T2@a.herber.space',
  firstName: 'T2',
  lastName: 'Herber',
  acceptedTerms: true,
  type: 'standard_user' as const,
  signupMethod: 'email' as const,
  context,
  app
};

let existingUser = { oid: 42n, id: 'usr_existing', appOid: 5n, email: 't2@a.herber.space' };

let uniqueConstraintError = () =>
  Object.assign(new Error('Unique constraint'), {
    code: 'P2002'
  });

describe('userService.resolveOrCreateUser', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    db.user.findFirst.mockResolvedValue(null);
    db.user.create.mockResolvedValue({ ...existingUser, id: 'usr_new' });
    db.accountDomain.findUnique.mockResolvedValue(null);
    db.userEmail.findFirst.mockResolvedValue(null);
    db.emailDomain.upsert.mockResolvedValue({ oid: 3n });
    db.userEmail.create.mockResolvedValue({ oid: 4n });
    db.userTermsAgreement.upsert.mockResolvedValue({ oid: 5n });
  });

  it('returns the existing user without inserting', async () => {
    db.user.findFirst.mockResolvedValue(existingUser);

    await expect(userService.resolveOrCreateUser(input)).resolves.toEqual({
      user: existingUser,
      created: false
    });

    expect(db.user.create).not.toHaveBeenCalled();
  });

  it('looks the user up with the email lower-cased', async () => {
    await userService.resolveOrCreateUser(input);

    expect(db.user.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: [
            { email: 't2@a.herber.space' },
            { userEmails: { some: { email: 't2@a.herber.space', verifiedAt: { not: null } } } }
          ]
        })
      })
    );
  });

  it('creates the user when there is none', async () => {
    let created = { ...existingUser, id: 'usr_new' };
    db.user.create.mockResolvedValue(created);

    await expect(userService.resolveOrCreateUser(input)).resolves.toEqual({
      user: created,
      created: true
    });
  });

  // The hyperplane projection lands SCIM-provisioned users into this cell and
  // can insert the row for an email while an SSO login is mid-flight.
  it('adopts the user a concurrent writer created', async () => {
    db.user.findFirst.mockResolvedValueOnce(null).mockResolvedValueOnce(existingUser);
    db.user.create.mockRejectedValue(uniqueConstraintError());

    await expect(userService.resolveOrCreateUser(input)).resolves.toEqual({
      user: existingUser,
      created: false
    });
  });

  it('surfaces the conflict when no user turns up after the retry', async () => {
    db.user.create.mockRejectedValue(uniqueConstraintError());

    await expect(userService.resolveOrCreateUser(input)).rejects.toBeInstanceOf(
      EmailInUseError
    );
  });

  it('does not swallow unrelated failures', async () => {
    db.user.create.mockRejectedValue(new Error('connection reset'));

    await expect(userService.resolveOrCreateUser(input)).rejects.toThrow('connection reset');
    expect(db.user.findFirst).toHaveBeenCalledTimes(1);
  });
});

describe('userService.createUser', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    db.accountDomain.findUnique.mockResolvedValue(null);
    db.userEmail.findFirst.mockResolvedValue(null);
    db.emailDomain.upsert.mockResolvedValue({ oid: 3n });
    db.userEmail.create.mockResolvedValue({ oid: 4n });
    db.userTermsAgreement.upsert.mockResolvedValue({ oid: 5n });
  });

  it('stores the signup method and creates an email identity for email signup', async () => {
    db.user.create.mockResolvedValue({ ...existingUser, id: 'usr_new' });

    await userService.createUser(input);

    expect(db.user.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ signupMethod: 'email' })
    });
    expect(db.userEmail.create).toHaveBeenCalledOnce();
  });

  it('stores the signup method without creating an email identity for SSO signup', async () => {
    db.user.create.mockResolvedValue({ ...existingUser, id: 'usr_new' });

    await userService.createUser({ ...input, signupMethod: 'sso' });

    expect(db.user.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ signupMethod: 'sso' })
    });
    expect(db.userEmail.create).not.toHaveBeenCalled();
  });

  it('reports a duplicate email as a 409', async () => {
    db.user.create.mockRejectedValue(uniqueConstraintError());

    let error = await userService.createUser(input).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(EmailInUseError);
    expect((error as EmailInUseError).data).toMatchObject({
      status: 409,
      code: 'conflict',
      message: 'This email is already in use'
    });
  });
});
