import { describe, expect, it } from 'vitest';
import { getManifestScopeViolation, scopeContains, type ManifestScope } from './scope';

let scope: ManifestScope = {
  dirs: ['skills'],
  files: ['plugin.json', '.claude-plugin/plugin.json'],
  globs: ['assets/logo.*', 'agents/*.md', 'a/*b*c/d']
};

describe('manifest scope', () => {
  it.each([
    ['skills/qa/SKILL.md', true],
    ['skills/x', true],
    ['skills', false],
    ['skillset/x', false],
    ['plugin.json', true],
    ['.claude-plugin/plugin.json', true],
    ['.claude-plugin/other.json', false],
    ['assets/logo.svg', true],
    ['assets/logo.', true],
    ['assets/logo', false],
    ['assets/banner.png', false],
    ['assets/x/logo.png', false],
    ['agents/reviewer.md', true],
    ['agents/.md', true],
    ['agents/notes.txt', false],
    ['agents/sub/reviewer.md', false],
    ['a/bc/d', true],
    ['a/xbyyc/d', true],
    ['a/xbyycz/d', false],
    ['a/cb/d', false],
    ['README.md', false],
    ['', false],
    ['skills/.git/config', false],
    ['skills/x/.gitattributes', false],
    ['skills/.GitModules', false]
  ])('%s → %s', (path, expected) => {
    expect(scopeContains(scope, path)).toBe(expected);
  });

  it('validates every scope entry with the path rules', () => {
    expect(getManifestScopeViolation(scope)).toBeNull();
    expect(getManifestScopeViolation({ dirs: ['.git'], files: [], globs: [] })).toEqual({
      kind: 'dirs',
      value: '.git',
      violation: 'git_dir'
    });
    expect(
      getManifestScopeViolation({ dirs: [], files: [], globs: ['a/../*'] })
    ).toMatchObject({
      kind: 'globs',
      violation: 'dot_segment'
    });
  });
});
