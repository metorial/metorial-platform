import { beforeEach, describe, expect, it, vi } from 'vitest';

let mocks = vi.hoisted(() => ({ listSkillRecords: vi.fn() }));

vi.mock('@metorial/module-skill', () => ({
  skillService: { listSkillRecords: mocks.listSkillRecords }
}));

import {
  grantableDeviceSkills,
  maxReportedSkills,
  reportedSkillsValidator
} from './deviceSkills';

let accessTags = { type: 'list', tags: [] } as any;

let ctx = {
  project: { oid: 2n, id: 'proj_1' },
  instance: { oid: 3n, id: 'inst_1' },
  accessTags
} as any;

let skill = (index: number) => ({ skill_id: `skl_${index}`, name: `skill-${index}` });

describe('reported device skills', () => {
  it('accepts up to the limit of skills named as Metorial Desktop names them', () => {
    let reported = Array.from({ length: maxReportedSkills - 1 }, (_, index) => skill(index));
    reported.push({ skill_id: 'skl_0mhNnEqM7XQb3vXq8gD2', name: `a${'b'.repeat(61)}_9` });

    expect(reported).toHaveLength(maxReportedSkills);
    expect(reportedSkillsValidator.validate(reported).success).toBe(true);
    expect(reportedSkillsValidator.validate([]).success).toBe(true);
  });

  it('refuses more skills than the limit and names or ids no skill can have', () => {
    let tooMany = Array.from({ length: maxReportedSkills + 1 }, (_, index) => skill(index));

    for (let reported of [
      tooMany,
      [{ skill_id: 'skl_1', name: 'a'.repeat(65) }],
      [{ skill_id: 'skl_1', name: '../escape' }],
      [{ skill_id: 'skl_1', name: '-leading' }],
      [{ skill_id: 'skl_1', name: '' }],
      [{ skill_id: 'mgsr_1', name: 'billing' }],
      [{ skill_id: 'skl_', name: 'billing' }],
      [{ skill_id: 'skl_1;drop', name: 'billing' }]
    ]) {
      expect(reportedSkillsValidator.validate(reported).success).toBe(false);
    }
  });
});

describe('grantableDeviceSkills', () => {
  beforeEach(() => vi.clearAllMocks());

  it('keeps only the skills the consumer can be given', async () => {
    mocks.listSkillRecords.mockResolvedValue([{ id: 'skl_mine' }]);

    let skills = await grantableDeviceSkills(ctx, [
      { skill_id: 'skl_mine', name: 'billing' },
      { skill_id: 'skl_foreign', name: 'other' },
      { skill_id: 'skl_mine', name: 'billing-2' }
    ]);

    expect(skills).toEqual([
      { skillId: 'skl_mine', name: 'billing' },
      { skillId: 'skl_mine', name: 'billing-2' }
    ]);
    expect(mocks.listSkillRecords).toHaveBeenCalledWith({
      project: ctx.project,
      instance: ctx.instance,
      ids: ['skl_mine', 'skl_foreign'],
      accessTags,
      select: { id: true },
      take: 2
    });
  });

  it('keeps the stored list when the app sends none, and clears it for an empty list', async () => {
    expect(await grantableDeviceSkills(ctx, undefined)).toBeUndefined();
    expect(await grantableDeviceSkills(ctx, [])).toEqual([]);
    expect(mocks.listSkillRecords).not.toHaveBeenCalled();
  });
});
