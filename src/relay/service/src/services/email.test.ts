import { beforeEach, describe, expect, it, vi } from 'vitest';

let mocks = vi.hoisted(() => ({
  create: vi.fn(),
  find: vi.fn(),
  update: vi.fn(),
  enqueue: vi.fn()
}));
vi.mock('../db', () => ({
  db: { outgoingEmail: { create: mocks.create, findUnique: mocks.find, update: mocks.update } }
}));
vi.mock('../queue/sendEmail', () => ({ sendEmailQueue: { add: mocks.enqueue } }));
import { emailService } from './email';

let input = {
  type: 'email' as const,
  to: ['customer@example.com'],
  template: { documents: ['Security Report'] },
  content: { subject: 'Approved', html: '<p>Approved</p>', text: 'Approved' },
  identity: { oid: 1 } as any
};
let email = { oid: 123n, id: 'oe_1', queuedAt: null };

describe('Relay idempotent admission', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.create.mockResolvedValue(email);
    mocks.enqueue.mockResolvedValue(undefined);
    mocks.update.mockResolvedValue(email);
  });
  it('creates content and destinations atomically and queues a durable email', async () => {
    await expect(
      emailService.sendEmail({ ...input, idempotencyKey: 'trust/batch' })
    ).resolves.toEqual(email);
    let data = mocks.create.mock.calls[0]![0].data;
    expect(data).toMatchObject({
      idempotencyKey: 'trust/batch',
      identityId: 1,
      content: { create: input.content }
    });
    expect(data.destinations.create).toHaveLength(1);
    expect(data.destinations.create[0]).toMatchObject({
      destination: input.to[0],
      status: 'pending'
    });
    expect(mocks.enqueue).toHaveBeenCalledWith({ emailId: email.id }, { id: email.id });
    expect(mocks.update).toHaveBeenCalledWith({
      where: { oid: email.oid },
      data: { queuedAt: expect.any(Date) }
    });
  });
  it('returns the existing identity-scoped email after a concurrent duplicate', async () => {
    mocks.create.mockRejectedValue({ code: 'P2002' });
    mocks.find.mockResolvedValue({ ...email, queuedAt: new Date() });
    await expect(
      emailService.sendEmail({ ...input, idempotencyKey: 'trust/batch' })
    ).resolves.toMatchObject({ id: email.id });
    expect(mocks.find).toHaveBeenCalledWith({
      where: { identityId_idempotencyKey: { identityId: 1, idempotencyKey: 'trust/batch' } }
    });
    expect(mocks.enqueue).not.toHaveBeenCalled();
  });
  it('retries enqueueing an admitted email whose first enqueue failed', async () => {
    mocks.enqueue.mockRejectedValueOnce(new Error('Redis unavailable'));
    await expect(
      emailService.sendEmail({ ...input, idempotencyKey: 'trust/batch' })
    ).rejects.toThrow('Redis unavailable');
    expect(mocks.update).not.toHaveBeenCalled();
    mocks.create.mockRejectedValue({ code: 'P2002' });
    mocks.find.mockResolvedValue(email);
    await expect(
      emailService.sendEmail({ ...input, idempotencyKey: 'trust/batch' })
    ).resolves.toMatchObject({ id: email.id });
    expect(mocks.enqueue).toHaveBeenCalledTimes(2);
  });
  it('keeps legacy sends independent and does not mask unrelated errors', async () => {
    await emailService.sendEmail(input);
    expect(mocks.create.mock.calls[0]![0].data.idempotencyKey).toBeUndefined();
    mocks.create.mockRejectedValue({ code: 'P2002' });
    await expect(emailService.sendEmail(input)).rejects.toEqual({ code: 'P2002' });
    mocks.create.mockRejectedValue(new Error('Database unavailable'));
    await expect(
      emailService.sendEmail({ ...input, idempotencyKey: 'trust/batch' })
    ).rejects.toThrow('Database unavailable');
    expect(mocks.find).not.toHaveBeenCalled();
  });
});
