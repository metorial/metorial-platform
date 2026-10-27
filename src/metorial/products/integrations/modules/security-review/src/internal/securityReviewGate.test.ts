import { beforeEach, describe, expect, it, vi } from 'vitest';

let mocks = vi.hoisted(() => ({
  tenant: vi.fn(),
  project: vi.fn(),
  coreProject: vi.fn(),
  allowed: vi.fn(),
  consume: vi.fn(),
  check: vi.fn()
}));

vi.mock('@metorial-subspace/db', () => ({
  db: {
    tenant: { findUniqueOrThrow: mocks.tenant },
    project: { findUniqueOrThrow: mocks.project }
  }
}));

vi.mock('@metorial-subspace/module-tenant', () => ({
  metorialDb: { project: { findUniqueOrThrow: mocks.coreProject } }
}));

vi.mock('@metorial/module-flags', () => ({
  flagService: { isFlagEnabledForScope: mocks.allowed }
}));

vi.mock('@metorial/module-rate-limit', () => ({
  rateLimitService: { tryConsume: mocks.consume, check: mocks.check },
  rateLimitExceededError: () => new Error('rate limit exceeded')
}));

vi.mock('@metorial/multi-region', () => ({ securityReviewGlobalRepository: {} }));

vi.mock('../definitions/thoroughness', () => ({
  isAiReviewAvailable: () => true,
  parseThoroughness: () => 'standard'
}));

import { internalSecurityReviewGateService as gate } from './securityReviewGate';

let review = { scope: 'tenant', tenantOid: 1n } as any;
let project = { id: 'prj_1', oid: 300n, organization: { id: 'org_1', oid: 400n } };

beforeEach(() => {
  vi.clearAllMocks();
  mocks.tenant.mockResolvedValue({ oid: 1n, projectOid: 2n });
  mocks.project.mockResolvedValue({ oid: 2n, id: 'prj_1' });
  mocks.coreProject.mockResolvedValue(project);
  mocks.allowed.mockResolvedValue(true);
  mocks.consume.mockResolvedValue({ allowed: true });
  mocks.check.mockResolvedValue({ allowed: true });
});

describe('security review generation access', () => {
  it('denies all tenant review generation on Free, including deterministic reviews', async () => {
    mocks.allowed.mockResolvedValue(false);

    expect(await gate.isReviewGenerationAllowed({ review })).toBe(false);
    await expect(gate.assertGenerationAllowed({ review })).rejects.toMatchObject({
      data: { status: 402 }
    });
    expect(mocks.check).not.toHaveBeenCalled();
    expect(mocks.consume).not.toHaveBeenCalled();
  });

  it('allows Metorial-maintained global reviews without charging a tenant allowance', async () => {
    let globalReview = { scope: 'global' } as any;

    expect(await gate.isReviewGenerationAllowed({ review: globalReview })).toBe(true);
    expect(
      await gate.checkGenerationRateLimit({ review: globalReview, consume: true })
    ).toEqual({ allowed: true });
    expect(mocks.tenant).not.toHaveBeenCalled();
    expect(mocks.consume).not.toHaveBeenCalled();
  });

  it('checks customer-triggered generation against the viewer entitlement', async () => {
    mocks.allowed.mockResolvedValue(false);

    expect(await gate.isTenantReviewGenerationAllowed({ tenantOid: 1n })).toBe(false);
    expect(mocks.allowed).toHaveBeenCalledWith({
      project,
      organization: project.organization,
      flag: 'paid-ai-reviews'
    });
  });

  it('consumes the review limit in the core project scope', async () => {
    await gate.checkGenerationRateLimit({ review, consume: true });

    expect(mocks.coreProject).toHaveBeenCalledWith({
      where: { id: 'prj_1' },
      include: { organization: true }
    });
    expect(mocks.consume).toHaveBeenCalledWith({
      project,
      organization: project.organization,
      usages: [{ key: 'protoguard.reviews' }]
    });
  });

  it('rejects manual review requests when the rate limit is reached', async () => {
    mocks.check.mockResolvedValue({ allowed: false });

    await expect(gate.assertGenerationAllowed({ review })).rejects.toThrow(
      'rate limit exceeded'
    );
    expect(mocks.consume).not.toHaveBeenCalled();
  });
});
