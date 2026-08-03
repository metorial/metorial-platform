import type { DashboardInstanceSkillsTemplatesListQuery } from '@metorial/dashboard-sdk';
import { renderWithPagination } from '@metorial/data-hooks';
import { Paths } from '@metorial/frontend-config';
import {
  useCreateSkill,
  useCurrentInstance,
  useCurrentOrganization,
  useCurrentProject,
  useSkillTemplates
} from '@metorial/state';
import { Avatar, Text, theme } from '@metorial/ui';
import { ItemGrid } from '@metorial/ui-product';
import { useNavigate } from 'react-router-dom';
import { styled } from 'styled-components';
import { EmptyState } from '@metorial/empty-state';
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

export let SkillTemplateGridCard = (p: {
  skillTemplate: {
    id: string;
    name: string;
    description?: string | null;
    slug: string;
  };
  onClick?: () => void;
  menu?: {
    label: string;
    onClick: () => void;
  }[];
}) => (
  <ItemGrid.Item
    entity={{ id: p.skillTemplate.id, hasUsage: true }}
    title={p.skillTemplate.name}
    description={
      <Description>
        {p.skillTemplate.description || 'No description provided yet.'}
      </Description>
    }
    height={200}
    onClick={p.onClick}
    menu={p.menu}
    icon={
      <Avatar
        entity={{
          name: p.skillTemplate.name,
          imageUrl: `https://avatar-cdn.metorial.com/${p.skillTemplate.id}`
        }}
        size={30}
      />
    }
    bottom={
      <div style={{ display: 'flex' }}>
        <Alias>{p.skillTemplate.slug}</Alias>
      </div>
    }
  />
);

export let SkillTemplatesGrid = (
  p: { instanceId: string } & Omit<
    DashboardInstanceSkillsTemplatesListQuery,
    'after' | 'before' | 'cursor' | 'limit'
  >
) => {
  let { instanceId, ...query } = p;
  let organization = useCurrentOrganization();
  let project = useCurrentProject();
  let instance = useCurrentInstance();
  let navigate = useNavigate();
  let createSkill = useCreateSkill();
  let skillTemplates = useSkillTemplates(instanceId, {
    order: 'desc',
    status: ['active'],
    limit: 21,
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
        let [skill] = await createSkill.mutate({
          instanceId: instance.data!.id,
          templateId: skillTemplate.id,
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

  return renderWithPagination(skillTemplates, {
    emptyState: (
      <>
        {query.search && (
          <Text size="2" color="gray600">
            No templates found.
          </Text>
        )}

        {!hasActiveFilters && (
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

        {!query.search && hasActiveFilters && (
          <Text size="2" color="gray600">
            No templates match the current filters.
          </Text>
        )}
      </>
    )
  })(skillTemplates => (
    <>
      {skillTemplates.data.items.length > 0 && (
        <ItemGrid.Root width="300px">
          {skillTemplates.data.items.map(skillTemplate => (
            <SkillTemplateGridCard
              key={skillTemplate.id}
              skillTemplate={skillTemplate}
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
            />
          ))}
        </ItemGrid.Root>
      )}
    </>
  ));
};
