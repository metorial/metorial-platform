import { beforeEach, describe, expect, it, vi } from 'vitest';

let mocks = vi.hoisted(() => ({
  providerVersion: vi.fn(),
  customVersion: vi.fn(),
  review: vi.fn(),
  current: vi.fn(),
  inProgress: vi.fn(),
  ensureSlate: vi.fn(),
  ensureCustom: vi.fn(),
  allowed: vi.fn(),
  add: vi.fn()
}));

vi.mock('@metorial-subspace/db', () => ({
  db: {
    providerVersion: { findUnique: mocks.providerVersion },
    customProviderVersion: { findFirst: mocks.customVersion },
    securityReview: { findUniqueOrThrow: mocks.review },
    securityReviewRevision: { findUnique: mocks.current, findFirst: mocks.inProgress }
  }
}));
vi.mock('@metorial-subspace/module-tenant', () => ({
  resolveMetorialFacing: async () => ({ tenant: { oid: 1n } })
}));
vi.mock('../internal/securityReviewSubject', () => ({
  internalSecurityReviewSubjectService: {
    ensureSlateReview: mocks.ensureSlate,
    ensureCustomProviderReview: mocks.ensureCustom
  }
}));
vi.mock('../internal/securityReviewGate', () => ({
  internalSecurityReviewGateService: {
    isTenantReviewGenerationAllowed: mocks.allowed,
    isUsageReviewEnabled: async () => false
  }
}));
vi.mock('@metorial/fabric', () => ({}));
vi.mock('../internal/skillDistribution', () => ({}));
vi.mock('../lib/usage/base', () => ({}));
vi.mock('../lib/usage/presence', () => ({}));
vi.mock('@lowerdeck/queue', () => ({
  createQueue: () => ({ add: mocks.add, process: (handler: unknown) => handler })
}));
vi.mock('../env', () => ({ env: { service: { REDIS_URL: 'redis://test' } } }));
vi.mock('../../../security-review-request/src/env', () => ({
  env: {
    service: { REDIS_URL: 'redis://test' },
    generation: { SECURITY_REVIEW_AUTO_GENERATION: 'false' }
  }
}));
vi.mock('../internal/securityReviewRunner', () => ({
  internalSecurityReviewRunnerService: {}
}));

import { securityReviewService } from './securityReview';

let globalReview = { id: 'review_1', oid: 6n, scope: 'global', status: 'active' };

let openReport = () =>
  securityReviewService.getSecurityReviewForProvider({
    provider: { oid: 2n, id: 'provider_1', defaultVariant: { currentVersionOid: 3n } },
    instance: { id: 'instance_1' }
  } as any);

beforeEach(() => {
  vi.clearAllMocks();
  mocks.providerVersion.mockResolvedValue({ oid: 3n, slateVersionOid: 4n });
  mocks.customVersion.mockResolvedValue({ oid: 5n });
  mocks.ensureSlate.mockResolvedValue(globalReview);

  mocks.ensureCustom.mockResolvedValue({
    ...globalReview,
    scope: 'tenant',
    tenantOid: 1n
  });
  mocks.review.mockResolvedValue(globalReview);
  mocks.current.mockResolvedValue(null);
  mocks.inProgress.mockResolvedValue(null);

  mocks.allowed.mockResolvedValue(true);
});

describe('opening a provider security report with automatic generation off', () => {
  it.each(['global', 'tenant'] as const)(
    'starts a missing %s report for an entitled viewer',
    async scope => {
      if (scope == 'tenant') {
        mocks.providerVersion.mockResolvedValue({ oid: 3n, slateVersionOid: null });
        mocks.review.mockResolvedValue({ ...globalReview, scope: 'tenant', tenantOid: 1n });
      }

      await openReport();

      expect(mocks.allowed).toHaveBeenCalledWith({ tenantOid: 1n });
      expect(scope == 'tenant' ? mocks.ensureCustom : mocks.ensureSlate).toHaveBeenCalledTimes(
        1
      );
      expect(mocks.add).toHaveBeenCalledWith(
        { reviewId: 'review_1', trigger: 'page_open' },
        { delay: 0, deduplication: { id: 'security-review-now-review_1' } }
      );
    }
  );

  it('does not start a report for a viewer without the entitlement', async () => {
    mocks.allowed.mockResolvedValue(false);

    await openReport();

    expect(mocks.add).not.toHaveBeenCalled();
  });

  it('does not regenerate an existing report', async () => {
    mocks.review.mockResolvedValue({ ...globalReview, currentRevisionOid: 7n });
    mocks.current.mockResolvedValue({ id: 'revision_1', status: 'completed' });

    let result = await openReport();

    expect(result.current?.id).toBe('revision_1');
    expect(mocks.add).not.toHaveBeenCalled();
  });

  it.each(['queued', 'running'] as const)('does not duplicate a %s report', async status => {
    mocks.inProgress.mockResolvedValue({ status });

    await openReport();

    expect(mocks.add).not.toHaveBeenCalled();
  });

  it('does not start a disabled review', async () => {
    mocks.ensureSlate.mockResolvedValue({ ...globalReview, status: 'disabled' });
    mocks.review.mockResolvedValue({ ...globalReview, status: 'disabled' });

    await openReport();

    expect(mocks.add).not.toHaveBeenCalled();
  });

  it.each([false, true])(
    'retries a failed report only after the retry window (expired: %s)',
    async expired => {
      mocks.inProgress.mockResolvedValue({
        status: 'failed',
        completedAt: new Date(Date.now() - (expired ? 2 * 60 * 60 * 1000 : 0))
      });

      await openReport();

      expect(mocks.add).toHaveBeenCalledTimes(expired ? 1 : 0);
    }
  );
});
