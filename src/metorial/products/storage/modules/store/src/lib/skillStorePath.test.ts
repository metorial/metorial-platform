import { describe, expect, it } from 'vitest';
import { assertSkillStoreItemAllowed, isSkillAgentPath } from './skillStorePath';
import { normalizeStorePath } from './storePath';

let file = (path: string) => normalizeStorePath({ path, kind: 'file' });

describe('skill store path rules', () => {
  it.each(['/agents/reviewer.md', '/agents/Reviewer.MD', '/agents/Notes.Md'])(
    'treats %s as an agent path',
    path => {
      expect(isSkillAgentPath(file(path))).toBe(true);
      expect(() =>
        assertSkillStoreItemAllowed({ path: file(path), kind: 'document' })
      ).not.toThrow();
    }
  );

  it.each(['/agents/reviewer.txt', '/agents/reviewer.markdown', '/agents/nested/reviewer.md'])(
    'does not treat %s as an agent path',
    path => {
      expect(isSkillAgentPath(file(path))).toBe(false);
    }
  );

  it.each([
    ['/agents/reviewer.txt', 'document'],
    ['/agents/Reviewer.MD', 'file'],
    ['/SKILL.md', 'file'],
    ['/docs/SKILL.md', 'file']
  ] as const)('rejects %s stored as a %s', (path, kind) => {
    expect(() => assertSkillStoreItemAllowed({ path: file(path), kind })).toThrow();
  });

  it('allows any file outside the agents directory', () => {
    expect(() =>
      assertSkillStoreItemAllowed({ path: file('/scripts/run.py'), kind: 'file' })
    ).not.toThrow();
  });
});
