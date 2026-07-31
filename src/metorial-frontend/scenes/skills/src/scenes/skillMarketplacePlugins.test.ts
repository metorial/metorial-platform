import type { SkillMarketplacePlugin, SkillPlugin } from '@metorial/state';
import { describe, expect, it } from 'vitest';
import {
  getMoveSkillInput,
  isCollapsedMarketplacePlugin,
  moveSkillOptimistically,
  moveSkillToStandaloneOptimistically,
  sortMarketplacePluginHierarchy,
  shouldDeleteSourcePluginAfterMove
} from './skillMarketplacePlugins';

let makeItem = (p: {
  pluginName?: string;
  identifier?: string;
  skills?: Array<{ name: string; clientName: string; slug: string }>;
}) =>
  ({
    identifier: p.identifier ?? 'plugin-identifier',
    skillPlugin: {
      name: p.pluginName ?? 'Plugin name',
      skills: (p.skills ?? []).map((skill, index) => ({
        id: `membership-${index}`,
        skillId: `skill-${index}`,
        skill
      }))
    }
  }) as unknown as SkillMarketplacePlugin;

describe('isCollapsedMarketplacePlugin', () => {
  it.each([
    [
      'name to name',
      {
        pluginName: 'Code Review',
        skills: [{ name: ' code review ', clientName: 'Client', slug: 'slug' }]
      }
    ],
    [
      'client name to name',
      {
        pluginName: 'Client Name',
        skills: [{ name: 'Skill', clientName: 'CLIENT NAME', slug: 'slug' }]
      }
    ],
    [
      'slug to name',
      {
        pluginName: 'skill-slug',
        skills: [{ name: 'Skill', clientName: 'Client', slug: 'SKILL-SLUG' }]
      }
    ],
    [
      'name to identifier',
      {
        identifier: 'skill name',
        skills: [{ name: 'Skill Name', clientName: 'Client', slug: 'slug' }]
      }
    ],
    [
      'client name to identifier',
      {
        identifier: 'client name',
        skills: [{ name: 'Skill', clientName: 'Client Name', slug: 'slug' }]
      }
    ],
    [
      'slug to identifier',
      {
        identifier: 'skill-slug',
        skills: [{ name: 'Skill', clientName: 'Client', slug: 'Skill-Slug' }]
      }
    ]
  ])('collapses a single skill matching by %s', (_, input) => {
    expect(isCollapsedMarketplacePlugin(makeItem(input))).toBe(true);
  });

  it('does not collapse zero, multiple, or differently named skills', () => {
    expect(isCollapsedMarketplacePlugin(makeItem({ skills: [] }))).toBe(false);
    expect(
      isCollapsedMarketplacePlugin(
        makeItem({
          skills: [
            { name: 'One', clientName: 'One', slug: 'one' },
            { name: 'Two', clientName: 'Two', slug: 'two' }
          ]
        })
      )
    ).toBe(false);
    expect(
      isCollapsedMarketplacePlugin(
        makeItem({ skills: [{ name: 'Other', clientName: 'Different', slug: 'unrelated' }] })
      )
    ).toBe(false);
  });
});

describe('getMoveSkillInput', () => {
  it('preserves all membership metadata needed by the add API', () => {
    let membership = {
      skillId: 'skill-1',
      identifier: 'custom-identifier',
      clientName: 'Client name',
      clientDescription: 'Client description',
      clientMetadata: { key: 'value' },
      license: 'MIT',
      compatibility: '>=1',
      skillConfigurationId: 'configuration-1'
    } as unknown as SkillPlugin['skills'][number];

    expect(getMoveSkillInput(membership)).toEqual({
      skillId: 'skill-1',
      identifier: 'custom-identifier',
      clientName: 'Client name',
      clientDescription: 'Client description',
      clientMetadata: { key: 'value' },
      license: 'MIT',
      compatibility: '>=1',
      skillConfigurationId: 'configuration-1'
    });
  });
});

describe('shouldDeleteSourcePluginAfterMove', () => {
  it('only cleans up a source plugin that had exactly one skill', () => {
    expect(shouldDeleteSourcePluginAfterMove(makeItem({ skills: [] }))).toBe(false);
    expect(
      shouldDeleteSourcePluginAfterMove(
        makeItem({ skills: [{ name: 'One', clientName: 'One', slug: 'one' }] })
      )
    ).toBe(true);
    expect(
      shouldDeleteSourcePluginAfterMove(
        makeItem({
          skills: [
            { name: 'One', clientName: 'One', slug: 'one' },
            { name: 'Two', clientName: 'Two', slug: 'two' }
          ]
        })
      )
    ).toBe(false);
  });
});

describe('moveSkillOptimistically', () => {
  let makePlugin = (id: string, skillIds: string[]) =>
    ({
      id: `marketplace-${id}`,
      identifier: id,
      skillPlugin: {
        id,
        name: id,
        skills: skillIds.map(skillId => ({
          id: `membership-${skillId}`,
          skillId,
          skill: { id: skillId, name: skillId, clientName: skillId, slug: skillId }
        }))
      }
    }) as unknown as SkillMarketplacePlugin;

  it('moves a skill immediately between multi-skill plugins', () => {
    let source = makePlugin('source', ['one', 'two']);
    let destination = makePlugin('destination', []);
    let skill = source.skillPlugin!.skills[0];
    let result = moveSkillOptimistically(
      [source, destination],
      'source',
      'destination',
      skill
    );

    expect(result[0].skillPlugin!.skills.map(item => item.skillId)).toEqual(['two']);
    expect(result[1].skillPlugin!.skills.map(item => item.skillId)).toEqual(['one']);
  });

  it('removes a single-skill source plugin immediately', () => {
    let source = makePlugin('source', ['one']);
    let destination = makePlugin('destination', []);
    let result = moveSkillOptimistically(
      [source, destination],
      'source',
      'destination',
      source.skillPlugin!.skills[0]
    );

    expect(result.map(item => item.skillPlugin!.id)).toEqual(['destination']);
    expect(result[0].skillPlugin!.skills[0].skillId).toBe('one');
  });

  it('keeps the standalone replacement while removing the skill from its source', () => {
    let source = makePlugin('source', ['one', 'two']);
    let standalone = makePlugin('standalone', ['one']);
    let result = moveSkillToStandaloneOptimistically(
      [source],
      'source',
      source.skillPlugin!.skills[0],
      standalone
    );

    expect(result.map(item => item.skillPlugin!.id)).toEqual(['source', 'standalone']);
    expect(result[0].skillPlugin!.skills.map(item => item.skillId)).toEqual(['two']);
  });
});

describe('sortMarketplacePluginHierarchy', () => {
  it('sorts plugins and their skills by name without mutating the input', () => {
    let zulu = makeItem({
      pluginName: 'Zulu',
      skills: [
        { name: 'Skill 10', clientName: 'Skill 10', slug: 'skill-10' },
        { name: 'alpha', clientName: 'alpha', slug: 'alpha' },
        { name: 'Skill 2', clientName: 'Skill 2', slug: 'skill-2' }
      ]
    });
    let alpha = makeItem({
      pluginName: 'alpha',
      skills: [{ name: 'Only', clientName: 'Only', slug: 'only' }]
    });

    let result = sortMarketplacePluginHierarchy([zulu, alpha]);

    expect(result.map(item => item.skillPlugin!.name)).toEqual(['alpha', 'Zulu']);
    expect(result[1].skillPlugin!.skills.map(item => item.skill.name)).toEqual([
      'alpha',
      'Skill 2',
      'Skill 10'
    ]);
    expect(zulu.skillPlugin!.skills.map(item => item.skill.name)).toEqual([
      'Skill 10',
      'alpha',
      'Skill 2'
    ]);
  });

  it('puts matching single-skill plugins first and sorts them by skill name', () => {
    let multiSkill = makeItem({
      pluginName: 'Able Plugin',
      skills: [
        { name: 'One', clientName: 'One', slug: 'one' },
        { name: 'Two', clientName: 'Two', slug: 'two' }
      ]
    });
    let alphaSkill = makeItem({
      pluginName: 'Alpha Skill',
      skills: [{ name: 'Alpha Skill', clientName: 'Alpha Skill', slug: 'alpha-skill' }]
    });
    let zuluSkill = makeItem({
      pluginName: 'Zulu Skill',
      skills: [{ name: 'Zulu Skill', clientName: 'Zulu Skill', slug: 'zulu-skill' }]
    });
    let oneSkillWrapper = makeItem({
      pluginName: 'Aardvark Wrapper',
      skills: [{ name: 'Middle Skill', clientName: 'Middle Skill', slug: 'middle-skill' }]
    });

    let result = sortMarketplacePluginHierarchy([
      multiSkill,
      oneSkillWrapper,
      zuluSkill,
      alphaSkill
    ]);

    expect(result.map(item => item.skillPlugin!.name)).toEqual([
      'Alpha Skill',
      'Zulu Skill',
      'Aardvark Wrapper',
      'Able Plugin'
    ]);
  });
});
