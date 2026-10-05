import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';

let mocks = vi.hoisted(() => {
  let url = process.env.PADD_RELAY_TEST_DATABASE_URL;
  if (url) {
    let parsed = new URL(url);
    if (
      !['localhost', '127.0.0.1'].includes(parsed.hostname) ||
      !parsed.pathname.startsWith('/padd_relay_test')
    )
      throw new Error('Relay tests require an isolated local padd_relay_test database');
    process.env.DATABASE_URL = url;
  }
  return { enqueue: vi.fn() };
});
vi.mock('../queue/sendEmail', () => ({ sendEmailQueue: { add: mocks.enqueue } }));
import { db } from '../db';
import { emailService } from './email';

let input = {
  type: 'email' as const,
  to: ['customer@example.com'],
  template: {},
  content: { subject: 'Approved', html: '<p>Approved</p>', text: 'Approved' }
};

describe.skipIf(!process.env.PADD_RELAY_TEST_DATABASE_URL)('Relay database admission', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    mocks.enqueue.mockResolvedValue(undefined);
    await db.outgoingEmail.deleteMany();
    await db.emailIdentity.deleteMany();
    await db.sender.deleteMany();
  });
  afterAll(async () => {
    await db.$disconnect();
  });
  let identity = async (id: number) => {
    await db.sender.create({
      data: { oid: id, id: `sender_${id}`, identifier: `sender_${id}`, name: 'Test Sender' }
    });
    return db.emailIdentity.create({
      data: {
        oid: id,
        id: `identity_${id}`,
        type: 'email',
        slug: 'test',
        fromName: 'Metorial',
        fromEmail: 'test@example.com',
        senderOid: id
      }
    });
  };
  it('admits simultaneous sends exactly once and scopes keys to the identity', async () => {
    let first = await identity(1);
    let results = await Promise.all(
      Array.from({ length: 5 }, () =>
        emailService.sendEmail({ ...input, identity: first, idempotencyKey: 'same-batch' })
      )
    );
    expect(new Set(results.map(email => email.id)).size).toBe(1);
    expect(await db.outgoingEmail.count()).toBe(1);
    expect(await db.outgoingEmailContent.count()).toBe(1);
    expect(await db.outgoingEmailDestination.count()).toBe(1);
    let second = await identity(2);
    await emailService.sendEmail({ ...input, identity: second, idempotencyKey: 'same-batch' });
    expect(await db.outgoingEmail.count()).toBe(2);
    await emailService.sendEmail({ ...input, identity: first });
    await emailService.sendEmail({ ...input, identity: first });
    expect(await db.outgoingEmail.count()).toBe(4);
  });
  it('rolls back the whole nested create when destination insertion fails', async () => {
    let first = await identity(1);
    await expect(
      emailService.sendEmail({
        ...input,
        identity: first,
        to: [null] as any,
        idempotencyKey: 'invalid'
      })
    ).rejects.toThrow();
    expect(await db.outgoingEmail.count()).toBe(0);
    expect(await db.outgoingEmailContent.count()).toBe(0);
    expect(mocks.enqueue).not.toHaveBeenCalled();
  });
});
