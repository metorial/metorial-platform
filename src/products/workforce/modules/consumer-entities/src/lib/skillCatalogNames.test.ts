import { describe, expect, it } from 'vitest';
import { assignSkillNames, isExcludedSkillPath } from './skillCatalogNames';

describe('isExcludedSkillPath', () => {
  it('excludes the agents directory', () => {
    expect(isExcludedSkillPath('/agents/reviewer.md')).toBe(true);
    expect(isExcludedSkillPath('/references/agents.md')).toBe(false);
  });
});

describe('assignSkillNames', () => {
  it('keeps unique names as they are', () => {
    expect(
      assignSkillNames([
        { id: 'sk_1', slug: 'refunds-ab12c', baseName: 'refunds' },
        { id: 'sk_2', slug: 'billing-xy99z', baseName: 'billing' }
      ])
    ).toEqual([
      { id: 'sk_1', name: 'refunds' },
      { id: 'sk_2', name: 'billing' }
    ]);
  });

  it('keeps the oldest skill unsuffixed and suffixes later collisions from their slug', () => {
    let named = assignSkillNames([
      { id: 'sk_1', slug: 'refunds-ab12c', baseName: 'refunds' },
      { id: 'sk_2', slug: 'refunds-xy99z', baseName: 'refunds' }
    ]);

    expect(named).toEqual([
      { id: 'sk_1', name: 'refunds' },
      { id: 'sk_2', name: 'refunds-xy99z' }
    ]);
  });

  it('keeps existing names when a newer skill collides', () => {
    let older = { id: 'sk_1', slug: 'refunds-ab12c', baseName: 'refunds' };
    let newer = { id: 'sk_2', slug: 'refunds-xy99z', baseName: 'refunds' };

    let before = assignSkillNames([older]);
    let after = assignSkillNames([older, newer]);

    expect(after[0]).toEqual(before[0]);
  });

  it('grows the suffix instead of dropping a skill when suffixes clash', () => {
    let named = assignSkillNames([
      { id: 'sk_0001', slug: 'refunds-ab12c', baseName: 'refunds' },
      { id: 'sk_0002', slug: 'other-ab12c', baseName: 'refunds' },
      { id: 'sk_0003', slug: 'third-ab12c', baseName: 'refunds' }
    ]);

    expect(named).toHaveLength(3);
    expect(new Set(named.map(skill => skill.name)).size).toBe(3);
  });

  it("never gives a suffixed name that is another skill's base name", () => {
    let named = assignSkillNames([
      { id: 'sk_1', slug: 'refunds-ab12c', baseName: 'refunds' },
      { id: 'sk_2', slug: 'refunds-xy99z', baseName: 'refunds' },
      { id: 'sk_3', slug: 'refunds-xy99z-qq1', baseName: 'refunds-xy99z' }
    ]);

    expect(named.find(skill => skill.id == 'sk_3')?.name).toBe('refunds-xy99z');
    expect(named.find(skill => skill.id == 'sk_2')?.name).not.toBe('refunds-xy99z');
    expect(new Set(named.map(skill => skill.name)).size).toBe(3);
  });

  it('keeps suffixed names within 64 characters', () => {
    let baseName = 'a'.repeat(64);
    let named = assignSkillNames([
      { id: 'sk_1', slug: 'x-ab12c', baseName },
      { id: 'sk_2', slug: 'x-xy99z', baseName }
    ]);

    for (let skill of named) {
      expect(skill.name.length).toBeLessThanOrEqual(64);
      expect(skill.name).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
    }
  });
});
