import { describe, expect, it } from 'vitest';
import { getSkillClientNameFromTitle } from './skillClientName';

describe('getSkillClientNameFromTitle', () => {
  it('slugifies titles into valid client names', () => {
    expect(getSkillClientNameFromTitle('PDF Processing')).toBe('pdf-processing');
    expect(getSkillClientNameFromTitle('  My_Skill -- v2! ')).toBe('my-skill-v2');
  });

  it('returns an empty string when nothing usable remains', () => {
    expect(getSkillClientNameFromTitle('***')).toBe('');
  });

  it('caps the length at 64 characters without a trailing hyphen', () => {
    let name = getSkillClientNameFromTitle(`${'a'.repeat(63)} b`);
    expect(name.length).toBeLessThanOrEqual(64);
    expect(name.endsWith('-')).toBe(false);
  });
});
