import type { DashboardInstanceSkillsGroupsListOutput } from '@metorial/dashboard-sdk';
import { col, createDataList, f, lifecycleStatus, withDefaults } from '@metorial/data-list';
import { EmptyState } from '@metorial/empty-state';
import { Paths } from '@metorial/frontend-config';
import { useSkillGroups } from '@metorial/state';
import { Avatar, Text } from '@metorial/ui';
import { ItemGrid } from '@metorial/ui-product';
import { useNavigate } from 'react-router-dom';
import { styled } from 'styled-components';
import { useInstanceContext } from '../../lib/dataList';
import { entityFilters } from '../entityFilters';
import { showSkillGroupFormModal } from './groupModal';

type SkillGroup = DashboardInstanceSkillsGroupsListOutput['items'][number];

let Description = styled.span`
  display: -webkit-box;
  overflow: hidden;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
`;

export let SkillGroupGridCard = (p: {
  skillGroup: {
    id: string;
    name: string;
    description?: string | null;
    skills?: unknown[];
  };
  href?: string;
  onClick?: () => void;
}) => (
  <ItemGrid.Item
    entity={{ id: p.skillGroup.id, hasUsage: true }}
    title={p.skillGroup.name}
    description={
      <Description>{p.skillGroup.description || 'No description provided yet.'}</Description>
    }
    variant="v2"
    height={200}
    href={p.href}
    onClick={p.onClick}
    icon={
      <Avatar
        entity={{
          name: p.skillGroup.name,
          imageUrl: `https://avatar-cdn.metorial.com/${p.skillGroup.id}`
        }}
        size={30}
      />
    }
    bottom={<Text size="1">{p.skillGroup.id}</Text>}
  />
);

export let SkillGroupsEmptyState = () => {
  let ctx = useInstanceContext();
  let navigate = useNavigate();

  return (
    <EmptyState
      extra="Skill Groups"
      title="Create your first group"
      description="Groups let you organize related skills and manage them as a set."
      action={{
        label: 'Create Group',
        onClick: () => {
          if (!ctx.instanceId) return;

          showSkillGroupFormModal({
            instanceId: ctx.instanceId,
            onCreate: skillGroup =>
              navigate(
                Paths.instance.skillGroup(
                  ctx.organization,
                  ctx.project,
                  ctx.instance,
                  skillGroup.id
                )
              )
          });
        }
      }}
    />
  );
};

export let SkillGroupsList = createDataList('skill-groups')
  .context(useInstanceContext)
  .filters((_props, ctx) => ({
    status: f.status(lifecycleStatus, { only: ['active', 'archived'] }),
    skillId: f.entity(entityFilters.skill(ctx.instanceId)),
    createdAt: f.createdAt(),
    updatedAt: f.updatedAt()
  }))
  .search('Search groups…')
  .paginated(({ ctx, filters, search }) =>
    useSkillGroups(
      ctx.instanceId,
      withDefaults(
        { order: 'desc' as const, status: ['active' as const], limit: 21 },
        { ...filters, search }
      )
    )
  )
  .columns([
    col.name<SkillGroup>(),
    col.createdAt<SkillGroup>(),
    col.id<SkillGroup>({ isDefault: true }),
    col.status<SkillGroup, any>(lifecycleStatus, { isDefault: false }),
    col.updatedAt<SkillGroup>()
  ])
  .link((group, _props, ctx) =>
    Paths.instance.skillGroup(ctx.organization, ctx.project, ctx.instance, group.id)
  )
  .item(group => ({
    title: group.name,
    description: (
      <Description>{group.description || 'No description provided yet.'}</Description>
    ),
    icon: (
      <Avatar
        entity={{
          name: group.name,
          imageUrl: `https://avatar-cdn.metorial.com/${group.id}`
        }}
        size={30}
      />
    ),
    footer: <Text size="1">{group.id}</Text>,
    height: 200
  }))
  .layouts(['grid', 'table'], { default: 'grid' })
  .build();
