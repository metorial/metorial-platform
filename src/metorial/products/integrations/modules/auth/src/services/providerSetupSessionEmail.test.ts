import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

let mocks = vi.hoisted(() => ({
  ids: { count: 0 },
  emailCreate: vi.fn(),
  emailFindUnique: vi.fn(),
  emailFindUniqueOrThrow: vi.fn(),
  emailFindMany: vi.fn(),
  emailUpdate: vi.fn(),
  emailUpdateMany: vi.fn(),
  memberFindMany: vi.fn(),
  organizationFindUniqueOrThrow: vi.fn(),
  resolveMetorialFacing: vi.fn(),
  resolveMetorialFacingWithOptionalActor: vi.fn(),
  checkTenant: vi.fn(),
  fire: vi.fn(),
  send: vi.fn()
}));

vi.mock('@lowerdeck/service', () => ({
  Service: {
    create: vi.fn((_name, factory) => ({
      build: () => factory()
    }))
  }
}));

vi.mock('@lowerdeck/pagination', () => ({
  Paginator: {
    create: vi.fn(callback =>
      callback({ prisma: (query: (opts: unknown) => unknown) => query({ take: 25 }) })
    ),
    validate: vi.fn()
  }
}));

vi.mock('@metorial-subspace/db', () => ({
  db: {
    providerSetupSessionEmail: {
      create: mocks.emailCreate,
      findUnique: mocks.emailFindUnique,
      findUniqueOrThrow: mocks.emailFindUniqueOrThrow,
      findMany: mocks.emailFindMany,
      update: mocks.emailUpdate,
      updateMany: mocks.emailUpdateMany
    }
  },
  getId: (prefix: string) => {
    mocks.ids.count++;
    return { oid: BigInt(900 + mocks.ids.count), id: `${prefix}_${mocks.ids.count}` };
  }
}));

vi.mock('@metorial-subspace/module-tenant', () => ({
  checkTenant: mocks.checkTenant,
  metorialDb: {
    organization: { findUniqueOrThrow: mocks.organizationFindUniqueOrThrow },
    organizationMember: { findMany: mocks.memberFindMany }
  },
  resolveMetorialFacing: mocks.resolveMetorialFacing,
  resolveMetorialFacingWithOptionalActor: mocks.resolveMetorialFacingWithOptionalActor,
  toProviderEventBase: vi.fn(d => ({ instance: d.instance }))
}));

vi.mock('@metorial/fabric', () => ({
  Fabric: { fire: mocks.fire }
}));

vi.mock('../email/adminSetupLink', () => ({
  adminSetupLinkEmail: { send: mocks.send }
}));

vi.mock('../lib/setupSessionUrl', () => ({
  getProviderSetupSessionUrl: vi.fn(
    (session: { id: string }) => `https://setup.test/setup-session/${session.id}`
  )
}));

import { providerSetupSessionEmailService } from './providerSetupSessionEmail';

let instance = { oid: 40n, organizationOid: 5n } as any;

let memberActor = { oid: 3n, type: 'member', name: 'Jane Doe' } as any;

let uniqueError = () => Object.assign(new Error('unique'), { code: 'P2002' });

let bucketAt = (iso: string) => Math.floor(new Date(iso).getTime() / 600_000);

let makeSetupSession = (overrides: Record<string, unknown> = {}) =>
  ({
    oid: 100n,
    id: 'pas_1',
    clientSecret: 'pas_secret_1',
    typeSelected: 'admin',
    typeConcrete: 'admin',
    status: 'pending',
    expiresAt: new Date('2026-10-30T10:00:00Z'),
    tenantOid: 10n,
    projectOid: 20n,
    solutionOid: 7,
    environmentOid: 30n,
    instanceOid: 40n,
    provider: { id: 'pro_1', name: 'Microsoft Entra' },
    ...overrides
  }) as any;

let makeEmailRecord = (overrides: Record<string, unknown> = {}) => ({
  oid: 900n,
  id: 'pasem_existing',
  recipientEmail: 'admin@example.com',
  organizationMemberId: null,
  throttleBucket: 1,
  setupSessionOid: 100n,
  senderActorOid: 77n,
  failedAt: null,
  createdAt: new Date(),
  setupSession: { id: 'pas_1' },
  senderActor: null,
  ...overrides
});

let createEmails = (
  input: { emails?: string[]; organizationMemberIds?: string[] },
  opts: { setupSession?: any; organizationActor?: any } = {}
) =>
  providerSetupSessionEmailService.createProviderSetupSessionEmails({
    instance,
    organizationActor: 'organizationActor' in opts ? opts.organizationActor : memberActor,
    providerSetupSession: opts.setupSession ?? makeSetupSession(),
    input
  });

let firedEvents = (name: string) =>
  mocks.fire.mock.calls.filter(call => call[0] === name).map(call => call[1]);

let recentRecipientRows = (count: number, extra: string[] = [], prefix = 'recent') =>
  [...Array.from({ length: count }, (_, i) => `${prefix}${i}@example.com`), ...extra].map(
    recipientEmail => ({ recipientEmail })
  );

let mockRecentRecipients = (d: {
  session: { recipientEmail: string }[];
  instance: { recipientEmail: string }[];
}) =>
  mocks.emailFindMany.mockImplementation(async ({ where }) =>
    where.setupSession ? d.instance : d.session
  );

describe('createProviderSetupSessionEmails', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-24T10:05:00Z'));

    mocks.ids.count = 0;

    mocks.resolveMetorialFacingWithOptionalActor.mockResolvedValue({
      tenant: { oid: 10n },
      environment: { oid: 30n },
      solution: { oid: 7 },
      actor: { oid: 77n }
    });
    mocks.organizationFindUniqueOrThrow.mockResolvedValue({ oid: 5n, name: 'Acme' });
    mocks.emailFindUnique.mockResolvedValue(null);
    mocks.emailFindMany.mockResolvedValue([]);
    mocks.emailCreate.mockImplementation(async ({ data }) => makeEmailRecord(data));
    mocks.emailUpdate.mockResolvedValue({});
    mocks.emailUpdateMany.mockResolvedValue({ count: 1 });
    mocks.fire.mockResolvedValue(undefined);
    mocks.send.mockResolvedValue({ id: null });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('queues the email with the record id as the relay idempotency key', async () => {
    let results = await createEmails({ emails: ['  Admin@Example.com '] });

    expect(mocks.emailCreate.mock.calls[0]![0].data).toEqual({
      oid: 901n,
      id: 'providerSetupSessionEmail_1',
      recipientEmail: 'admin@example.com',
      organizationMemberId: null,
      throttleBucket: bucketAt('2026-10-24T10:05:00Z'),
      setupSessionOid: 100n,
      senderActorOid: 77n
    });

    expect(mocks.send).toHaveBeenCalledTimes(1);
    expect(mocks.send).toHaveBeenCalledWith({
      to: ['admin@example.com'],
      idempotencyKey: 'providerSetupSessionEmail_1',
      data: {
        senderName: 'Jane Doe',
        providerName: 'Microsoft Entra',
        organizationName: 'Acme',
        setupUrl: 'https://setup.test/setup-session/pas_1',
        expiresAt: new Date('2026-10-30T10:00:00Z')
      }
    });

    expect(results).toEqual([
      {
        setupSessionEmail: expect.objectContaining({ id: 'providerSetupSessionEmail_1' }),
        deduplicated: false
      }
    ]);
  });

  it('buckets sends into fixed 10-minute windows', async () => {
    vi.setSystemTime(new Date('2026-10-24T10:09:59.999Z'));
    await createEmails({ emails: ['admin@example.com'] });

    vi.setSystemTime(new Date('2026-10-24T10:10:00Z'));
    await createEmails({ emails: ['admin@example.com'] });

    let buckets = mocks.emailCreate.mock.calls.map(call => call[0].data.throttleBucket);

    expect(buckets).toEqual([
      bucketAt('2026-10-24T10:09:59.999Z'),
      bucketAt('2026-10-24T10:09:59.999Z') + 1
    ]);
  });

  it('returns the existing record without sending when the recipient is already in the window', async () => {
    let existing = makeEmailRecord();
    mocks.emailFindUnique.mockResolvedValue(existing);

    let results = await createEmails({ emails: ['admin@example.com'] });

    expect(mocks.emailFindUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          setupSessionOid_recipientEmail_throttleBucket: {
            setupSessionOid: 100n,
            recipientEmail: 'admin@example.com',
            throttleBucket: bucketAt('2026-10-24T10:05:00Z')
          }
        }
      })
    );

    expect(mocks.emailCreate).not.toHaveBeenCalled();
    expect(mocks.send).not.toHaveBeenCalled();
    expect(mocks.fire).not.toHaveBeenCalled();
    expect(results).toEqual([{ setupSessionEmail: existing, deduplicated: true }]);
  });

  it('returns the concurrently created record when the insert loses the race', async () => {
    let existing = makeEmailRecord();
    mocks.emailFindUnique.mockResolvedValueOnce(null).mockResolvedValueOnce(existing);
    mocks.emailCreate.mockRejectedValueOnce(uniqueError());

    let results = await createEmails({ emails: ['admin@example.com'] });

    expect(mocks.emailCreate).toHaveBeenCalledTimes(1);
    expect(mocks.send).not.toHaveBeenCalled();
    expect(mocks.fire).not.toHaveBeenCalled();
    expect(results).toEqual([{ setupSessionEmail: existing, deduplicated: true }]);
  });

  it('fires paired hooks only for the recipients that won the race', async () => {
    mocks.emailFindUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(makeEmailRecord({ recipientEmail: 'first@example.com' }))
      .mockResolvedValueOnce(null);
    mocks.emailCreate
      .mockRejectedValueOnce(uniqueError())
      .mockImplementationOnce(async ({ data }) => makeEmailRecord(data));

    let results = await createEmails({ emails: ['first@example.com', 'second@example.com'] });

    expect(results.map(result => result.deduplicated)).toEqual([true, false]);

    expect(firedEvents('provider.setup_session.email.created:before')).toEqual([
      expect.objectContaining({
        recipient: { email: 'second@example.com', organizationMemberId: null }
      })
    ]);
    expect(firedEvents('provider.setup_session.email.created:after')).toEqual([
      expect.objectContaining({
        setupSessionEmail: expect.objectContaining({ recipientEmail: 'second@example.com' })
      })
    ]);
  });

  it('reuses a failed record in the same window so the retry keeps its idempotency key', async () => {
    let failed = makeEmailRecord({ failedAt: new Date('2026-10-24T10:01:00Z') });
    let reclaimed = makeEmailRecord({ failedAt: null });
    mocks.emailFindUnique.mockResolvedValue(failed);
    mocks.emailFindUniqueOrThrow.mockResolvedValue(reclaimed);

    let results = await createEmails({ emails: ['admin@example.com'] });

    expect(mocks.emailCreate).not.toHaveBeenCalled();
    expect(mocks.emailUpdateMany).toHaveBeenCalledWith({
      where: { oid: 900n, failedAt: { not: null } },
      data: { failedAt: null, organizationMemberId: null, senderActorOid: 77n }
    });

    expect(mocks.send).toHaveBeenCalledTimes(1);
    expect(mocks.send.mock.calls[0]![0].idempotencyKey).toBe('pasem_existing');

    expect(firedEvents('provider.setup_session.email.created:before')).toHaveLength(1);
    expect(firedEvents('provider.setup_session.email.created:after')).toHaveLength(1);
    expect(results).toEqual([{ setupSessionEmail: reclaimed, deduplicated: false }]);
  });

  it('does not report a racing request as deduplicated when the existing record failed', async () => {
    let failed = makeEmailRecord({ failedAt: new Date('2026-10-24T10:01:00Z') });
    mocks.emailFindUnique.mockResolvedValueOnce(null).mockResolvedValueOnce(failed);
    mocks.emailCreate.mockRejectedValueOnce(uniqueError());
    mocks.emailFindUniqueOrThrow.mockResolvedValue(makeEmailRecord());

    let results = await createEmails({ emails: ['admin@example.com'] });

    expect(mocks.emailUpdateMany).toHaveBeenCalledTimes(1);
    expect(mocks.send.mock.calls[0]![0].idempotencyKey).toBe('pasem_existing');
    expect(results).toEqual([
      {
        setupSessionEmail: expect.objectContaining({ id: 'pasem_existing' }),
        deduplicated: false
      }
    ]);
  });

  it('reports the record as deduplicated when another request reclaimed it first', async () => {
    let failed = makeEmailRecord({ failedAt: new Date('2026-10-24T10:01:00Z') });
    let inFlight = makeEmailRecord({ failedAt: null });
    mocks.emailFindUnique.mockResolvedValueOnce(failed).mockResolvedValueOnce(inFlight);
    mocks.emailUpdateMany.mockResolvedValue({ count: 0 });

    let results = await createEmails({ emails: ['admin@example.com'] });

    expect(mocks.emailFindUniqueOrThrow).not.toHaveBeenCalled();
    expect(mocks.send).not.toHaveBeenCalled();
    expect(mocks.fire).not.toHaveBeenCalled();
    expect(results).toEqual([{ setupSessionEmail: inFlight, deduplicated: true }]);
  });

  it('fails with a conflict when the slot cannot be claimed or read back', async () => {
    mocks.emailCreate.mockRejectedValue(uniqueError());

    await expect(createEmails({ emails: ['admin@example.com'] })).rejects.toMatchObject({
      data: expect.objectContaining({ code: 'admin_setup_email_conflict' })
    });

    expect(mocks.emailCreate).toHaveBeenCalledTimes(3);
    expect(mocks.send).not.toHaveBeenCalled();
    expect(mocks.fire).not.toHaveBeenCalled();
  });

  it('rethrows insert errors other than unique violations without sending', async () => {
    mocks.emailCreate.mockRejectedValue(new Error('connection lost'));

    await expect(createEmails({ emails: ['admin@example.com'] })).rejects.toThrow(
      'connection lost'
    );

    expect(mocks.emailCreate).toHaveBeenCalledTimes(1);
    expect(mocks.send).not.toHaveBeenCalled();
    expect(mocks.emailUpdate).not.toHaveBeenCalled();
  });

  it('keeps the record and marks it failed when queueing fails', async () => {
    mocks.send.mockRejectedValue(new Error('relay down'));

    await expect(createEmails({ emails: ['admin@example.com'] })).rejects.toThrow(
      'relay down'
    );

    expect(mocks.emailUpdate).toHaveBeenCalledWith({
      where: { oid: 901n },
      data: { failedAt: new Date('2026-10-24T10:05:00Z') }
    });
    expect(firedEvents('provider.setup_session.email.created:before')).toHaveLength(1);
    expect(firedEvents('provider.setup_session.email.created:after')).toHaveLength(0);
  });

  it('rethrows the original error when marking the record failed fails', async () => {
    let consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    mocks.send.mockRejectedValue(new Error('relay down'));
    mocks.emailUpdate.mockRejectedValue(new Error('database down'));

    await expect(createEmails({ emails: ['admin@example.com'] })).rejects.toThrow(
      'relay down'
    );

    expect(mocks.emailUpdate).toHaveBeenCalledTimes(1);
    consoleError.mockRestore();
  });

  it('only marks the failed recipient when a later recipient fails', async () => {
    mocks.send
      .mockResolvedValueOnce({ id: null })
      .mockRejectedValueOnce(new Error('relay down'));

    await expect(
      createEmails({ emails: ['first@example.com', 'second@example.com'] })
    ).rejects.toThrow('relay down');

    expect(mocks.send.mock.calls.map(call => call[0].idempotencyKey)).toEqual([
      'providerSetupSessionEmail_1',
      'providerSetupSessionEmail_2'
    ]);
    expect(mocks.emailUpdate).toHaveBeenCalledTimes(1);
    expect(mocks.emailUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ where: { oid: 902n } })
    );
    expect(firedEvents('provider.setup_session.email.created:after')).toEqual([
      expect.objectContaining({
        setupSessionEmail: expect.objectContaining({ recipientEmail: 'first@example.com' })
      })
    ]);
  });

  it('fires a paired before and after hook for every queued recipient', async () => {
    await createEmails({ emails: ['first@example.com', 'second@example.com'] });

    expect(firedEvents('provider.setup_session.email.created:before')).toEqual([
      expect.objectContaining({
        instance,
        setupSession: expect.objectContaining({ id: 'pas_1' }),
        recipient: { email: 'first@example.com', organizationMemberId: null }
      }),
      expect.objectContaining({
        recipient: { email: 'second@example.com', organizationMemberId: null }
      })
    ]);

    expect(firedEvents('provider.setup_session.email.created:after')).toEqual([
      expect.objectContaining({
        setupSession: expect.objectContaining({ id: 'pas_1' }),
        setupSessionEmail: expect.objectContaining({ id: 'providerSetupSessionEmail_1' })
      }),
      expect.objectContaining({
        setupSessionEmail: expect.objectContaining({ id: 'providerSetupSessionEmail_2' })
      })
    ]);

    let createOrder = mocks.emailCreate.mock.invocationCallOrder[0]!;
    let beforeOrder = mocks.fire.mock.invocationCallOrder[0]!;
    let sendOrder = mocks.send.mock.invocationCallOrder[0]!;

    expect(createOrder).toBeLessThan(beforeOrder);
    expect(beforeOrder).toBeLessThan(sendOrder);
  });

  it('marks the claimed record failed without sending when a before hook vetoes the email', async () => {
    mocks.fire.mockImplementation(async (name: string) => {
      if (name === 'provider.setup_session.email.created:before') throw new Error('vetoed');
    });

    await expect(createEmails({ emails: ['admin@example.com'] })).rejects.toThrow('vetoed');

    expect(mocks.send).not.toHaveBeenCalled();
    expect(mocks.emailUpdate).toHaveBeenCalledWith({
      where: { oid: 901n },
      data: { failedAt: new Date('2026-10-24T10:05:00Z') }
    });
    expect(firedEvents('provider.setup_session.email.created:after')).toHaveLength(0);
  });

  it('sends without a sender when no actor is given', async () => {
    mocks.resolveMetorialFacingWithOptionalActor.mockResolvedValue({
      tenant: { oid: 10n },
      environment: { oid: 30n },
      solution: { oid: 7 }
    });

    await createEmails(
      { emails: ['admin@example.com'] },
      { organizationActor: undefined, setupSession: makeSetupSession({ provider: null }) }
    );

    expect(mocks.emailCreate.mock.calls[0]![0].data.senderActorOid).toBeNull();
    expect(mocks.send.mock.calls[0]![0].data).toMatchObject({
      senderName: null,
      providerName: 'an integration'
    });
  });

  it('only names human members as the sender', async () => {
    await createEmails(
      { emails: ['admin@example.com'] },
      { organizationActor: { oid: 4n, type: 'machine_access', name: 'CI Key' } }
    );

    expect(mocks.emailCreate.mock.calls[0]![0].data.senderActorOid).toBe(77n);
    expect(mocks.send.mock.calls[0]![0].data.senderName).toBeNull();
  });

  it('accepts sessions where either the selected or concrete type is admin', async () => {
    for (let overrides of [
      { typeSelected: 'auth_only', typeConcrete: 'admin' },
      { typeSelected: 'admin', typeConcrete: null }
    ]) {
      await createEmails(
        { emails: ['admin@example.com'] },
        { setupSession: makeSetupSession(overrides) }
      );
    }

    expect(mocks.send).toHaveBeenCalledTimes(2);
  });

  it('rejects non-admin setup sessions', async () => {
    await expect(
      createEmails(
        { emails: ['admin@example.com'] },
        {
          setupSession: makeSetupSession({
            typeSelected: 'auth_only',
            typeConcrete: 'auth_only'
          })
        }
      )
    ).rejects.toMatchObject({
      data: expect.objectContaining({ code: 'admin_setup_email_not_supported' })
    });

    expect(mocks.emailCreate).not.toHaveBeenCalled();
    expect(mocks.send).not.toHaveBeenCalled();
  });

  it('rejects expired and finished setup sessions', async () => {
    for (let [overrides, message] of [
      [{ expiresAt: new Date('2026-10-24T10:04:59Z') }, 'expired'],
      [{ status: 'completed', expiresAt: new Date('2026-10-24T10:04:59Z') }, 'completed'],
      [{ status: 'failed' }, 'failed']
    ] as const) {
      await expect(
        createEmails(
          { emails: ['admin@example.com'] },
          { setupSession: makeSetupSession(overrides) }
        )
      ).rejects.toMatchObject({
        data: expect.objectContaining({
          code: 'admin_setup_email_session_inactive',
          message: expect.stringContaining(`that is ${message}`)
        })
      });
    }

    expect(mocks.emailCreate).not.toHaveBeenCalled();
  });

  describe('daily recipient cap', () => {
    it('counts the distinct recipients emailed in the last 24 hours, ignoring failed records', async () => {
      await createEmails({ emails: ['admin@example.com'] });

      expect(mocks.emailFindMany).toHaveBeenNthCalledWith(1, {
        where: {
          setupSessionOid: 100n,
          failedAt: null,
          createdAt: { gte: new Date('2026-10-23T10:05:00Z') }
        },
        distinct: ['recipientEmail'],
        select: { recipientEmail: true }
      });
    });

    it('also counts the recipients emailed by every setup session of the instance', async () => {
      await createEmails({ emails: ['admin@example.com'] });

      expect(mocks.emailFindMany).toHaveBeenNthCalledWith(2, {
        where: {
          setupSession: { tenantOid: 10n, environmentOid: 30n },
          failedAt: null,
          createdAt: { gte: new Date('2026-10-23T10:05:00Z') }
        },
        distinct: ['recipientEmail'],
        select: { recipientEmail: true }
      });
    });

    it('rejects a request that would exceed the instance cap before claiming anything', async () => {
      mockRecentRecipients({
        session: [],
        instance: recentRecipientRows(199, [], 'other-session')
      });

      await expect(
        createEmails({ emails: ['new0@example.com', 'new1@example.com'] })
      ).rejects.toMatchObject({
        data: expect.objectContaining({ code: 'admin_setup_email_limit_reached', status: 429 })
      });

      expect(mocks.emailFindUnique).not.toHaveBeenCalled();
      expect(mocks.emailCreate).not.toHaveBeenCalled();
      expect(mocks.send).not.toHaveBeenCalled();
      expect(mocks.fire).not.toHaveBeenCalled();
    });

    it('allows a request that reaches the instance cap exactly', async () => {
      mockRecentRecipients({
        session: [],
        instance: recentRecipientRows(199, [], 'other-session')
      });

      await createEmails({ emails: ['new0@example.com'] });

      expect(mocks.send).toHaveBeenCalledTimes(1);
    });

    it('does not count recipients already emailed by another setup session of the instance', async () => {
      mockRecentRecipients({
        session: [],
        instance: recentRecipientRows(200, [], 'other-session')
      });

      await createEmails({ emails: ['other-session0@example.com'] });

      expect(mocks.send).toHaveBeenCalledTimes(1);
    });

    it('skips the instance query when the setup session cap is already exceeded', async () => {
      mockRecentRecipients({ session: recentRecipientRows(50), instance: [] });

      await expect(createEmails({ emails: ['new@example.com'] })).rejects.toMatchObject({
        data: expect.objectContaining({ code: 'admin_setup_email_limit_reached' })
      });

      expect(mocks.emailFindMany).toHaveBeenCalledTimes(1);
    });

    it('rejects a request that would exceed the cap before claiming anything', async () => {
      mocks.emailFindMany.mockResolvedValue(recentRecipientRows(45));

      await expect(
        createEmails({ emails: Array.from({ length: 6 }, (_, i) => `new${i}@example.com`) })
      ).rejects.toMatchObject({
        data: expect.objectContaining({ code: 'admin_setup_email_limit_reached', status: 429 })
      });

      expect(mocks.emailFindUnique).not.toHaveBeenCalled();
      expect(mocks.emailCreate).not.toHaveBeenCalled();
      expect(mocks.send).not.toHaveBeenCalled();
      expect(mocks.fire).not.toHaveBeenCalled();
    });

    it('allows a request that reaches the cap exactly', async () => {
      mocks.emailFindMany.mockResolvedValue(recentRecipientRows(45));

      await createEmails({
        emails: Array.from({ length: 5 }, (_, i) => `new${i}@example.com`)
      });

      expect(mocks.send).toHaveBeenCalledTimes(5);
    });

    it('does not count recipients that were already emailed', async () => {
      mocks.emailFindMany.mockResolvedValue(recentRecipientRows(49, ['admin@example.com']));

      await createEmails({ emails: ['admin@example.com'] });

      await expect(
        createEmails({ emails: ['admin@example.com', 'new@example.com'] })
      ).rejects.toMatchObject({
        data: expect.objectContaining({ code: 'admin_setup_email_limit_reached' })
      });

      expect(mocks.send).toHaveBeenCalledTimes(1);
    });
  });

  describe('recipients', () => {
    it('resolves members to their organization profile email and dedupes against raw emails', async () => {
      mocks.memberFindMany.mockResolvedValue([
        {
          id: 'ome_1',
          actor: { email: 'Member@Example.com' },
          user: { email: 'account@example.com' }
        }
      ]);

      await createEmails({
        organizationMemberIds: ['ome_1', 'ome_1'],
        emails: ['member@example.com', 'other@example.com']
      });

      expect(mocks.memberFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: { in: ['ome_1'] }, organizationOid: 5n, status: 'active' }
        })
      );

      expect(mocks.emailCreate.mock.calls.map(call => call[0].data)).toEqual([
        expect.objectContaining({
          recipientEmail: 'member@example.com',
          organizationMemberId: 'ome_1'
        }),
        expect.objectContaining({
          recipientEmail: 'other@example.com',
          organizationMemberId: null
        })
      ]);
    });

    it('falls back to the account email when the profile has no email', async () => {
      for (let actorEmail of [null, '']) {
        mocks.memberFindMany.mockResolvedValue([
          { id: 'ome_1', actor: { email: actorEmail }, user: { email: 'Account@Example.com' } }
        ]);

        await createEmails({ organizationMemberIds: ['ome_1'] });
      }

      expect(mocks.emailCreate.mock.calls.map(call => call[0].data.recipientEmail)).toEqual([
        'account@example.com',
        'account@example.com'
      ]);
    });

    it('rejects members without any email address', async () => {
      mocks.memberFindMany.mockResolvedValue([
        { id: 'ome_1', actor: { email: null }, user: { email: '  ' } }
      ]);

      await expect(createEmails({ organizationMemberIds: ['ome_1'] })).rejects.toMatchObject({
        data: expect.objectContaining({ code: 'admin_setup_email_member_not_found' })
      });

      expect(mocks.emailCreate).not.toHaveBeenCalled();
    });

    it('rejects unknown organization members', async () => {
      mocks.memberFindMany.mockResolvedValue([]);

      await expect(
        createEmails({ organizationMemberIds: ['ome_missing'] })
      ).rejects.toMatchObject({
        data: expect.objectContaining({ code: 'admin_setup_email_member_not_found' })
      });

      expect(mocks.emailCreate).not.toHaveBeenCalled();
    });

    it('dedupes raw emails case-insensitively', async () => {
      await createEmails({ emails: ['Admin@Example.com', ' admin@example.com'] });

      expect(mocks.emailCreate).toHaveBeenCalledTimes(1);
    });

    it('requires at least one non-blank recipient', async () => {
      for (let input of [{}, { emails: [] }, { emails: ['   '] }]) {
        await expect(createEmails(input)).rejects.toMatchObject({
          data: expect.objectContaining({ code: 'admin_setup_email_recipients_required' })
        });
      }

      expect(mocks.emailCreate).not.toHaveBeenCalled();
    });

    it('applies the recipient limit after deduplication', async () => {
      let tenUnique = Array.from({ length: 10 }, (_, i) => `admin${i}@example.com`);

      await createEmails({
        emails: [...tenUnique, 'ADMIN0@example.com', ' admin1@example.com']
      });

      expect(mocks.emailCreate).toHaveBeenCalledTimes(10);

      await expect(
        createEmails({ emails: [...tenUnique, 'admin10@example.com'] })
      ).rejects.toMatchObject({
        data: expect.objectContaining({ code: 'admin_setup_email_too_many_recipients' })
      });
    });

    it('checks the combined limit before looking up members', async () => {
      await expect(
        createEmails({
          organizationMemberIds: Array.from({ length: 6 }, (_, i) => `ome_${i}`),
          emails: Array.from({ length: 5 }, (_, i) => `admin${i}@example.com`)
        })
      ).rejects.toMatchObject({
        data: expect.objectContaining({ code: 'admin_setup_email_too_many_recipients' })
      });

      expect(mocks.memberFindMany).not.toHaveBeenCalled();
      expect(mocks.emailCreate).not.toHaveBeenCalled();
    });
  });
});

describe('listProviderSetupSessionEmails', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mocks.resolveMetorialFacing.mockResolvedValue({
      tenant: { oid: 10n },
      environment: { oid: 30n },
      solution: { oid: 7 }
    });
    mocks.emailFindMany.mockResolvedValue([]);
  });

  it('checks the tenant and lists only the non-failed emails of the setup session', async () => {
    let setupSession = makeSetupSession();

    await providerSetupSessionEmailService.listProviderSetupSessionEmails({
      instance,
      providerSetupSession: setupSession
    });

    expect(mocks.checkTenant).toHaveBeenCalledWith(
      expect.objectContaining({ tenant: { oid: 10n } }),
      setupSession
    );

    expect(mocks.emailFindMany).toHaveBeenCalledWith({
      take: 25,
      where: { setupSessionOid: 100n, failedAt: null },
      include: {
        setupSession: { select: { id: true } },
        senderActor: true
      }
    });
  });
});
