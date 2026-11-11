import type { DashboardInstanceSkillsGroupsListOutput } from '@metorial/dashboard-sdk';
import type { EntityParam } from '@metorial/frontend-config';
import { Paths } from '@metorial/frontend-config';
import type { ISidebarGroup, ISidebarItem } from '@metorial/layout';
import { SkillIconTile } from '@metorial/scene-skills';
import { RiArrowRightSLine, RiFolderLine, RiFolderOpenLine } from '@remixicon/react';
import { useLayoutEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  useCurrentInstance,
  useCurrentOrganization,
  useInstancePinnedSkills,
  useSkillGroups,
  useSkills
} from '@metorial/state';
import { showSkillGroupFormModal } from '../groupModal';
import { useForgetRecentSkill, useRecentSkillIds } from './recentSkills';
import {
  getSkillGroupIdFromPath,
  getSkillIdFromPath,
  getSkillOpenSource,
  retainSkillOpenSource,
  setSkillOpenSource,
  useSkillOpenSources,
  type SkillOpenSource
} from './skillOpenSource';

let sidebarIconSize = 20;
let sidebarSkillsPageSize = 100;
let sidebarRecentSkillsLimit = 5;
let sidebarSkillGroupsPageSize = 50;
let sidebarGroupSkillsLimit = 8;

type SkillGroup = DashboardInstanceSkillsGroupsListOutput['items'][number];

let isPathActive = (pathname: string, to: string) =>
  pathname === to || pathname.startsWith(`${to}/`);

export let useSkillsSidebarGroups = (opts: { enabled: boolean }): ISidebarGroup[] => {
  let instance = useCurrentInstance();
  let organization = useCurrentOrganization();
  let location = useLocation();
  let navigate = useNavigate();

  let instanceId = opts.enabled ? instance.data?.id : null;

  let favorites = useInstancePinnedSkills({
    enabled: opts.enabled,
    instanceId: instanceId ?? undefined
  });
  let recentIds = useRecentSkillIds(instanceId)
    .filter(id => !favorites.has(id))
    .slice(-sidebarRecentSkillsLimit);
  let forgetRecent = useForgetRecentSkill(instanceId);

  let highlightedIds = [...new Set([...favorites.items, ...recentIds])].slice(
    0,
    sidebarSkillsPageSize
  );
  let highlighted = useSkills(
    highlightedIds.length ? instanceId : null,
    highlightedIds.length
      ? { id: highlightedIds, status: ['active'], limit: sidebarSkillsPageSize }
      : null
  );
  let skillGroups = useSkillGroups(instanceId, {
    order: 'asc',
    status: ['active'],
    limit: sidebarSkillGroupsPageSize
  });

  // A new favorite/recent id set starts a fresh query with no data; keep the last result
  // until it resolves so the Favorites and Recent sections don't collapse in between.
  let lastHighlightedRef = useRef(highlighted.data?.items ?? []);
  if (highlighted.data) lastHighlightedRef.current = highlighted.data.items;

  let openSources = useSkillOpenSources();
  let previousPathnameRef = useRef(location.pathname);

  // Skills opened from anywhere but the sidebar count as opened from the group page they
  // were opened on, so a skill clicked inside a group stays highlighted under that group.
  useLayoutEffect(() => {
    let previousPathname = previousPathnameRef.current;
    previousPathnameRef.current = location.pathname;

    let skillId = getSkillIdFromPath(location.pathname);
    retainSkillOpenSource(skillId);
    if (!skillId || getSkillOpenSource(skillId)) return;

    let groupId = getSkillGroupIdFromPath(previousPathname);
    if (groupId) setSkillOpenSource(skillId, `group:${groupId}`);
  }, [location.pathname]);

  if (!opts.enabled) return [];

  let params = [organization.data, instance.data?.project, instance.data] as [
    EntityParam,
    EntityParam,
    EntityParam
  ];

  let skillsById = new Map(lastHighlightedRef.current.map(skill => [skill.id, skill]));
  let favoriteSkills = favorites.items.flatMap(id => skillsById.get(id) ?? []);
  let recentSkills = recentIds.flatMap(id => skillsById.get(id) ?? []);
  let groups = skillGroups.data?.items ?? [];
  let hasMoreGroups = !!skillGroups.data?.pagination.hasMoreAfter;

  let getGroupSkills = (group: SkillGroup) =>
    group.skills.filter(skill => skill.status == 'active');

  let currentSkillId = getSkillIdFromPath(location.pathname);
  let placements: SkillOpenSource[] = currentSkillId
    ? [
        ...(favoriteSkills.some(skill => skill.id == currentSkillId)
          ? (['favorites'] as const)
          : []),
        ...(recentSkills.some(skill => skill.id == currentSkillId)
          ? (['recent'] as const)
          : []),
        ...groups
          .filter(group =>
            getGroupSkills(group)
              .slice(0, sidebarGroupSkillsLimit)
              .some(skill => skill.id == currentSkillId)
          )
          .map(group => `group:${group.id}` as const)
      ]
    : [];
  let openSource = currentSkillId ? openSources[currentSkillId] : undefined;
  let activePlacement =
    openSource && placements.includes(openSource) ? openSource : placements[0];

  let isPlacementActive = (placement: SkillOpenSource, pathname: string, to: string) =>
    placement == activePlacement && isPathActive(pathname, to);

  let toSkillItem = (
    skill: (typeof lastHighlightedRef.current)[number],
    placement: SkillOpenSource,
    extraMenu: ISidebarItem['menu'] = []
  ): ISidebarItem => {
    let to = Paths.instance.skill(...params, skill.id);
    let isFavorite = favorites.has(skill.id);

    return {
      icon: (
        <SkillIconTile image={skill.image} imageUrl={skill.imageUrl} size={sidebarIconSize} />
      ),
      label: skill.name,
      to,
      onClick: () => setSkillOpenSource(skill.id, placement),
      getProps: i => ({ isActive: isPlacementActive(placement, i.pathname, i.to) }),
      menu: [
        isFavorite
          ? { label: 'Remove From Favorites', action: () => favorites.remove(skill.id) }
          : { label: 'Add to Favorites', action: () => favorites.add(skill.id) },
        ...(extraMenu ?? [])
      ]
    };
  };

  let toGroupItem = (group: SkillGroup): ISidebarItem => {
    let to = Paths.instance.skillGroup(...params, group.id);
    let placement = `group:${group.id}` as const;
    let skills = getGroupSkills(group).map(skill => ({
      skill,
      to: Paths.instance.skill(...params, skill.id)
    }));
    let isOpen = isPathActive(location.pathname, to) || activePlacement == placement;

    return {
      icon: isOpen ? <RiFolderOpenLine /> : <RiFolderLine />,
      label: group.name,
      to,
      getProps: i => ({ isActive: isPathActive(i.pathname, i.to) }),
      children: [
        ...skills.slice(0, sidebarGroupSkillsLimit).map(entry => ({
          label: entry.skill.name,
          to: entry.to,
          onClick: () => setSkillOpenSource(entry.skill.id, placement),
          getProps: (i: { pathname: string; to: string }) => ({
            isActive: isPlacementActive(placement, i.pathname, i.to)
          })
        })),
        ...(skills.length > sidebarGroupSkillsLimit
          ? [{ label: `View All ${skills.length}`, to, getProps: () => ({ isActive: false }) }]
          : [])
      ]
    };
  };

  return [
    {
      label: 'Favorites',
      collapsible: true,
      enabled: favoriteSkills.length > 0,
      items: favoriteSkills.map(skill => toSkillItem(skill, 'favorites'))
    },
    {
      label: 'Recent',
      collapsible: true,
      enabled: recentSkills.length > 0,
      items: recentSkills.map(skill =>
        toSkillItem(skill, 'recent', [
          { label: 'Remove From Recent', action: () => forgetRecent(skill.id) }
        ])
      )
    },
    {
      label: 'Groups',
      collapsible: true,
      onCreate: instanceId
        ? () =>
            showSkillGroupFormModal({
              instanceId,
              onCreate: group => navigate(Paths.instance.skillGroup(...params, group.id))
            })
        : undefined,
      items: [
        ...groups.map(toGroupItem),
        ...(hasMoreGroups
          ? [
              {
                icon: <RiArrowRightSLine />,
                label: 'View All Groups',
                to: Paths.instance.skillGroups(...params),
                getProps: (i: { pathname: string; to: string }) => ({
                  isActive: isPathActive(i.pathname, i.to)
                })
              }
            ]
          : [])
      ]
    }
  ];
};
