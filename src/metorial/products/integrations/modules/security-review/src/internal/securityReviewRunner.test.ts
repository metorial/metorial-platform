import { beforeEach, describe, expect, it, vi } from 'vitest';

let mocks = vi.hoisted(() => ({
  findReview: vi.fn(),
  findRunning: vi.fn(),
  updateRevisions: vi.fn(),
  allowed: vi.fn(),
  rateLimit: vi.fn(),
  collectEvidence: vi.fn(),
  start: vi.fn(),
  complete: vi.fn()
}));

vi.mock('@metorial-subspace/db', () => ({
  db: {
    securityReview: { findUnique: mocks.findReview },
    securityReviewRevision: {
      findFirst: mocks.findRunning,
      updateMany: mocks.updateRevisions
    }
  }
}));

vi.mock('@metorial-subspace/module-tenant', () => ({}));
vi.mock('@metorial/fabric', () => ({}));
vi.mock('@metorial/review-engine', () => ({}));
vi.mock('../definitions/thoroughness', () => ({}));
vi.mock('../env', () => ({}));
vi.mock('../lib/agentRun', () => ({}));
vi.mock('../lib/assemble', () => ({}));
vi.mock('../lib/findings', () => ({}));
vi.mock('../lib/runLog', () => ({
  RunLog: class {
    add() {}
  }
}));
vi.mock('../lib/playbooks', () => ({}));
vi.mock('../lib/report', () => ({}));
vi.mock('../lib/storage', () => ({}));

vi.mock('../lib/subjects', () => ({
  collectEvidence: mocks.collectEvidence,
  buildEvidenceFiles: () => ({}),
  hashEvidence: () => 'hash_1'
}));

vi.mock('./securityReviewGate', () => ({
  internalSecurityReviewGateService: {
    isReviewGenerationAllowed: mocks.allowed,
    checkGenerationRateLimit: mocks.rateLimit,
    resolveReviewGate: async () => ({ allowAi: false, includeTenantSignals: false })
  }
}));

vi.mock('./securityReviewLease', () => ({}));
vi.mock('./securityReviewMirror', () => ({}));
vi.mock('./securityReviewStore', () => ({}));

vi.mock('./securityReviewSink', () => ({
  internalSecurityReviewSinkService: { start: mocks.start, complete: mocks.complete }
}));

import { internalSecurityReviewRunnerService } from './securityReviewRunner';

beforeEach(() => {
  vi.clearAllMocks();
  mocks.findReview.mockResolvedValue({
    id: 'rev_1',
    oid: 1n,
    scope: 'tenant',
    status: 'active',
    currentRevision: null
  });
  mocks.findRunning.mockResolvedValue(null);
  mocks.allowed.mockResolvedValue(false);
  mocks.rateLimit.mockResolvedValue({ allowed: true });
  mocks.collectEvidence.mockResolvedValue({
    kind: 'skill',
    title: 'Skill',
    limitations: [],
    findings: []
  });
});

describe('security review generation policy', () => {
  it.each([
    { trigger: 'deployment' },
    { trigger: 'admin', deterministicOnly: true },
    { trigger: 'reassess', force: true }
  ])('does not collect evidence or create revisions on Free: %j', async input => {
    await internalSecurityReviewRunnerService.runSecurityReview({
      reviewId: 'rev_1',
      ...input
    } as any);

    expect(mocks.collectEvidence).not.toHaveBeenCalled();
    expect(mocks.findRunning).not.toHaveBeenCalled();
    expect(mocks.updateRevisions).not.toHaveBeenCalled();
    expect(mocks.start).not.toHaveBeenCalled();
    expect(mocks.complete).not.toHaveBeenCalled();
  });

  it('creates no revision when the project review limit is exhausted', async () => {
    mocks.allowed.mockResolvedValue(true);
    mocks.rateLimit.mockResolvedValue({ allowed: false });

    await internalSecurityReviewRunnerService.runSecurityReview({
      reviewId: 'rev_1',
      trigger: 'deployment'
    });

    expect(mocks.collectEvidence).toHaveBeenCalled();
    expect(mocks.start).not.toHaveBeenCalled();
    expect(mocks.complete).not.toHaveBeenCalled();
  });
});
