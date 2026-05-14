import type { DashboardInstanceSkillGroupsListQuery } from '@metorial/dashboard-sdk';
import { renderWithPagination } from '@metorial/data-hooks';
import { Paths } from '@metorial/frontend-config';
import {
  useCurrentInstance,
  useCurrentOrganization,
  useCurrentProject,
  useSkillGroups
} from '@metorial/state';
import { Avatar, Text, theme } from '@metorial/ui';
import { ItemGrid } from '@metorial/ui-product';
import { Link, useNavigate } from 'react-router-dom';
import { styled } from 'styled-components';
import { EmptyState } from '../../../../components/emptyState';
import { showSkillGroupFormModal } from './groupModal';

let Count = styled.div`
  background: ${theme.colors.gray300};
  min-height: 26px;
  border-radius: 999px;
  padding: 4px 10px;
  display: flex;
  align-items: center;
  font-size: 12px;
  font-weight: 500;
  color: ${theme.colors.gray700};
`;

let Description = styled.span`
  display: -webkit-box;
  overflow: hidden;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
`;

export let SkillGroupsGrid = (
  p: { instanceId: string } & Omit<
    DashboardInstanceSkillGroupsListQuery,
    'after' | 'before' | 'cursor' | 'limit'
  >
) => {
  let { instanceId, ...query } = p;
  let organization = useCurrentOrganization();
  let project = useCurrentProject();
  let instance = useCurrentInstance();
  let navigate = useNavigate();
  let skillGroups = useSkillGroups(instanceId, {
    order: 'desc',
    status: ['active', 'archived'],
    ...query
  });
  let hasActiveFilters = !!(
    query.search ||
    query.skillId ||
    query.createdAt ||
    query.updatedAt ||
    (Array.isArray(query.status) ? query.status.length > 0 : query.status)
  );

  let showCreateModal = () => {
    if (!instance.data) return;

    showSkillGroupFormModal({
      instanceId: instance.data.id,
      onCreate: skillGroup => {
        navigate(
          Paths.instance.skillGroup(
            organization.data,
            project.data,
            instance.data,
            skillGroup.id
          )
        );
      }
    });
  };

  return renderWithPagination(skillGroups, {
    emptyState: (
      <>
        {query.search && (
          <Text size="2" color="gray600">
            No groups found.
          </Text>
        )}

        {!hasActiveFilters && (
          <EmptyState
            extra="Skill Groups"
            title="Create your first group"
            description="Groups let you organize related skills and manage them as a set."
            action={{
              label: 'Create Group',
              onClick: showCreateModal
            }}
          />
        )}

        {!query.search && hasActiveFilters && (
          <Text size="2" color="gray600">
            No groups match the current filters.
          </Text>
        )}
      </>
    )
  })(skillGroups => (
    <>
      {skillGroups.data.items.length > 0 && (
        <ItemGrid.Root width="300px">
          {skillGroups.data.items.map(skillGroup => (
            <Link
              key={skillGroup.id}
              to={Paths.instance.skillGroup(
                organization.data,
                project.data,
                instance.data,
                skillGroup.id
              )}
              style={{ textDecoration: 'none', color: 'inherit' }}
            >
              <ItemGrid.Item
                entity={{ id: skillGroup.id, hasUsage: true }}
                title={skillGroup.name}
                description={
                  <Description>
                    {skillGroup.description || 'No description provided yet.'}
                  </Description>
                }
                height={200}
                icon={
                  <Avatar
                    entity={{
                      name: skillGroup.name,
                      imageUrl: `https://avatar-cdn.metorial.com/${skillGroup.id}`
                    }}
                    size={30}
                  />
                }
                bottom={
                  <div style={{ display: 'flex' }}>
                    <Count>
                      {skillGroup.skills.length} skill
                      {skillGroup.skills.length === 1 ? '' : 's'}
                    </Count>
                  </div>
                }
              />
            </Link>
          ))}
        </ItemGrid.Root>
      )}
    </>
  ));
};
