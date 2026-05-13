import type { DashboardInstanceSkillTemplatesListQuery } from '@metorial/dashboard-sdk';
import { renderWithPagination } from '@metorial/data-hooks';
import { Paths } from '@metorial/frontend-config';
import {
  useCurrentInstance,
  useCurrentOrganization,
  useCurrentProject,
  useCreateSkillFromTemplate,
  useSkillTemplates
} from '@metorial/state';
import { Avatar, Text, theme } from '@metorial/ui';
import { ItemGrid } from '@metorial/ui-product';
import { useNavigate } from 'react-router-dom';
import { styled } from 'styled-components';
import { EmptyState } from '../../../../components/emptyState';
import { showSkillCloneFormModal } from './cloneModal';
import { showSkillTemplateFormModal } from './templateModal';

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

export let SkillTemplatesGrid = (
  p: { instanceId: string } & Omit<
    DashboardInstanceSkillTemplatesListQuery,
    'after' | 'before' | 'cursor' | 'limit'
  >
) => {
  let { instanceId, ...query } = p;
  let organization = useCurrentOrganization();
  let project = useCurrentProject();
  let instance = useCurrentInstance();
  let navigate = useNavigate();
  let createSkillFromTemplate = useCreateSkillFromTemplate();
  let skillTemplates = useSkillTemplates(instanceId, {
    order: 'desc',
    status: ['active', 'archived'],
    ...query
  });
  let hasActiveFilters = !!(
    query.search ||
    query.owner ||
    query.providerId ||
    query.integrationId ||
    query.createdAt ||
    query.updatedAt ||
    (Array.isArray(query.status) ? query.status.length > 0 : query.status)
  );

  let showCreateModal = () => {
    if (!instance.data) return;

    showSkillTemplateFormModal({
      instanceId: instance.data.id,
      onCreate: skillTemplate => {
        navigate(
          Paths.instance.skillTemplate(
            organization.data,
            project.data,
            instance.data,
            skillTemplate.id
          )
        );
      }
    });
  };

  let cloneAsSkill = (skillTemplate: {
    id: string;
    name: string;
    description: string | null;
  }) => {
    if (!instance.data) return;

    showSkillCloneFormModal({
      title: 'Clone Template as Skill',
      description: 'Choose a name and description for the new skill.',
      submitLabel: 'Clone as Skill',
      initialName: skillTemplate.name,
      initialDescription: skillTemplate.description,
      onSubmit: async values => {
        let [skill] = await createSkillFromTemplate.mutate({
          instanceId: instance.data!.id,
          skillTemplateId: skillTemplate.id,
          name: values.name,
          description: values.description
        });

        if (!skill) return false;

        navigate(
          Paths.instance.skill(organization.data, project.data, instance.data, skill.id)
        );
      }
    });
  };

  return renderWithPagination(skillTemplates)(skillTemplates => (
    <>
      {skillTemplates.data.items.length > 0 && (
        <ItemGrid.Root width="300px">
          {skillTemplates.data.items.map(skillTemplate => (
            <ItemGrid.Item
              key={skillTemplate.id}
              entity={{ id: skillTemplate.id, hasUsage: true }}
              title={skillTemplate.name}
              description={
                <Description>
                  {skillTemplate.description || 'No description provided yet.'}
                </Description>
              }
              height={200}
              onClick={() =>
                navigate(
                  Paths.instance.skillTemplate(
                    organization.data,
                    project.data,
                    instance.data,
                    skillTemplate.id
                  )
                )
              }
              menu={[
                {
                  label: 'Clone as Skill',
                  onClick: () => cloneAsSkill(skillTemplate)
                }
              ]}
              icon={
                <Avatar
                  entity={{
                    name: skillTemplate.name,
                    imageUrl: `https://avatar-cdn.metorial.com/${skillTemplate.id}`
                  }}
                  size={30}
                />
              }
              bottom={
                <div style={{ display: 'flex' }}>
                  <Alias>{skillTemplate.slug}</Alias>
                </div>
              }
            />
          ))}
        </ItemGrid.Root>
      )}

      {skillTemplates.data.items.length === 0 && query.search && (
        <Text size="2" color="gray600">
          No templates found.
        </Text>
      )}

      {skillTemplates.data.items.length === 0 && !hasActiveFilters && (
        <EmptyState
          extra="Skill Templates"
          title="Create your first template"
          description="Templates let you reuse files, providers, and integrations when creating new skills."
          action={{
            label: 'Create Template',
            onClick: showCreateModal
          }}
        />
      )}

      {skillTemplates.data.items.length === 0 && !query.search && hasActiveFilters && (
        <Text size="2" color="gray600">
          No templates match the current filters.
        </Text>
      )}
    </>
  ));
};
