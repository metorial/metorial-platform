import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

let mocks = vi.hoisted(() => ({
  handlers: new Map<string, (job: any) => Promise<void>>(),
  add: vi.fn(),
  ensureSkill: vi.fn(),
  ensureSlate: vi.fn(),
  providerVersion: vi.fn(),
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
    securityReviewRevision: { findFirst: mocks.revision },
    providerVersion: { findUnique: mocks.providerVersion }
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

let now = new Date('2026-11-14T10:00:00Z');
let hourMs = 60 * 60 * 1000;

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(now);
  mocks.generation.SECURITY_REVIEW_AUTO_GENERATION = 'false';

  mocks.ensureSkill.mockResolvedValue({ id: 'review_1', oid: 1n, status: 'active' });
  mocks.revision.mockResolvedValue(null);
  mocks.skill.mockResolvedValue({ createdAt: new Date(now.getTime() - 24 * hourMs) });
});

afterEach(() => vi.useRealTimers());

describe('skill requests with automatic provider generation off', () => {
  it('also permits an explicitly requested provider review', async () => {
    mocks.ensureSlate.mockResolvedValue({ id: 'provider_review', oid: 2n, status: 'active' });
    mocks.providerVersion.mockResolvedValue({ oid: 3n, slateVersionOid: 4n });

    await mocks.handlers.get('sub/srev/request')!({
      subject: 'providerVersion',
      id: 'pv_1',
      trigger: 'page_open',
      ensureSlate: true
    });

    expect(mocks.add).toHaveBeenCalledExactlyOnceWith(
      'sub/srev/run',
      { reviewId: 'provider_review', trigger: 'page_open', reason: undefined },
      expect.objectContaining({ delay: 0 })
    );
  });

  it('starts an ordinary version review for an older skill', async () => {
    await mocks.handlers.get('sub/srev/request')!({
      subject: 'skill',
      id: 'skill_1',
      trigger: 'new_version'
    });

    expect(mocks.add).toHaveBeenCalledWith(
      'sub/srev/run',
      { reviewId: 'review_1', subject: 'skill', trigger: 'new_version', reason: undefined },
      expect.objectContaining({ delay: 0 })
    );
  });

  it.each(['creation', 'last_review'])(
    'runs deterministic checks first and defers AI for six hours after %s',
    async boundary => {
      if (boundary == 'creation') mocks.skill.mockResolvedValue({ createdAt: now });
      else mocks.revision.mockResolvedValue({ completedAt: now });

      await mocks.handlers.get('sub/srev/request')!({
        subject: 'skill',
        id: 'skill_1',
        trigger: 'new_version'
      });

      expect(mocks.add).toHaveBeenCalledWith(
        'sub/srev/run',
        expect.objectContaining({ subject: 'skill', deterministicOnly: true }),
        expect.objectContaining({ delay: 30_000 })
      );
      expect(mocks.add).toHaveBeenCalledWith(
        'sub/srev/run',
        { reviewId: 'review_1', subject: 'skill', trigger: 'new_version', reason: undefined },
        expect.objectContaining({ delay: 6 * hourMs })
      );
    }
  );

  it.each(['skill_import', 'new_version'] as const)(
    'starts immediate AI for import/merge requests (%s), even for a new skill',
    async trigger => {
      mocks.skill.mockResolvedValue({ createdAt: now });

      await mocks.handlers.get('sub/srev/request')!({
        subject: 'skill',
        id: 'skill_1',
        trigger,
        immediateAi: true
      });

      expect(mocks.add).toHaveBeenCalledExactlyOnceWith(
        'sub/srev/run',
        { reviewId: 'review_1', subject: 'skill', trigger, reason: undefined },
        expect.objectContaining({ delay: 0 })
      );
    }
  );

  it.each([{ status: 'disabled' }, { status: 'active', dismissedAt: now }])(
    'does not schedule an inactive or dismissed skill review: %j',
    async state => {
      mocks.ensureSkill.mockResolvedValue({ id: 'review_1', oid: 1n, ...state });

      await mocks.handlers.get('sub/srev/request')!({
        subject: 'skill',
        id: 'skill_1',
        trigger: 'new_version'
      });

      expect(mocks.add).not.toHaveBeenCalled();
    }
  );

  it('still discards speculative provider work', async () => {
    await mocks.handlers.get('sub/srev/request')!({
      subject: 'customProviderVersion',
      id: 'cpv_1'
    });

    expect(mocks.add).not.toHaveBeenCalled();
  });
});
