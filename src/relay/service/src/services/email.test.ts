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
let email = { oid: 123n, id: 'oe_1', queuedAt: null, numberOfDestinations: 1 };

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
  it('drops ignored recipients and only sends to the rest', async () => {
    await emailService.sendEmail({
      ...input,
      to: ['customer@example.com', 'sa-abc@900.service-accounts.metorial.net']
    });

    let data = mocks.create.mock.calls[0]![0].data;
    expect(data.numberOfDestinations).toBe(1);
    expect(data.destinations.create).toEqual([
      expect.objectContaining({ destination: 'customer@example.com', status: 'pending' })
    ]);
    expect(mocks.enqueue).toHaveBeenCalledTimes(1);
  });

  it('records but never queues an email whose recipients are all ignored', async () => {
    mocks.create.mockResolvedValue({ ...email, numberOfDestinations: 0 });

    await expect(
      emailService.sendEmail({
        ...input,
        to: ['sa-abc@900.service-accounts.metorial.net', 'deleted_1@deleted.local']
      })
    ).resolves.toMatchObject({ id: email.id });

    let data = mocks.create.mock.calls[0]![0].data;
    expect(data.numberOfDestinations).toBe(0);
    expect(data.destinations.create).toHaveLength(0);
    expect(mocks.enqueue).not.toHaveBeenCalled();
    expect(mocks.update).not.toHaveBeenCalled();
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
