import { beforeEach, describe, expect, it } from 'vitest';
import { cleanDatabase } from '../../test/setup';
import { relayClient } from '../../test/client';

describe('relay sender.e2e', () => {
  beforeEach(async () => {
    await cleanDatabase();
  });

  it('upserts and fetches a sender', async () => {
    let created = await relayClient.sender.upsert({
      identifier: 'metorial',
      name: 'Metorial'
    });

    expect(created).toMatchObject({
      id: expect.any(String),
      identifier: 'metorial',
      name: 'Metorial'
    });

    let fetched = await relayClient.sender.get({ senderId: created.id });
    expect(fetched.name).toBe('Metorial');
  });
});
