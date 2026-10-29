import type { EntityParam } from '@metorial/frontend-config';
import { Paths } from '@metorial/frontend-config';
import type { ISidebarGroup, ISidebarItem } from '@metorial/layout';
import { SkillIconTile } from '@metorial/scene-skills';
import {
  useAllSkills,
  useCurrentInstance,
  useCurrentOrganization,
  useInstancePinnedSkills
} from '@metorial/state';
import { useForgetRecentSkill, useRecentSkillIds } from './recentSkills';

let sidebarIconSize = 20;

export let useSkillsSidebarGroups = (opts: { enabled: boolean }): ISidebarGroup[] => {
  let instance = useCurrentInstance();
  let organization = useCurrentOrganization();

  let instanceId = opts.enabled ? instance.data?.id : null;

  let skills = useAllSkills(instanceId);
  let pinned = useInstancePinnedSkills(
    opts.enabled ? organization.data?.id : null,
    instanceId
  );
  let recentIds = useRecentSkillIds(instanceId);
  let forgetRecent = useForgetRecentSkill(instanceId);

  if (!opts.enabled || !skills.data) return [];

  let params = [organization.data, instance.data?.project, instance.data] as [
    EntityParam,
    EntityParam,
    EntityParam
  ];

  let skillsById = new Map(skills.data.map(skill => [skill.id, skill]));

  let toItem = (
    skill: NonNullable<typeof skills.data>[number],
    extraMenu: ISidebarItem['menu'] = []
  ): ISidebarItem => {
    let to = Paths.instance.skill(...params, skill.id);
    let isPinned = pinned.isPinned(skill.id);

    return {
      icon: (
        <SkillIconTile image={skill.image} imageUrl={skill.imageUrl} size={sidebarIconSize} />
      ),
      label: skill.name,
      to,
      getProps: i => ({
        isActive: i.pathname === i.to || i.pathname.startsWith(`${i.to}/`)
      }),
      menu: [
        isPinned
          ? { label: 'Unpin', action: () => pinned.unpin(skill.id) }
          : { label: 'Pin', action: () => pinned.pin(skill.id) },
        ...(extraMenu ?? [])
      ]
    };
  };

  let pinnedSkills = pinned.skillIds.flatMap(id => skillsById.get(id) ?? []);
  let recentSkills = recentIds
    .filter(id => !pinned.isPinned(id))
    .flatMap(id => skillsById.get(id) ?? []);
  let listedSkillIds = new Set([...pinnedSkills, ...recentSkills].map(skill => skill.id));
  let otherSkills = skills.data.filter(skill => !listedSkillIds.has(skill.id));

  return [
    {
      label: 'Pinned',
      collapsible: true,
      enabled: pinnedSkills.length > 0,
      items: pinnedSkills.map(skill => toItem(skill))
    },
    {
      label: 'Recent',
      collapsible: true,
      enabled: recentSkills.length > 0,
      items: recentSkills.map(skill =>
        toItem(skill, [{ label: 'Remove From Recent', action: () => forgetRecent(skill.id) }])
      )
    },
    {
      label: 'Skills',
      collapsible: true,
      enabled: otherSkills.length > 0,
      items: otherSkills.map(skill => toItem(skill))
    }
  ];
};
