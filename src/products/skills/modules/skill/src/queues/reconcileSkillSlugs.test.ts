import { beforeEach, describe, expect, it, vi } from 'vitest';

let { db, mocks } = vi.hoisted(() => {
  let mocks = {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    updateMany: vi.fn()
  };
  let db = {
    skill: {
      findMany: mocks.findMany,
      findUnique: mocks.findUnique,
      updateMany: mocks.updateMany
    }
  };

  return { db, mocks };
});

vi.mock('@metorial/db', () => ({ db }));

vi.mock('@metorial/cron', () => ({
  createCron: vi.fn((_opts: unknown, handler: () => Promise<void>) => ({ handler }))
}));

vi.mock('@metorial/queue', () => ({
  createQueue: vi.fn((config: { name: string }) => ({
    name: config.name,
    add: vi.fn(),
    addMany: vi.fn(),
    addManyWithOps: vi.fn(),
    process: vi.fn((handler: (data: never) => Promise<void>) => ({ handler }))
  })),
  combineQueueProcessors: vi.fn((processors: unknown[]) => processors),
  dailyPacedDelay: vi.fn(() => ({ delay: 1000 }))
}));

vi.mock('@lowerdeck/id', () => ({
  generatePlainId: vi.fn(() => 'AbC12')
}));

vi.mock('@lowerdeck/slugify', () => ({
  slugify: vi.fn((input: string) =>
    input
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
  )
}));

import { getSkillSlug } from '../lib/skillSlug';
import {
  RECONCILE_SKILL_SLUGS_BATCH_SIZE,
  reconcileSkillSlugsCron,
  reconcileSkillSlugsManyQueue,
  reconcileSkillSlugsManyQueueProcessor,
  reconcileSkillSlugsSingleQueue,
  reconcileSkillSlugsSingleQueueProcessor
} from './reconcileSkillSlugs';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('getSkillSlug', () => {
  it('matches the slug generated for new skills', () => {
    expect(getSkillSlug('My Skill')).toBe('my-skill-abc12');
  });
});

describe('reconcileSkillSlugsCron', () => {
  it('enqueues the many queue', async () => {
    await (reconcileSkillSlugsCron as any).handler();

    expect(reconcileSkillSlugsManyQueue.add).toHaveBeenCalledWith({});
  });
});

describe('reconcileSkillSlugsManyQueueProcessor', () => {
  it('fans out skills without a slug into single jobs', async () => {
    mocks.findMany.mockResolvedValue([{ id: 'skl_1' }, { id: 'skl_2' }]);

    await (reconcileSkillSlugsManyQueueProcessor as any).handler({});

    expect(mocks.findMany).toHaveBeenCalledWith({
      where: {
        OR: [{ slug: null }, { slug: '' }],
        id: undefined
      },
      orderBy: { id: 'asc' },
      take: RECONCILE_SKILL_SLUGS_BATCH_SIZE,
      select: { id: true }
    });
    expect(reconcileSkillSlugsSingleQueue.addManyWithOps).toHaveBeenCalledWith([
      { data: { skillId: 'skl_1' }, opts: { id: 'skl_1' } },
      { data: { skillId: 'skl_2' }, opts: { id: 'skl_2' } }
    ]);
    expect(reconcileSkillSlugsManyQueue.add).not.toHaveBeenCalled();
  });

  it('paces the next page when the page is full', async () => {
    mocks.findMany.mockResolvedValue(
      Array.from({ length: RECONCILE_SKILL_SLUGS_BATCH_SIZE }, (_, index) => ({
        id: `skl_${index}`
      }))
    );

    await (reconcileSkillSlugsManyQueueProcessor as any).handler({ cursor: 'skl_start' });

    expect(mocks.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          OR: [{ slug: null }, { slug: '' }],
          id: { gt: 'skl_start' }
        }
      })
    );
    expect(reconcileSkillSlugsManyQueue.add).toHaveBeenCalledWith(
      { cursor: `skl_${RECONCILE_SKILL_SLUGS_BATCH_SIZE - 1}` },
      { delay: 1000 }
    );
  });

  it('does nothing when no skills are missing a slug', async () => {
    mocks.findMany.mockResolvedValue([]);

    await (reconcileSkillSlugsManyQueueProcessor as any).handler({});

    expect(reconcileSkillSlugsSingleQueue.addManyWithOps).not.toHaveBeenCalled();
    expect(reconcileSkillSlugsManyQueue.add).not.toHaveBeenCalled();
  });
});

describe('reconcileSkillSlugsSingleQueueProcessor', () => {
  it('assigns a slug generated from the skill name', async () => {
    mocks.findUnique.mockResolvedValue({ id: 'skl_1', name: 'My Skill', slug: null });

    await (reconcileSkillSlugsSingleQueueProcessor as any).handler({ skillId: 'skl_1' });

    expect(mocks.findUnique).toHaveBeenCalledWith({
      where: { id: 'skl_1' },
      select: { id: true, name: true, slug: true }
    });
    expect(mocks.updateMany).toHaveBeenCalledWith({
      where: {
        id: 'skl_1',
        OR: [{ slug: null }, { slug: '' }]
      },
      data: { slug: 'my-skill-abc12' }
    });
  });

  it('leaves a skill that already has a slug untouched', async () => {
    mocks.findUnique.mockResolvedValue({
      id: 'skl_1',
      name: 'My Skill',
      slug: 'my-skill-xyz99'
    });

    await (reconcileSkillSlugsSingleQueueProcessor as any).handler({ skillId: 'skl_1' });

    expect(mocks.updateMany).not.toHaveBeenCalled();
  });

  it('leaves a missing skill untouched', async () => {
    mocks.findUnique.mockResolvedValue(null);

    await (reconcileSkillSlugsSingleQueueProcessor as any).handler({ skillId: 'skl_1' });

    expect(mocks.updateMany).not.toHaveBeenCalled();
  });
});
