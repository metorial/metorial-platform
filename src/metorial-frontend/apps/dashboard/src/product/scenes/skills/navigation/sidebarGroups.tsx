import type { EntityParam } from '@metorial/frontend-config';
import { Paths } from '@metorial/frontend-config';
import type { ISidebarGroup, ISidebarItem } from '@metorial/layout';
import { SkillIconTile } from '@metorial/scene-skills';
import { useEffect, useRef } from 'react';
import {
  useCurrentInstance,
  useCurrentOrganization,
  useInfiniteSkills,
  useInstancePinnedSkills,
  useSkills
} from '@metorial/state';
import { useForgetRecentSkill, useRecentSkillIds } from './recentSkills';

let sidebarIconSize = 20;
let sidebarSkillsPageSize = 100;

let LoadMoreSentinel = (p: { loadedCount: number; onVisible: () => void }) => {
  let ref = useRef<HTMLSpanElement>(null);
  let onVisibleRef = useRef(p.onVisible);
  onVisibleRef.current = p.onVisible;

  useEffect(() => {
    let element = ref.current;
    if (!element) return;

    let observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) onVisibleRef.current();
    });

    observer.observe(element);
    return () => observer.disconnect();
  }, [p.loadedCount]);

  return <span ref={ref} style={{ display: 'block', width: 16, height: 16 }} />;
};

export let useSkillsSidebarGroups = (opts: { enabled: boolean }): ISidebarGroup[] => {
  let instance = useCurrentInstance();
  let organization = useCurrentOrganization();

  let instanceId = opts.enabled ? instance.data?.id : null;

  let pinned = useInstancePinnedSkills({
    enabled: opts.enabled,
    instanceId: instanceId ?? undefined
  });
  let recentIds = useRecentSkillIds(instanceId);
  let forgetRecent = useForgetRecentSkill(instanceId);

  let highlightedIds = [...new Set([...pinned.items, ...recentIds])].slice(
    0,
    sidebarSkillsPageSize
  );
  let highlighted = useSkills(
    highlightedIds.length ? instanceId : null,
    highlightedIds.length
      ? { id: highlightedIds, status: ['active'], limit: sidebarSkillsPageSize }
      : null
  );
  let skills = useInfiniteSkills(instanceId, {
    order: 'asc',
    status: ['active'],
    limit: sidebarSkillsPageSize
  });

  if (!opts.enabled) return [];

  let params = [organization.data, instance.data?.project, instance.data] as [
    EntityParam,
    EntityParam,
    EntityParam
  ];

  let skillsById = new Map((highlighted.data?.items ?? []).map(skill => [skill.id, skill]));

  let toItem = (
    skill: (typeof skills.items)[number],
    extraMenu: ISidebarItem['menu'] = []
  ): ISidebarItem => {
    let to = Paths.instance.skill(...params, skill.id);
    let isPinned = pinned.has(skill.id);

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
          ? { label: 'Unpin', action: () => pinned.remove(skill.id) }
          : { label: 'Pin', action: () => pinned.add(skill.id) },
        ...(extraMenu ?? [])
      ]
    };
  };

  let pinnedSkills = pinned.items.flatMap(id => skillsById.get(id) ?? []);
  let recentSkills = recentIds
    .filter(id => !pinned.has(id))
    .flatMap(id => skillsById.get(id) ?? []);
  let listedSkillIds = new Set([...pinnedSkills, ...recentSkills].map(skill => skill.id));
  let otherSkills = skills.items.filter(skill => !listedSkillIds.has(skill.id));

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
      items: [
        ...otherSkills.map(skill => toItem(skill)),
        ...(skills.hasMore
          ? [
              {
                icon: (
                  <LoadMoreSentinel
                    loadedCount={skills.items.length}
                    onVisible={skills.loadMore}
                  />
                ),
                label: 'Loading More…',
                getProps: () => ({ isActive: false })
              }
            ]
          : [])
      ]
    }
  ];
};
