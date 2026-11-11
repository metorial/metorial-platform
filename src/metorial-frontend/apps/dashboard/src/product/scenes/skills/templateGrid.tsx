import type {
  DashboardInstanceSkillsTemplatesListOutput,
  DashboardInstanceSkillsTemplatesListQuery
} from '@metorial/dashboard-sdk';
import {
  col,
  createDataList,
  defineAction,
  f,
  lifecycleStatus,
  withDefaults,
  type DataListLayoutRenderArgs
} from '@metorial/data-list';
import { EmptyState } from '@metorial/empty-state';
import { Paths } from '@metorial/frontend-config';
import { SkillPreviewCard } from '@metorial/scene-skills';
import { useCreateSkill, useSkillContentPreviews, useSkillTemplates } from '@metorial/state';
import { Avatar, Text } from '@metorial/ui';
import { ItemGrid } from '@metorial/ui-product';
import { useNavigate } from 'react-router-dom';
import { styled } from 'styled-components';
import { useInstanceContext } from '../../lib/dataList';
import { entityFilters } from '../entityFilters';
import { showSkillCloneFormModal } from './cloneModal';
import { skillViewFilter } from './overview/skillViews';
import { showSkillTemplateFormModal } from './templateModal';

type SkillTemplate = DashboardInstanceSkillsTemplatesListOutput['items'][number];

export type SkillTemplateFilters = Omit<
  DashboardInstanceSkillsTemplatesListQuery,
  'after' | 'before' | 'cursor' | 'limit'
>;

let skillTemplateOwners = [
  { id: 'system', label: 'System' },
  { id: 'tenant', label: 'Tenant' }
] as const;

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
    variant="v2"
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
    bottom={<Text size="1">{p.skillTemplate.slug}</Text>}
  />
);

let SkillTemplatesGridLayout = ({
  items,
  getItemProps
}: DataListLayoutRenderArgs<SkillTemplate>) => {
  let { instanceId } = useInstanceContext();
  let previews = useSkillContentPreviews(instanceId, {
    skillTemplateIds: items.map(skillTemplate => skillTemplate.id)
  });

  return (
    <ItemGrid.Root width="220px">
      {items.map(skillTemplate => {
        let itemProps = getItemProps(skillTemplate);

        return (
          <li key={skillTemplate.id}>
            <SkillPreviewCard
              item={skillTemplate}
              content={
                previews.data ? previews.getTemplateContent(skillTemplate.id) : undefined
              }
              href={itemProps.href ?? ''}
              menu={itemProps.menu.map(item => ({ label: item.label, onClick: item.onClick }))}
            />
          </li>
        );
      })}
    </ItemGrid.Root>
  );
};

export let SkillTemplatesEmptyState = (p: {
  getTemplatePath?: (skillTemplateId: string) => string;
}) => {
  let ctx = useInstanceContext();
  let navigate = useNavigate();

  return (
    <EmptyState
      extra="Skill Templates"
      title="Create your first template"
      description="Templates let you reuse files, providers, and integrations when creating new skills."
      action={{
        label: 'Create Template',
        onClick: () => {
          if (!ctx.instanceId) return;

          showSkillTemplateFormModal({
            instanceId: ctx.instanceId,
            onCreate: skillTemplate =>
              navigate(
                p.getTemplatePath?.(skillTemplate.id) ??
                  Paths.instance.skillTemplate(
                    ctx.organization,
                    ctx.project,
                    ctx.instance,
                    skillTemplate.id
                  )
              )
          });
        }
      }}
    />
  );
};

export let SkillTemplatesList = createDataList<{
  instanceId?: string;
  getTemplatePath?: (skillTemplateId: string) => string;
  filters?: SkillTemplateFilters;
  withSkillViews?: boolean;
}>('skill-templates', { hidePaginationWhenUnavailable: true })
  .context(useInstanceContext)
  .filters((props, ctx) => {
    let instanceId = props.instanceId ?? ctx.instanceId;

    return {
      ...(props.withSkillViews ? { view: skillViewFilter() } : {}),
      status: f.status(lifecycleStatus, { only: ['active', 'archived'] }),
      owner: f.select('owner', 'Owner', skillTemplateOwners),
      providerId: f.entity(entityFilters.provider(instanceId)),
      integrationId: f.entity(entityFilters.integration(instanceId)),
      createdAt: f.createdAt(),
      updatedAt: f.updatedAt()
    };
  })
  .search('Search templates…')
  .paginated(({ props, ctx, filters: { view: _view, ...filters }, search }) =>
    useSkillTemplates(
      props.instanceId ?? ctx.instanceId,
      withDefaults(
        { order: 'desc' as const, status: ['active' as const], limit: 21, ...props.filters },
        { ...filters, search: search ?? props.filters?.search }
      )
    )
  )
  .columns([
    col.name<SkillTemplate>(),
    col.text<SkillTemplate>({ id: 'slug', header: 'Slug', get: row => row.slug }),
    col.text<SkillTemplate>({
      id: 'owner',
      header: 'Owner',
      get: row => skillTemplateOwners.find(owner => owner.id == row.owner)?.label
    }),
    col.createdAt<SkillTemplate>(),
    col.id<SkillTemplate>({ isDefault: true }),
    col.status<SkillTemplate, any>(lifecycleStatus, { isDefault: false }),
    col.updatedAt<SkillTemplate>()
  ])
  .link((row, props, ctx) =>
    props.getTemplatePath
      ? props.getTemplatePath(row.id)
      : Paths.instance.skillTemplate(ctx.organization, ctx.project, ctx.instance, row.id)
  )
  .layouts(['grid', 'table'], { default: 'grid' })
  .layout('grid', {
    label: 'Grid',
    render: args => <SkillTemplatesGridLayout {...args} />
  })
  .itemActions([
    defineAction<SkillTemplate, any, any>({
      id: 'clone',
      label: 'Clone as Skill',
      useRun: ({ props, ctx }) => {
        let navigate = useNavigate();
        let createSkill = useCreateSkill();

        return skillTemplate => {
          let instanceId = props.instanceId ?? ctx.instanceId;
          if (!instanceId) return;

          showSkillCloneFormModal({
            title: 'Clone Template as Skill',
            description: 'Choose a name and description for the new skill.',
            submitLabel: 'Clone as Skill',
            initialName: skillTemplate.name,
            initialDescription: skillTemplate.description,
            onSubmit: async values => {
              let [skill] = await createSkill.mutate({
                instanceId,
                templateId: skillTemplate.id,
                name: values.name,
                description: values.description
              });

              if (!skill) return false;

              navigate(
                Paths.instance.skill(ctx.organization, ctx.project, ctx.instance, skill.id)
              );
            }
          });
        };
      }
    })
  ])
  .build();

export let SkillTemplatesGrid = (
  p: {
    instanceId: string;
    getTemplatePath?: (skillTemplateId: string) => string;
  } & SkillTemplateFilters
) => {
  let { instanceId, getTemplatePath, ...filters } = p;

  return (
    <SkillTemplatesList
      instanceId={instanceId}
      getTemplatePath={getTemplatePath}
      filters={filters}
      hideToolbar
      emptyState={{
        initial: () => <SkillTemplatesEmptyState getTemplatePath={getTemplatePath} />,
        filtered: 'No templates match the current filters.'
      }}
    />
  );
};
