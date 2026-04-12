import { beforeEach, describe, expect, it, vi } from 'vitest';
import { forgeClient } from '../../test/client';
import { cleanDatabase } from '../../test/setup';

vi.mock('../../providers/aws-codebuild', () => ({
  startAwsCodeBuildQueue: { add: vi.fn().mockResolvedValue({ id: 'test-job' }) }
}));

vi.mock('../../storage', () => ({
  storage: {
    putObject: vi.fn().mockResolvedValue({ storageKey: 'test-key' }),
    getObject: vi.fn().mockResolvedValue({ data: Buffer.from('') }),
    getPublicURL: vi.fn().mockResolvedValue({ url: 'http://example.com/artifact' }),
    upsertBucket: vi.fn().mockResolvedValue(undefined)
  }
}));

describe('provider:getDefault E2E', () => {
  beforeEach(async () => {
    await cleanDatabase();
  });

  it('returns the default provider', async () => {
    const result = await forgeClient.provider.getDefault({});

    expect(result).toMatchObject({
      id: expect.any(String),
      identifier: expect.any(String),
      name: 'aws.code-build',
      createdAt: expect.any(Date)
    });
  });
});
