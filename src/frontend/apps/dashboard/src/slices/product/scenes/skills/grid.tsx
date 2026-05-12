import { renderWithPagination } from '@metorial/data-hooks';
import { Paths } from '@metorial/frontend-config';
import {
  useCurrentInstance,
  useCurrentOrganization,
  useCurrentProject,
  useSkills
} from '@metorial/state';
import { Avatar, theme } from '@metorial/ui';
import { ItemGrid } from '@metorial/ui-product';
import { Link, useNavigate } from 'react-router-dom';
import { styled } from 'styled-components';
import { EmptyState } from '../../../../components/emptyState';
import { showSkillFormModal } from './modal';

let Alias = styled.div`
  background: ${theme.colors.gray300};
  min-height: 26px;
  border-radius: 999px;
  padding: 4px 10px;
  display: flex;
  align-items: center;
  font-size: 12px;
  font-weight: 500;
  color: ${theme.colors.gray700};
  overflow-wrap: anywhere;
`;

let Description = styled.span`
  display: -webkit-box;
  overflow: hidden;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
`;

export let SkillsGrid = ({ instanceId }: { instanceId: string }) => {
  let organization = useCurrentOrganization();
  let project = useCurrentProject();
  let instance = useCurrentInstance();
  let navigate = useNavigate();
  let skills = useSkills(instanceId, {
    order: 'desc',
    status: ['active', 'archived']
  });

  let showCreateModal = () => {
    if (!instance.data) return;

    showSkillFormModal({
      instanceId: instance.data.id,
      onCreate: skill => {
        navigate(
          Paths.instance.skill(organization.data, project.data, instance.data, skill.id)
        );
      }
    });
  };

  return renderWithPagination(skills)(skills => (
    <>
      {skills.data.items.length > 0 && (
        <ItemGrid.Root width="300px">
          {skills.data.items.map(skill => (
            <Link
              key={skill.id}
              to={Paths.instance.skill(
                organization.data,
                project.data,
                instance.data,
                skill.id
              )}
              style={{ textDecoration: 'none', color: 'inherit' }}
            >
              <ItemGrid.Item
                entity={{ id: skill.id, hasUsage: true }}
                title={skill.name}
                description={
                  <Description>
                    {skill.description || 'No description provided yet.'}
                  </Description>
                }
                height={200}
                icon={
                  <Avatar
                    entity={{
                      name: skill.name,
                      imageUrl: `https://avatar-cdn.metorial.com/${skill.id}`
                    }}
                    size={30}
                  />
                }
                bottom={
                  <div style={{ display: 'flex' }}>
                    <Alias>{skill.slug}</Alias>
                  </div>
                }
              />
            </Link>
          ))}
        </ItemGrid.Root>
      )}

      {skills.data.items.length === 0 && (
        <EmptyState
          extra="Skills"
          title="Create your first skill"
          description="Skills let you extend integrations with documents, custom logic, and resources to create advanced agent workflows."
          action={{
            label: 'Create Skill',
            onClick: showCreateModal
          }}
        />
      )}
    </>
  ));
};
