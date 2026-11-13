import { describe, expect, it } from 'vitest';
import { createNoopSink } from '../noop';
import { defaultStoragePolicy } from '../types';

describe('createNoopSink', () => {
  it('accepts and discards batches', async () => {
    let sink = createNoopSink();

    await expect(
      sink.write({
        lane: 'live',
        organizationId: 'gor_1',
        projectId: 'gpr_1',
        instanceId: 'gin_1',
        storage: defaultStoragePolicy,
        records: []
      })
    ).resolves.toBeUndefined();
  });

  it('has no close hook to leak', () => {
    expect(createNoopSink().close).toBeUndefined();
  });
});
