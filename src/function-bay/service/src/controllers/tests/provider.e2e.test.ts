import { beforeEach, describe, expect, it } from 'vitest';
import { functionBayClient } from '../../test/client';
import { cleanDatabase } from '../../test/setup';
import { env } from '../../env';

let expectedProviders = {
  'aws.lambda': 'AWS Lambda',
  local: 'Local Runtime'
} as const;

describe('provider:getDefault E2E', () => {
  beforeEach(async () => {
    await cleanDatabase();
  });

  it('returns the default provider', async () => {
    const result = await functionBayClient.provider.getDefault({});

    expect(result).toMatchObject({
      id: expect.any(String),
      identifier: env.provider.DEFAULT_PROVIDER,
      name: expectedProviders[env.provider.DEFAULT_PROVIDER],
      createdAt: expect.any(Date)
    });
  });
});
