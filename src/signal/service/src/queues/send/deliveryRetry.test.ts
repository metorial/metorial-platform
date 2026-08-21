import { describe, expect, it, vi } from 'vitest';
import { enqueueDeliveryAttempt, getDeliveryAttemptJobId } from './deliveryRetry';

describe('Signal delivery retry scheduling', () => {
  it('uses a distinct BullMQ job ID for every delivery attempt', async () => {
    let enqueue = vi.fn(async () => {});

    await enqueueDeliveryAttempt({ enqueue, intentId: 'intent-1', attemptNumber: 1 });
    await enqueueDeliveryAttempt({
      enqueue,
      intentId: 'intent-1',
      attemptNumber: 2,
      delayMs: 10_000
    });

    expect(enqueue).toHaveBeenNthCalledWith(
      1,
      { intentId: 'intent-1' },
      { id: 'intent-1:attempt:1' }
    );
    expect(enqueue).toHaveBeenNthCalledWith(
      2,
      { intentId: 'intent-1' },
      { id: 'intent-1:attempt:2', delay: 10_000 }
    );
    expect(getDeliveryAttemptJobId('intent-1', 1)).not.toBe(
      getDeliveryAttemptJobId('intent-1', 2)
    );
  });
});
