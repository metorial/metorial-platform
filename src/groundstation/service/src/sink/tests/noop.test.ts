import { describe, expect, it } from 'vitest';
import { createNoopSink } from '../noop';

describe('createNoopSink', () => {
  it('accepts and discards batches', async () => {
    let sink = createNoopSink();

    await expect(
      sink.write({ lane: 'live', tenantId: 't', records: [] })
    ).resolves.toBeUndefined();
  });

  it('has no close hook to leak', () => {
    expect(createNoopSink().close).toBeUndefined();
  });
});
