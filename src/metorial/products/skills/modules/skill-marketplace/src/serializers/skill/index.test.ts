import type { SkillConfiguration } from '@metorial/db';
import { describe, expect, it } from 'vitest';
import { combineConfigs } from '../../lib/combineConfigs';
import { isAllowedBySkillConfig } from './config';
import { parseSkillDocumentFrontmatter } from './frontmatter';

describe('skill document frontmatter parsing', () => {
  it('does not treat markdown horizontal rules as frontmatter', () => {
    let content = `# Review

Introduction

---

Details

---
`;

    expect(parseSkillDocumentFrontmatter(content)).toEqual({
      frontmatter: {},
      body: content,
      hasFrontmatter: false
    });
  });

  it('ignores invalid frontmatter fields and preserves the document body', () => {
    let content = `---
name: review
invalid: *missing-alias
---
# Review
`;

    expect(parseSkillDocumentFrontmatter(content)).toEqual({
      frontmatter: {},
      body: '# Review\n',
      hasFrontmatter: true
    });
  });
});

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

  it('allows no files besides SKILL.md when combined allow-lists are disjoint', () => {
    let config = combineConfigs(
      [
        {
          allowScripts: true,
          allowedFileExtensions: ['.md'],
          allowNonStandardDirectories: true
        },
        {
          allowScripts: false,
          allowedFileExtensions: ['.json'],
          allowNonStandardDirectories: true
        }
      ] as SkillConfiguration[],
      null
    );

    expect(isAllowedBySkillConfig('/SKILL.md', config)).toBe(true);
    expect(isAllowedBySkillConfig('/references/readme.md', config)).toBe(false);
    expect(isAllowedBySkillConfig('/references/data.json', config)).toBe(false);
  });
});
