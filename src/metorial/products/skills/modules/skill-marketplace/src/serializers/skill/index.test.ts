import { describe, expect, it } from 'vitest';
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
});
