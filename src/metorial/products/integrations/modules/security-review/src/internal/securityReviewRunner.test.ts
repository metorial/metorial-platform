import { beforeEach, describe, expect, it, vi } from 'vitest';

let mocks = vi.hoisted(() => ({
  findReview: vi.fn(),
  findRunning: vi.fn(),
  updateRevisions: vi.fn(),
  allowed: vi.fn(),
  rateLimit: vi.fn(),
  collectEvidence: vi.fn(),
  start: vi.fn(),
  complete: vi.fn(),
  judge: vi.fn(),
  agent: vi.fn(),
  progress: vi.fn(),
  createRun: vi.fn(),
  updateRun: vi.fn()
}));

vi.mock('@metorial-subspace/db', () => ({
  db: {
    securityReview: { findUnique: mocks.findReview },
    securityReviewRevision: {
      findFirst: mocks.findRunning,
      findMany: async () => [],
      updateMany: mocks.updateRevisions
    }
  }
}));

vi.mock('@metorial-subspace/module-tenant', () => ({}));
vi.mock('@metorial-subspace/module-protoguard', () => ({
  containsTokenForReview: () => false
}));
vi.mock('../services/securityReviewWebAccess', () => ({ securityReviewWebAccessService: {} }));
vi.mock('@metorial/fabric', () => ({}));
vi.mock('@metorial/review-engine', () => ({
  runConsistencyJudge: mocks.judge,
  runReviewAgent: mocks.agent,
  emptyUsage: () => ({ inputTokens: 0, outputTokens: 0, cachedInputTokens: 0, costMicros: 0 }),
  createRunState: () => ({ submitted: true, lastErrors: [] }),
  createReviewWorkspace: async () => ({ serializeWorkspace: async () => ({}) }),
  createReviewTools: () => ({}),
  ReportDraft: class {
    current = {};
  }
}));
vi.mock('../definitions/thoroughness', () => ({
  reviewModelAccess: undefined,
  getThoroughnessTier: () => ({
    model: { slug: 'judge' },
    maxCostMicros: 100_000,
    maxSteps: 10,
    maxFixRounds: 1
  }),
  getJudgeModel: () => ({ slug: 'judge' })
}));
vi.mock('../env', () => ({}));
vi.mock('../lib/assemble', () => ({ assembleReport: () => ({ scores: {}, report: {} }) }));
vi.mock('../lib/findings', () => ({}));
vi.mock('../lib/playbooks', () => ({
  buildSystemPrompt: () => 'system',
  buildUserPrompt: () => 'prompt'
}));
vi.mock('../lib/report', () => ({ createSecurityReportDefinition: () => ({}) }));
vi.mock('../lib/storage', () => ({
  workspaceKeyFor: () => 'workspace',
  workspaceStore: { load: async () => null, save: async () => {} }
}));

vi.mock('../lib/subjects', () => ({
  collectEvidence: mocks.collectEvidence,
  buildLedger: () => ({}),
  buildEvidenceFiles: () => ({}),
  hashEvidence: () => 'hash_1'
}));

vi.mock('./securityReviewGate', () => ({
  internalSecurityReviewGateService: {
    isReviewGenerationAllowed: mocks.allowed,
    checkGenerationRateLimit: mocks.rateLimit,
    resolveReviewGate: async () => ({ allowAi: false })
  }
}));

vi.mock('./securityReviewLease', () => ({}));
vi.mock('./securityReviewMirror', () => ({}));
vi.mock('./securityReviewStore', () => ({
  internalSecurityReviewStoreService: {
    createRun: mocks.createRun,
    updateRun: mocks.updateRun
  }
}));
vi.mock('./securityUsageReviewRunner', () => ({}));

vi.mock('./securityReviewSink', () => ({
  internalSecurityReviewSinkService: {
    start: mocks.start,
    complete: mocks.complete,
    progress: mocks.progress
  }
}));

import { emptyUsage } from '@metorial/review-engine';
import { RunLog } from '../lib/runLog';
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
  mocks.judge.mockResolvedValue({
    verdict: { consistent: true, issues: [] },
    usage: emptyUsage()
  });
  mocks.rateLimit.mockResolvedValue({ allowed: true });
  mocks.collectEvidence.mockResolvedValue({
    kind: 'skill',
    title: 'Skill',
    limitations: [],
    findings: []
  });
  mocks.createRun.mockResolvedValue({ id: 'run_1', oid: 2n });
  mocks.agent.mockResolvedValue({
    outcome: 'submitted',
    usage: emptyUsage(),
    steps: 1,
    modelSteps: { judge: 1 }
  });
});

let runAgent = async (runLog: RunLog, signal?: AbortSignal) =>
  (internalSecurityReviewRunnerService as any).runAgent({
    review: { id: 'rev_1', scope: 'tenant' },
    revision: {},
    gate: {},
    evidence: { kind: 'skill', title: 'Skill' },
    files: {},
    previous: null,
    previousFindings: [],
    lockedFindings: [],
    input: {},
    runLog,
    onRunCreated: () => {},
    signal
  });

describe('security review consistency checks', () => {
  it('keeps a submitted report with an explicit gap when the judge fails', async () => {
    mocks.judge.mockRejectedValue(
      new DOMException('The operation timed out.', 'TimeoutError')
    );
    let runLog = new RunLog();

    let result = await runAgent(runLog);

    expect(result.complete).toBe(false);
    expect(result.gaps).toContain(
      'The final evidence consistency check could not be completed.'
    );
    expect(runLog.toString()).toContain('consistency check failed and was skipped');
    expect(runLog.toString()).not.toContain('report is consistent');
    expect(mocks.agent).toHaveBeenCalledTimes(1);
  });

  it('revalidates repaired output and preserves remaining consistency failures', async () => {
    mocks.agent.mockImplementation(async ({ state }) => {
      state.submitted = true;
      return { outcome: 'submitted', usage: emptyUsage(), steps: 1, modelSteps: {} };
    });
    mocks.judge.mockResolvedValue({
      verdict: {
        consistent: false,
        issues: [{ section: 'capabilities', message: 'Scope contradicts source.' }]
      },
      usage: emptyUsage()
    });
    let result = await runAgent(new RunLog());
    expect(mocks.judge).toHaveBeenCalledTimes(2);
    expect(mocks.agent).toHaveBeenCalledTimes(2);
    expect(result.complete).toBe(false);
    expect(result.gaps).toContain('capabilities: Scope contradicts source.');
  });

  it('persists retry progress and refreshes the revision heartbeat', async () => {
    mocks.judge.mockImplementation(async ({ onLog }) => {
      await onLog('consistency check attempt 1/3 started');
      return { verdict: { consistent: true, issues: [] }, usage: emptyUsage() };
    });
    let runLog = new RunLog();

    await runAgent(runLog);

    expect(mocks.progress).toHaveBeenCalledWith({
      review: { id: 'rev_1', scope: 'tenant' },
      revision: {},
      progress: {}
    });
    expect(mocks.updateRun).toHaveBeenCalledWith(
      expect.objectContaining({
        steps: 1,
        log: expect.stringContaining('consistency check attempt 1/3 started')
      })
    );
    expect(runLog.toString()).toContain('report is consistent');
  });

  it('does not swallow cancellation of the review as a skipped judge', async () => {
    let controller = new AbortController();
    let error = new DOMException('Review timed out', 'TimeoutError');
    mocks.judge.mockImplementation(async () => {
      controller.abort(error);
      throw error;
    });
    let runLog = new RunLog();

    await expect(runAgent(runLog, controller.signal)).rejects.toBe(error);
    expect(runLog.toString()).not.toContain('was skipped');
    expect(mocks.updateRun).toHaveBeenLastCalledWith(
      expect.objectContaining({ status: 'failed' })
    );
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
