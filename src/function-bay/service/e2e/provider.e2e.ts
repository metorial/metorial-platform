import { describe, expect, it } from 'vitest';
import { env } from '../src/env';
import { functionBay } from './client';

let expectedNames = { 'aws.lambda': 'AWS Lambda', local: 'Local Runtime' } as const;

describe('function-bay provider', () => {
  it('returns the default provider', async () => {
    let result = await functionBay.provider.getDefault({});

    expect(result).toMatchObject({
      id: expect.any(String),
      identifier: env.provider.DEFAULT_PROVIDER,
      name: expectedNames[env.provider.DEFAULT_PROVIDER],
      createdAt: expect.any(Date)
    });
  });
});
