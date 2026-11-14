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
vi.mock('@metorial/review-engine', async importOriginal => ({
  ...(await importOriginal<typeof import('@metorial/review-engine')>()),
  runReviewAgent: mocks.agent
}));
vi.mock('../definitions/thoroughness', async () => {
  let { MockLanguageModelV4 } = await import('ai/test');
  let model = new MockLanguageModelV4({
    doStream: async () => {
      let result = await mocks.judge();
      return {
        stream: new ReadableStream({
          start(controller) {
            controller.enqueue({ type: 'stream-start', warnings: [] });
            controller.enqueue({ type: 'text-start', id: 'text' });
            for (let part of result.content)
              controller.enqueue({ type: 'text-delta', id: 'text', delta: part.text });
            controller.enqueue({ type: 'text-end', id: 'text' });
            controller.enqueue({
              type: 'finish',
              usage: result.usage,
              finishReason: result.finishReason
            });
            controller.close();
          }
        })
      };
    }
  });
  let judge = {
    slug: 'judge',
    model,
    pricing: {
      inputPerMillion: 1,
      outputPerMillion: 1,
      cacheReadPerMillion: 1,
      cacheWritePerMillion: 0
    }
  };

  return {
    reviewModelAccess: undefined,
    getThoroughnessTier: () => ({
      model: judge,
      maxCostMicros: 100_000,
      maxSteps: 10,
      maxFixRounds: 1
    }),
    getJudgeModel: () => judge
  };
});
vi.mock('../env', () => ({}));
vi.mock('../lib/assemble', () => ({
  assembleReport: ({ draft }: any) => ({ scores: { security: 95 }, report: draft })
}));
vi.mock('../lib/findings', () => ({}));
vi.mock('../lib/playbooks', () => ({
  buildSystemPrompt: () => 'system',
  buildConsistencyCriteria: () => 'assessment rubric',
  buildUserPrompt: () => 'prompt'
}));
vi.mock('../lib/report', () => ({
  createSecurityReportDefinition: () => ({
    sections: {
      summary: {
        description: 'Summary',
        shape: '{ text: string }',
        validate: (value: any) => ({ value, errors: [] })
      }
    },
    validateReport: (report: any) => (report.summary ? [] : ['summary is required'])
  })
}));
vi.mock('../lib/storage', () => ({
  workspaceKeyFor: () => 'workspace',
  workspaceStore: { load: async () => null, save: async () => {} }
}));

vi.mock('../lib/subjects', async () => ({
  collectEvidence: mocks.collectEvidence,
  buildLedger: () => new EvidenceLedger(),
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

import { emptyUsage, EvidenceLedger } from '@metorial/review-engine';
import { RunLog } from '../lib/runLog';
import { internalSecurityReviewRunnerService } from './securityReviewRunner';

let judgeResponse = (
  verdict = { consistent: true, issues: [] as { section: string; message: string }[] }
) => ({
  content: [{ type: 'text', text: JSON.stringify(verdict) }],
  finishReason: { unified: 'stop', raw: 'stop' },
  usage: {
    inputTokens: { total: 1000, noCache: 1000, cacheRead: 0, cacheWrite: 0 },
    outputTokens: { total: 100, text: 100, reasoning: 0 }
  },
  warnings: []
});

let submit = async (tools: any, state: any) => {
  await tools.submit.execute({}, { toolCallId: 'submit', messages: [] });
  return {
    outcome: state.submitted ? 'submitted' : 'stopped',
    usage: emptyUsage(),
    steps: 1,
    modelSteps: {}
  };
};

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
  mocks.judge.mockResolvedValue(judgeResponse());
  mocks.rateLimit.mockResolvedValue({ allowed: true });
  mocks.collectEvidence.mockResolvedValue({
    kind: 'skill',
    title: 'Skill',
    limitations: [],
    findings: []
  });
  mocks.createRun.mockResolvedValue({ id: 'run_1', oid: 2n });
  mocks.agent.mockImplementation(async ({ tools, state }) => {
    await tools.write_section.execute(
      { section: 'summary', value: { text: 'Reviewed skill' } },
      { toolCallId: 'write', messages: [] }
    );
    return submit(tools, state);
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
  it('retains a locally valid score when the verifier is unavailable', async () => {
    mocks.judge.mockRejectedValue(new Error('Verifier service unavailable'));
    let runLog = new RunLog();

    let result = await runAgent(runLog);

    expect(result.complete).toBe(true);
    expect(result.gaps).toEqual([]);
    expect(runLog.toString()).toContain('retaining locally validated report');
    expect(runLog.toString()).not.toContain('report is consistent');
    expect(mocks.agent).toHaveBeenCalledTimes(1);
  });

  it('does not turn the attached malformed scores verdict into a partial assessment', async () => {
    mocks.judge.mockResolvedValue(
      judgeResponse({
        consistent: false,
        issues: [{ section: 'scores' }, { section: 'scores' }]
      } as any)
    );
    let runLog = new RunLog();

    let result = await runAgent(runLog);

    expect(result.complete).toBe(true);
    expect(result.gaps).toEqual([]);
    expect(result.costMicros).toBe(3300);
    expect(mocks.judge).toHaveBeenCalledTimes(3);
    expect(mocks.agent).toHaveBeenCalledTimes(1);
    expect(runLog.toString()).toContain('retaining locally validated report');
    expect(runLog.toString()).not.toContain('scores: undefined');
  });

  it('repairs and revalidates within the same main-agent run', async () => {
    mocks.judge
      .mockResolvedValueOnce(
        judgeResponse({
          consistent: false,
          issues: [{ section: 'summary', message: 'Acknowledge the documented deletion.' }]
        })
      )
      .mockResolvedValueOnce(judgeResponse());
    mocks.agent.mockImplementation(async ({ tools, state, extraCostMicros }) => {
      await tools.write_section.execute(
        { section: 'summary', value: { text: 'No deletion' } },
        { toolCallId: 'write1', messages: [] }
      );
      await submit(tools, state);
      expect(state.submitted).toBe(false);
      expect(state.lastErrors).toEqual(['summary: Acknowledge the documented deletion.']);
      expect(extraCostMicros()).toBe(1100);

      await tools.write_section.execute(
        { section: 'summary', value: { text: 'Can delete selected data' } },
        { toolCallId: 'write2', messages: [] }
      );
      return submit(tools, state);
    });

    let result = await runAgent(new RunLog());

    expect(result.complete).toBe(true);
    expect(result.gaps).toEqual([]);
    expect(result.costMicros).toBe(2200);
    expect(mocks.judge).toHaveBeenCalledTimes(2);
    expect(mocks.agent).toHaveBeenCalledTimes(1);
  });

  it('keeps concrete unresolved defects partial and caches an unchanged rejection', async () => {
    mocks.judge.mockResolvedValue(
      judgeResponse({
        consistent: false,
        issues: [{ section: 'summary', message: 'Scope contradicts source.' }]
      })
    );
    mocks.agent.mockImplementation(async ({ tools, state }) => {
      await tools.write_section.execute(
        { section: 'summary', value: { text: 'Too narrow' } },
        { toolCallId: 'write', messages: [] }
      );
      await submit(tools, state);
      return submit(tools, state);
    });

    let result = await runAgent(new RunLog());

    expect(result.complete).toBe(false);
    expect(result.gaps).toEqual(['summary: Scope contradicts source.']);
    expect(mocks.judge).toHaveBeenCalledTimes(1);
    expect(mocks.agent).toHaveBeenCalledTimes(1);
  });

  it('persists verifier progress and refreshes the revision heartbeat', async () => {
    let runLog = new RunLog();
    await runAgent(runLog);

    expect(mocks.progress).toHaveBeenCalledWith({
      review: { id: 'rev_1', scope: 'tenant' },
      revision: {},
      progress: {}
    });
    expect(mocks.updateRun).toHaveBeenCalledWith(
      expect.objectContaining({
        steps: 0,
        log: expect.stringContaining('consistency check attempt 1/3 started')
      })
    );
    expect(runLog.toString()).toContain('report is consistent');
  });

  it('does not swallow cancellation of the review as an unavailable verifier', async () => {
    let controller = new AbortController();
    let error = new DOMException('Review timed out', 'TimeoutError');
    mocks.judge.mockImplementation(async () => {
      controller.abort(error);
      throw error;
    });
    let runLog = new RunLog();

    await expect(runAgent(runLog, controller.signal)).rejects.toBe(error);
    expect(runLog.toString()).not.toContain('retaining locally validated report');
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
