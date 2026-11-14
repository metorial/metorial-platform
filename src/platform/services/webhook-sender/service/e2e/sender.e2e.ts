import { uniqueId } from '@lowerdeck/testing-tools';
import { describe, expect, it } from 'vitest';
import { signal } from './client';

describe('signal sender', () => {
  it('upserts and fetches a sender', async () => {
    let identifier = uniqueId('sender');

    let created = await signal.sender.upsert({ identifier, name: 'Test Sender' });

    let fetched = await signal.sender.get({ senderId: created.id });
    expect(fetched).toMatchObject({ id: created.id, identifier, name: 'Test Sender' });

    let updated = await signal.sender.upsert({ identifier, name: 'Updated Sender' });
    expect(updated.id).toBe(created.id);

    let fetchedByIdentifier = await signal.sender.get({ senderId: identifier });
    expect(fetchedByIdentifier.name).toBe('Updated Sender');
  });
});
