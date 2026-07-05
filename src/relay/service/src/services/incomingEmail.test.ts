import { beforeEach, describe, expect, test, vi } from 'vitest';

let db = vi.hoisted(() => ({
  inbox: {
    findFirst: vi.fn()
  },
  incomingEmail: {
    findFirst: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn()
  },
  incomingEmailThread: {
    create: vi.fn(),
    findFirst: vi.fn()
  },
  outgoingEmailSend: {
    findFirst: vi.fn()
  },
  emailIdentity: {
    findFirst: vi.fn()
  },
  outgoingEmail: {
    create: vi.fn()
  },
  outgoingEmailContent: {
    createMany: vi.fn()
  },
  outgoingEmailDestination: {
    createMany: vi.fn()
  }
}));

let sendEmailQueue = vi.hoisted(() => ({
  add: vi.fn()
}));

vi.mock('../db', () => ({ db }));
vi.mock('../queue/sendEmail', () => ({ sendEmailQueue }));

import { incomingEmailService } from './incomingEmail';

let sender = {
  oid: 1,
  id: 'sender_1',
  identifier: 'sender',
  name: 'Sender',
  createdAt: new Date()
};

let inbox = {
  oid: 10n,
  id: 'inb_1',
  email: 'inbox@example.com',
  senderOid: 1,
  createdAt: new Date()
};

let thread = {
  oid: 20n,
  id: 'iet_1',
  inboxOid: inbox.oid,
  inbox,
  subject: 'Support',
  createdAt: new Date()
};

let incomingEmail = {
  oid: 30n,
  id: 'ie_1',
  inboxOid: inbox.oid,
  inbox,
  threadOid: thread.oid,
  thread,
  from: 'alice@example.com',
  to: inbox.email,
  subject: 'Re: Support',
  text: 'Fresh reply',
  messageId: 'reply@example.com',
  headers: [],
  createdAt: new Date()
};

let rawEmail = `From: Alice <alice@example.com>
To: Relay <inbox@example.com>
Subject: Re: Support
Message-ID: <reply@example.com>
In-Reply-To: <original@example.com>

Fresh reply`;

describe('incomingEmailService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('rejects messages for unregistered inboxes', async () => {
    db.inbox.findFirst.mockResolvedValue(null);

    await expect(incomingEmailService.receiveEmail({ sender, raw: rawEmail })).rejects.toThrow();
  });

  test('returns existing incoming email for duplicate message ids', async () => {
    db.inbox.findFirst.mockResolvedValue(inbox);
    db.incomingEmail.findFirst.mockResolvedValue(incomingEmail);

    await expect(incomingEmailService.receiveEmail({ sender, raw: rawEmail })).resolves.toBe(
      incomingEmail
    );
    expect(db.incomingEmail.create).not.toHaveBeenCalled();
  });

  test('reuses existing thread from In-Reply-To message id', async () => {
    db.inbox.findFirst.mockResolvedValue(inbox);
    db.incomingEmail.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        ...incomingEmail,
        messageId: 'original@example.com',
        thread
      });
    db.outgoingEmailSend.findFirst.mockResolvedValue(null);
    db.incomingEmail.create.mockImplementation(async ({ data }: any) => ({
      ...incomingEmail,
      ...data,
      inbox,
      thread
    }));

    await incomingEmailService.receiveEmail({ sender, raw: rawEmail });

    expect(db.incomingEmailThread.create).not.toHaveBeenCalled();
    expect(db.incomingEmail.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          threadOid: thread.oid,
          text: 'Fresh reply'
        })
      })
    );
  });

  test('applies string-array filters to incoming email list', async () => {
    db.incomingEmail.findMany.mockResolvedValue([]);

    let paginator = await incomingEmailService.listIncomingEmails({
      sender,
      inboxIds: ['inb_1'],
      threadIds: ['iet_1'],
      ids: ['ie_1'],
      messageIds: ['message@example.com']
    });

    await paginator.run({ limit: 10 });

    expect(db.incomingEmail.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: { in: ['ie_1'] },
          messageId: { in: ['message@example.com'] },
          inbox: expect.objectContaining({
            senderOid: sender.oid,
            id: { in: ['inb_1'] }
          }),
          thread: {
            id: { in: ['iet_1'] }
          }
        })
      })
    );
  });

  test('reply creates an outgoing email linked to the incoming email and thread', async () => {
    db.incomingEmail.findFirst.mockResolvedValue(incomingEmail);
    db.emailIdentity.findFirst.mockResolvedValue({
      oid: 40,
      id: 'eid_1',
      type: 'email',
      slug: 'support@example.com',
      fromName: 'Support',
      fromEmail: 'support@example.com',
      subjectMarker: null,
      senderOid: sender.oid,
      sender,
      createdAt: new Date(),
      updatedAt: new Date()
    });
    db.outgoingEmail.create.mockResolvedValue({ oid: 50n, id: 'oe_1' });
    db.outgoingEmailContent.createMany.mockResolvedValue({});
    db.outgoingEmailDestination.createMany.mockResolvedValue({});

    await incomingEmailService.replyToIncomingEmail({
      sender,
      incomingEmailId: incomingEmail.id,
      emailIdentityId: 'eid_1',
      input: {
        content: {
          html: '<p>Reply</p>',
          text: 'Reply'
        }
      }
    });

    expect(db.outgoingEmail.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          incomingEmailThreadOid: thread.oid,
          replyToIncomingEmailOid: incomingEmail.oid,
          subject: 'Re: Support'
        })
      })
    );
    expect(db.outgoingEmailDestination.createMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: [
          expect.objectContaining({
            destination: incomingEmail.from
          })
        ]
      })
    );
  });
});
