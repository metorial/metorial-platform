import { beforeEach, describe, expect, it, vi } from 'vitest';

let mocks = vi.hoisted(() => ({
  handlers: new Map<string, (job: any) => Promise<void>>(),
  add: vi.fn(),
  ensureSkill: vi.fn(),
  ensureSlate: vi.fn(),
  providerVersion: vi.fn(),
  customVersion: vi.fn(),
  revision: vi.fn(),
  skill: vi.fn(),
  generation: { SECURITY_REVIEW_AUTO_GENERATION: 'false' }
}));

vi.mock('@lowerdeck/queue', () => ({
  createQueue: ({ name }: { name: string }) => ({
    add: (job: unknown, opts: unknown) => mocks.add(name, job, opts),
    process: (handler: (job: any) => Promise<void>) => {
      mocks.handlers.set(name, handler);
      return handler;
    }
  }),
  combineQueueProcessors: (processors: unknown[]) => processors
}));
vi.mock('@lowerdeck/cron', () => ({ createCron: () => ({}) }));
vi.mock('@lowerdeck/queue-checkpoint', () => ({ createQueueCheckpoint: () => ({}) }));
vi.mock('@metorial-subspace/db', () => ({
  db: {
    providerVersion: { findUnique: mocks.providerVersion },
    customProviderVersion: { findUnique: mocks.customVersion },
    securityReviewRevision: { findFirst: mocks.revision }
  }
}));
vi.mock('@metorial-subspace/module-tenant', () => ({
  metorialDb: { skill: { findUnique: mocks.skill } }
}));
vi.mock('@metorial/multi-region', () => ({ securityReviewGlobalRepository: {} }));
vi.mock('../internal/securityReviewSubject', () => ({
  internalSecurityReviewSubjectService: {
    ensureSkillReview: mocks.ensureSkill,
    ensureSlateReview: mocks.ensureSlate
  }
}));
vi.mock('../internal/securityReviewRunner', () => ({
  internalSecurityReviewRunnerService: {}
}));
vi.mock('../env', () => ({ env: { service: { REDIS_URL: 'redis://test' } } }));
vi.mock('../../../security-review-request/src/env', () => ({
  env: { service: { REDIS_URL: 'redis://test' }, generation: mocks.generation }
}));

import './triggers';

beforeEach(() => {
  vi.clearAllMocks();
  mocks.generation.SECURITY_REVIEW_AUTO_GENERATION = 'false';
  mocks.ensureSkill.mockResolvedValue({ id: 'review_1', oid: 1n, status: 'active' });
  mocks.ensureSlate.mockResolvedValue({ id: 'review_1', oid: 1n, status: 'active' });

  mocks.providerVersion.mockResolvedValue({ oid: 2n, slateVersionOid: 3n });
  mocks.revision.mockResolvedValue(null);
  mocks.skill.mockResolvedValue({ createdAt: new Date(0) });
});

describe('processing review requests with speculative generation off', () => {
  it('starts an explicitly requested skill review', async () => {
    await mocks.handlers.get('sub/srev/request')!({
      subject: 'skill',
      id: 'skill_1',
      trigger: 'page_open'
    });

    expect(mocks.add).toHaveBeenCalledWith(
      'sub/srev/run',
      { reviewId: 'review_1', trigger: 'page_open', reason: undefined },
      expect.objectContaining({ delay: 0 })
    );
  });

  it('starts an explicitly requested provider version review', async () => {
    await mocks.handlers.get('sub/srev/request')!({
      subject: 'providerVersion',
      id: 'pv_1',
      trigger: 'page_open',
      ensureSlate: true
    });

    expect(mocks.add).toHaveBeenCalledWith(
      'sub/srev/run',
      { reviewId: 'review_1', trigger: 'page_open', reason: undefined },
      expect.objectContaining({ delay: 0 })
    );
  });

  it('preserves the deferred AI policy for newly created skills', async () => {
    mocks.skill.mockResolvedValue({ createdAt: new Date() });

    await mocks.handlers.get('sub/srev/request')!({
      subject: 'skill',
      id: 'skill_1',
      trigger: 'page_open'
    });

    expect(mocks.add).toHaveBeenCalledWith(
      'sub/srev/run',
      expect.objectContaining({ trigger: 'page_open', deterministicOnly: true }),
      expect.objectContaining({ delay: 30_000 })
    );
    expect(mocks.add).toHaveBeenCalledWith(
      'sub/srev/run',
      { reviewId: 'review_1', trigger: 'page_open', reason: undefined },
      expect.objectContaining({ delay: expect.any(Number) })
    );
    expect(mocks.add.mock.calls[1]![2].delay).toBeGreaterThan(0);
  });

  it('discards speculative work already queued before the switch was disabled', async () => {
    await mocks.handlers.get('sub/srev/request')!({
      subject: 'customProviderVersion',
      id: 'cpv_1'
    });
    await mocks.handlers.get('sub/srev/request')!({
      subject: 'skill',
      id: 'skill_1',
      trigger: 'new_version'
    });

    expect(mocks.customVersion).not.toHaveBeenCalled();
    expect(mocks.ensureSkill).not.toHaveBeenCalled();
    expect(mocks.add).not.toHaveBeenCalled();
  });
});
