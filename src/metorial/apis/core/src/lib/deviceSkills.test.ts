import { describe, expect, it } from 'vitest';
import { reportedSkillsValidator } from './deviceSkills';

let limit = 500;

let skill = (index: number) => ({ skill_id: `skl_${index}`, name: `skill-${index}` });

describe('reported device skills', () => {
  it('accepts up to the limit of skills named as Metorial Desktop names them', () => {
    let reported = Array.from({ length: limit - 1 }, (_, index) => skill(index));
    reported.push({ skill_id: 'skl_0mhNnEqM7XQb3vXq8gD2', name: `a${'b'.repeat(61)}_9` });

    expect(reported).toHaveLength(limit);
    expect(reportedSkillsValidator.validate(reported).success).toBe(true);
    expect(reportedSkillsValidator.validate([]).success).toBe(true);
  });

  it('refuses more skills than the limit and names or ids no skill can have', () => {
    let tooMany = Array.from({ length: limit + 1 }, (_, index) => skill(index));

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
