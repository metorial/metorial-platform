import { expect, it, vi } from 'vitest';

let mocks = vi.hoisted(() => ({ transaction: vi.fn(), create: vi.fn() }));
vi.mock('../db', () => ({
  db: { $transaction: mocks.transaction, slateWebhookEvent: { create: mocks.create } }
}));
vi.mock('../id', () => ({ getId: () => ({ oid: 1n, id: 'webhook-event' }) }));
vi.mock('@lowerdeck/service', () => ({
  Service: { create: (_name: string, factory: () => unknown) => ({ build: factory }) }
}));

it('stores an inbound webhook with one insert and no registration lock', async () => {
  let request = { method: 'POST', url: 'https://example.invalid', headers: {}, body: null };
  mocks.create.mockResolvedValue({ id: 'webhook-event' });
  let { slateWebhookEventServiceInternal } =
    await import('./slateWebhookEventServiceInternal');

  await expect(
    slateWebhookEventServiceInternal.createPendingEvent({ registration: { oid: 2n }, request })
  ).resolves.toEqual({ id: 'webhook-event' });

  expect(mocks.create).toHaveBeenCalledTimes(1);
  expect(mocks.create.mock.calls[0]![0].data).toEqual({
    oid: 1n,
    id: 'webhook-event',
    status: 'pending',
    attemptCount: 0,
    webhookRegistrationOid: 2n,
    request
  });
  expect(mocks.transaction).not.toHaveBeenCalled();
});
