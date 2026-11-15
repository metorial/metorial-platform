import { describe, expect, it } from 'vitest';
import { createNoopSink } from '../src/lib/noop';
import { defaultStoragePolicy } from '@mtsrc/agent-tracking-store';

describe('createNoopSink', () => {
  it('accepts and discards batches', async () => {
    let sink = createNoopSink();

    await expect(
      sink.write({
        lane: 'live',
        organizationId: 'ator_1',
        projectId: 'atpr_1',
        instanceId: 'atin_1',
        storage: defaultStoragePolicy,
        records: []
      })
    ).resolves.toBeUndefined();
  });

  it('has no close hook to leak', () => {
    expect(createNoopSink().close).toBeUndefined();
  });
});
