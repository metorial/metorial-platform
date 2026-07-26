import { beforeEach, describe, expect, test, vi } from 'vitest';

let db = vi.hoisted(() => ({
  inbox: {
    upsert: vi.fn()
  }
}));

vi.mock('../db', () => ({ db }));

import { inboxService } from './inbox';

let sender = {
  oid: 1,
  id: 'sender_1',
  identifier: 'sender',
  name: 'Sender',
  createdAt: new Date()
};

describe('inboxService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('idempotently provisions a normalized inbox for its sender', async () => {
    let inbox = {
      oid: 1n,
      id: 'inb_1',
      email: 'support@example.com',
      senderOid: sender.oid,
      createdAt: new Date()
    };
    db.inbox.upsert.mockResolvedValue(inbox);

    await expect(
      inboxService.createInbox({
        sender,
        input: { email: ' Support@Example.com ' }
      })
    ).resolves.toBe(inbox);
    expect(db.inbox.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { email: 'support@example.com' },
        update: {}
      })
    );
  });

  test('does not return an inbox owned by another sender', async () => {
    db.inbox.upsert.mockResolvedValue({
      oid: 1n,
      id: 'inb_1',
      email: 'support@example.com',
      senderOid: 2,
      createdAt: new Date()
    });

    await expect(
      inboxService.createInbox({
        sender,
        input: { email: 'support@example.com' }
      })
    ).rejects.toThrow();
  });

  test('rejects header-injection and malformed inbox addresses', async () => {
    await expect(
      inboxService.createInbox({
        sender,
        input: { email: 'support@example.com\r\nBcc: attacker@example.com' }
      })
    ).rejects.toThrow();
    await expect(
      inboxService.createInbox({
        sender,
        input: { email: 'not-an-email' }
      })
    ).rejects.toThrow();
    expect(db.inbox.upsert).not.toHaveBeenCalled();
  });
});
