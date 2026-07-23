import { describe, expect, it } from 'vitest';
import { validateSkillImportFile } from './skillImport';

describe('validateSkillImportFile', () => {
  it('accepts supported skill import files within their limits', () => {
    expect(validateSkillImportFile({ name: 'skills.zip', size: 10 * 1024 * 1024 })).toBeNull();
    expect(validateSkillImportFile({ name: 'SKILL.md', size: 3 * 1024 * 1024 })).toBeNull();
    expect(validateSkillImportFile({ name: 'SKILL.markdown', size: 100 })).toBeNull();
  });

  it('rejects unsupported file extensions', () => {
    expect(validateSkillImportFile({ name: 'skill.txt', size: 100 })).toBe(
      'Choose a ZIP or Markdown file.'
    );
  });

  it('uses format-specific upload limits', () => {
    expect(validateSkillImportFile({ name: 'skills.zip', size: 10 * 1024 * 1024 + 1 })).toBe(
      'ZIP skill archives must be 10 MB or smaller.'
    );
    expect(validateSkillImportFile({ name: 'SKILL.md', size: 3 * 1024 * 1024 + 1 })).toBe(
      'Markdown skill files must be 3 MB or smaller.'
    );
  });
});
