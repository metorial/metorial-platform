import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

let db = vi.hoisted(() => ({
  $transaction: vi.fn(
    async (callback: (transaction: any) => Promise<any>) => await callback(db)
  ),
  outgoingEmail: {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn()
  },
  outgoingEmailContent: {
    create: vi.fn()
  },
  outgoingEmailDestination: {
    createMany: vi.fn()
  },
  outgoingEmailAttachment: {
    createMany: vi.fn()
  },
  emailIdentity: {
    findFirst: vi.fn()
  }
}));

let sendEmailQueue = vi.hoisted(() => ({
  add: vi.fn()
}));

vi.mock('../db', () => ({ db }));
vi.mock('../queue/sendEmail', () => ({ sendEmailQueue }));

import { emailService } from './email';

let identity = {
  oid: 40,
  id: 'eid_1',
  type: 'email' as const,
  slug: 'support@example.com',
  fromName: 'Support',
  fromEmail: 'support@example.com',
  subjectMarker: null,
  senderOid: 1,
  createdAt: new Date(),
  updatedAt: new Date()
};

describe('emailService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test('returns an existing email for a repeated idempotency key', async () => {
    let existing = { oid: 50n, id: 'oe_existing' };
    db.outgoingEmail.findUnique.mockResolvedValue(existing);

    let result = await emailService.sendEmail({
      type: 'email',
      identity,
      to: ['alice@example.com'],
      template: {},
      idempotencyKey: 'welcome-alice',
      content: {
        subject: 'Welcome',
        html: '<p>Welcome</p>',
        text: 'Welcome'
      }
    });

    expect(result).toBe(existing);
    expect(db.$transaction).not.toHaveBeenCalled();
    expect(sendEmailQueue.add).toHaveBeenCalledWith(
      { emailId: existing.id },
      { id: `relay-send-${existing.id}` }
    );
  });

  test('persists immutable delivery options and attachment bytes', async () => {
    db.outgoingEmail.findUnique.mockResolvedValue(null);
    db.outgoingEmail.create.mockResolvedValue({ oid: 50n, id: 'oe_1' });
    db.outgoingEmailContent.create.mockResolvedValue({});
    db.outgoingEmailDestination.createMany.mockResolvedValue({});
    db.outgoingEmailAttachment.createMany.mockResolvedValue({});

    await emailService.sendEmail({
      type: 'email',
      identity,
      to: ['alice@example.com'],
      template: {},
      fromName: 'Customer Success',
      replyTo: 'reply@example.com',
      idempotencyKey: 'welcome-alice',
      attachments: [
        {
          filename: 'hello.txt',
          contentType: 'text/plain',
          content: Buffer.from('hello').toString('base64')
        }
      ],
      content: {
        subject: 'Welcome',
        html: '<p>Welcome</p>',
        text: 'Welcome'
      }
    });

    expect(db.outgoingEmail.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          fromName: 'Customer Success',
          replyTo: 'reply@example.com',
          idempotencyKey: 'welcome-alice'
        })
      })
    );
    expect(db.outgoingEmailAttachment.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          filename: 'hello.txt',
          contentType: 'text/plain',
          size: 5,
          content: Uint8Array.from(Buffer.from('hello'))
        })
      ]
    });
  });

  test('rejects multiple-address injection and unsafe attachment metadata', async () => {
    let input = {
      type: 'email' as const,
      identity,
      to: ['alice@example.com, attacker@example.com'],
      template: {},
      content: {
        subject: 'Welcome',
        html: '<p>Welcome</p>',
        text: 'Welcome'
      }
    };

    await expect(emailService.sendEmail(input)).rejects.toThrow();
    await expect(
      emailService.sendEmail({
        ...input,
        to: ['alice@example.com'],
        attachments: [
          {
            filename: 'hello.txt\r\nBcc: attacker@example.com',
            contentType: 'text/plain',
            content: Buffer.from('hello').toString('base64')
          }
        ]
      })
    ).rejects.toThrow();
    expect(db.outgoingEmail.create).not.toHaveBeenCalled();
  });
});
