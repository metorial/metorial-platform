import { beforeEach, describe, expect, it, vi } from 'vitest';

let mocks = vi.hoisted(() => ({
  add: vi.fn(),
  addMany: vi.fn(),
  run: vi.fn(),
  generation: { SECURITY_REVIEW_AUTO_GENERATION: undefined as string | undefined }
}));

vi.mock('@lowerdeck/queue', () => ({
  createQueue: () => ({
    add: mocks.add,
    addManyWithOps: mocks.addMany,
    process: (handler: unknown) => handler
  })
}));

vi.mock('../env', () => ({ env: { service: { REDIS_URL: 'redis://test' } } }));
vi.mock('../../../security-review-request/src/env', () => ({
  env: { service: { REDIS_URL: 'redis://test' }, generation: mocks.generation }
}));
vi.mock('../internal/securityReviewRunner', () => ({
  internalSecurityReviewRunnerService: { runSecurityReview: mocks.run }
}));

import { enqueueSecurityReview, enqueueSecurityReviews } from './run';

beforeEach(() => {
  vi.clearAllMocks();
  mocks.generation.SECURITY_REVIEW_AUTO_GENERATION = undefined;
});

describe('security review scheduling', () => {
  it.each(['new_version', 'skill_import', 'scheduled', 'page_open'] as const)(
    'queues skill %s runs independently of automatic provider generation',
    async trigger => {
      await enqueueSecurityReview({
        reviewId: 'review_1',
        subject: 'skill',
        trigger,
        immediate: true
      });

      expect(mocks.add).toHaveBeenCalledWith(
        { reviewId: 'review_1', subject: 'skill', trigger },
        { delay: 0, deduplication: { id: 'security-review-now-review_1' } }
      );
    }
  );

  it.each(['page_open', 'reassess', 'admin'] as const)(
    'queues an explicit %s request with speculative generation off',
    async trigger => {
      await enqueueSecurityReview({ reviewId: 'review_1', trigger, immediate: true });

      expect(mocks.add).toHaveBeenCalledWith(
        { reviewId: 'review_1', trigger },
        { delay: 0, deduplication: { id: 'security-review-now-review_1' } }
      );
    }
  );

  it.each([
    'deployment',
    'first_use',
    'new_version',
    'tools_discovered',
    'census_changed',
    'scheduled'
  ] as const)('keeps an automatic %s request disabled even when immediate', async trigger => {
    await enqueueSecurityReview({ reviewId: 'review_1', trigger, immediate: true });

    expect(mocks.add).not.toHaveBeenCalled();
  });

  it('queues automatic work with its debounce when enabled', async () => {
    mocks.generation.SECURITY_REVIEW_AUTO_GENERATION = 'true';

    await enqueueSecurityReview({ reviewId: 'review_1', trigger: 'deployment' });

    expect(mocks.add).toHaveBeenCalledWith(
      { reviewId: 'review_1', trigger: 'deployment' },
      { delay: 600_000, deduplication: { id: 'security-review-review_1' } }
    );
  });

  it('applies the same policy to batched requests', async () => {
    await enqueueSecurityReviews([
      { reviewId: 'review_1', trigger: 'page_open' },
      { reviewId: 'review_2', trigger: 'deployment' },
      { reviewId: 'review_3', trigger: 'reassess' }
    ]);

    expect(mocks.addMany).toHaveBeenCalledWith([
      expect.objectContaining({ data: { reviewId: 'review_1', trigger: 'page_open' } }),
      expect.objectContaining({ data: { reviewId: 'review_3', trigger: 'reassess' } })
    ]);
  });

  it('allows skill version changes in batches while speculative provider work is off', async () => {
    await enqueueSecurityReviews([
      { reviewId: 'skill_review', subject: 'skill', trigger: 'new_version' },
      { reviewId: 'provider_review', trigger: 'new_version' }
    ]);

    expect(mocks.addMany).toHaveBeenCalledWith([
      expect.objectContaining({
        data: { reviewId: 'skill_review', subject: 'skill', trigger: 'new_version' }
      })
    ]);
  });
});
