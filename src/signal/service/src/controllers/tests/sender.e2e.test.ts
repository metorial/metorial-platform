import { beforeEach, describe, expect, it } from 'vitest';
import { cleanDatabase } from '../../test/setup';
import { signalClient } from '../../test/client';

describe('sender.e2e', () => {
  beforeEach(async () => {
    await cleanDatabase();
  });

  it('upserts and fetches a sender', async () => {
    const created = await signalClient.sender.upsert({
      identifier: 'test-sender',
      name: 'Test Sender'
    });

    const fetched = await signalClient.sender.get({ senderId: created.id });
    expect(fetched).toMatchObject({
      id: created.id,
      identifier: 'test-sender',
      name: 'Test Sender'
    });

    const updated = await signalClient.sender.upsert({
      identifier: 'test-sender',
      name: 'Updated Sender'
    });
    expect(updated.id).toBe(created.id);

    const fetchedUpdated = await signalClient.sender.get({ senderId: 'test-sender' });
    expect(fetchedUpdated.name).toBe('Updated Sender');
  });
});
