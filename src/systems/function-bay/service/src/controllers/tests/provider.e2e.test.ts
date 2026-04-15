import { beforeEach, describe, expect, it } from 'vitest';
import { functionBayClient } from '../../test/client';
import { cleanDatabase } from '../../test/setup';

describe('provider:getDefault E2E', () => {
  beforeEach(async () => {
    await cleanDatabase();
  });

  it('returns the default provider', async () => {
    // Provider is auto-seeded at module load time in aws-lambda/provider.ts
    const result = await functionBayClient.provider.getDefault({});

    expect(result).toMatchObject({
      id: expect.any(String),
      identifier: 'aws.lambda',
      name: 'AWS Lambda',
      createdAt: expect.any(Date)
    });
  });
});
