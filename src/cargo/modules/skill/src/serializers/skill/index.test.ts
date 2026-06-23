import { describe, expect, it } from 'vitest';
import { isAllowedBySkillConfig } from './config';

describe('skill serializer config filtering', () => {
  it('always allows the root SKILL.md document', () => {
    expect(
      isAllowedBySkillConfig('/SKILL.md', {
        allowScripts: true,
        allowedFileExtensions: ['txt'],
        allowNonStandardDirectories: true
      })
    ).toBe(true);

    expect(
      isAllowedBySkillConfig('SKILL.md', {
        allowScripts: false,
        allowedFileExtensions: ['txt'],
        allowNonStandardDirectories: false
      })
    ).toBe(true);
  });

  it('continues filtering non-root markdown documents by extension config', () => {
    expect(
      isAllowedBySkillConfig('/references/SKILL.md', {
        allowScripts: true,
        allowedFileExtensions: ['txt'],
        allowNonStandardDirectories: true
      })
    ).toBe(false);

    expect(
      isAllowedBySkillConfig('/references/readme.md', {
        allowScripts: true,
        allowedFileExtensions: ['txt'],
        allowNonStandardDirectories: true
      })
    ).toBe(false);
  });

  it('keeps allowing files when extension filtering is disabled', () => {
    expect(
      isAllowedBySkillConfig('/references/readme.md', {
        allowScripts: true,
        allowedFileExtensions: [],
        allowNonStandardDirectories: true
      })
    ).toBe(true);
  });
});
