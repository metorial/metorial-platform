import type { DashboardInstanceSkillsListOutput } from '@metorial/dashboard-sdk';
import {
  col,
  createDataList,
  f,
  lifecycleStatus,
  withDefaults,
  type DataListLayoutRenderArgs
} from '@metorial/data-list';
import { renderWithLoader } from '@metorial/data-hooks';
import { EmptyState } from '@metorial/empty-state';
import { Paths } from '@metorial/frontend-config';
import { ContentLayout, PageHeader } from '@metorial/layout';
import { SkillStartInput } from '@metorial/scene-assistant';
import { showScmRepositoryPicker } from '@metorial/scene-scm';
import { SkillIconTile, useSkillImportActions } from '@metorial/scene-skills';
import {
  useCurrentInstance,
  useCurrentOrganization,
  useCreateSkill,
  useCurrentProject,
  useInstancePinnedSkills,
  queueSkillAssistantPrompt,
  useSkillContentPreviews,
  useSkills
} from '@metorial/state';
import { Button, Text } from '@metorial/ui';
import { ItemGrid } from '@metorial/ui-product';
import { useNavigate } from 'react-router-dom';
import { styled } from 'styled-components';
import { useInstanceContext } from '../../../lib/dataList';
import { entityFilters } from '../../../scenes/entityFilters';
import { SkillPreviewCard } from '../../../scenes/skills/overview/skillPreviewCard';
import { showSkillFormModal } from '../../../scenes/skills/modal';
import { showSkillTemplateFormModal } from '../../../scenes/skills/templateModal';

let skillsPageSize = 48;

type Skill = DashboardInstanceSkillsListOutput['items'][number];

let ListName = styled.div`
  display: flex;
  align-items: center;
  gap: 9px;
  min-width: 200px;
`;

let usePathParams = () => {
  let organization = useCurrentOrganization();
  let project = useCurrentProject();
  let instance = useCurrentInstance();

  return [organization.data, project.data, instance.data] as const;
};

let CreateSkillButton = (p: { instanceId: string }) => {
  let organization = useCurrentOrganization();
  let project = useCurrentProject();
  let navigate = useNavigate();
  let pathParams = usePathParams();

  let skillImport = useSkillImportActions({
    instanceId: p.instanceId,
    getSkillPath: skillId => Paths.instance.skill(...pathParams, skillId)
  });

  return (
    <Button
      size="2"
      onClick={() =>
        showSkillFormModal({
          instanceId: p.instanceId,
          onCreate: skill => navigate(Paths.instance.skill(...pathParams, skill.id))
        })
      }
      menu={[
        {
          label: 'Import Skill',
          onClick: () => {
            showScmRepositoryPicker({
              instanceId: p.instanceId,
              allowPublicUrl: true,
              title: 'Import skills',
              description:
                'Select a connected repository or enter a public GitHub, GitLab, or Bitbucket repository URL.',
              onManageSourceControl: () => {
                if (!organization.data || !project.data) return;
                window.location.href = `/o/${organization.data.slug}/project/${project.data.slug}/scm`;
              },
              onSelect: async repository =>
                skillImport.createImport({ type: 'origin', repositoryId: repository.id }),
              onSelectPublicUrl: async repositoryUrl =>
                skillImport.createImport({ type: 'public', repositoryUrl }),
              selectionError: <skillImport.RenderError />
            });
          }
        },
        {
          label: 'Upload Skill',
          onClick: skillImport.uploadSkill
        },
        {
          label: 'Upload Folder',
          onClick: skillImport.uploadSkillDirectory
        },
        {
          label: 'Create Template',
          onClick: () =>
            showSkillTemplateFormModal({
              instanceId: p.instanceId,
              onCreate: skillTemplate =>
                navigate(Paths.instance.skillTemplate(...pathParams, skillTemplate.id))
            })
        }
      ]}
    >
      Create Skill
    </Button>
  );
};

let skillStartSuggestions = [
  {
    id: 'review',
    label: 'Code review',
    prompt:
      'A skill that reviews pull requests against our conventions: check naming, error handling and test coverage, and summarize findings by severity.'
  },
  {
    id: 'support',
    label: 'Support replies',
    prompt:
      'A skill that drafts customer support replies in a friendly, concise tone, using our product docs to answer and escalating billing questions.'
  },
  {
    id: 'release',
    label: 'Release notes',
    prompt:
      'A skill that turns a list of merged changes into release notes grouped by feature, fix and breaking change.'
  }
];

let provisionalSkillName = (description: string) => {
  let firstLine = description.split('\n')[0]!.trim();
  return firstLine.length > 60 ? `${firstLine.slice(0, 57).trim()}...` : firstLine;
};

let CreateSkillWithAgent = (p: { instanceId: string }) => {
  let createSkill = useCreateSkill();
  let navigate = useNavigate();
  let pathParams = usePathParams();

  return (
    <div style={{ marginBottom: 32 }}>
      <SkillStartInput
        title="What skill do you want to create?"
        placeholder="Describe the skill you want. What should it do, and when should an agent use it?"
        suggestions={skillStartSuggestions}
        onSubmit={async description => {
          let [skill, error] = await createSkill.mutate({
            instanceId: p.instanceId,
            name: provisionalSkillName(description)
          });
          if (error || !skill) {
            throw new Error(error?.data.message ?? 'Unable to create the skill.');
          }

          queueSkillAssistantPrompt(
            skill.id,
            `${description}\n\nSet a fitting name and description for this skill, then write SKILL.md and any other files it needs.`
          );
          navigate(Paths.instance.skill(...pathParams, skill.id));
        }}
      />
    </div>
  );
};

let SkillsEmptyState = () => {
  let ctx = useInstanceContext();
  let navigate = useNavigate();
  let pathParams = usePathParams();

  return (
    <EmptyState
      extra="Skills"
      title="Create your first skill"
      description="Skills let you extend integrations with documents, custom logic, and resources to create advanced agent workflows."
      action={{
        label: 'Create Skill',
        onClick: () => {
          if (!ctx.instanceId) return;

          showSkillFormModal({
            instanceId: ctx.instanceId,
            onCreate: skill => navigate(Paths.instance.skill(...pathParams, skill.id))
          });
        }
      }}
    />
  );
};

let SkillsGridLayout = ({ items, getItemProps }: DataListLayoutRenderArgs<Skill>) => {
  let { instanceId } = useInstanceContext();
  let pathParams = usePathParams();

  let pinned = useInstancePinnedSkills({ instanceId });
  let previews = useSkillContentPreviews(
    instanceId,
    items.map(skill => skill.id)
  );

  return (
    <ItemGrid.Root width="232px">
      {items.map(skill => {
        let isPinned = pinned.has(skill.id);

        return (
          <li key={skill.id}>
            <SkillPreviewCard
              skill={skill}
              content={previews.data ? previews.getContent(skill.id) : undefined}
              href={Paths.instance.skill(...pathParams, skill.id)}
              isPinned={isPinned}
              menu={[
                isPinned
                  ? { label: 'Unpin', onClick: () => pinned.remove(skill.id) }
                  : { label: 'Pin', onClick: () => pinned.add(skill.id) },
                ...getItemProps(skill).menu.map(item => ({
                  label: item.label,
                  onClick: item.onClick
                }))
              ]}
            />
          </li>
        );
      })}
    </ItemGrid.Root>
  );
};

let SkillsList = createDataList('skills')
  .context(useInstanceContext)
  .filters((_props, ctx) => ({
    status: f.status(lifecycleStatus, { only: ['active', 'archived'] }),
    skillGroupId: f.entity(entityFilters.skillGroup(ctx.instanceId)),
    providerId: f.entity(entityFilters.provider(ctx.instanceId)),
    integrationId: f.entity(entityFilters.integration(ctx.instanceId)),
    createdAt: f.createdAt(),
    updatedAt: f.updatedAt()
  }))
  .search('Search skills…')
  .paginated(({ ctx, filters, search }) =>
    useSkills(
      ctx.instanceId,
      withDefaults(
        { order: 'desc' as const, limit: skillsPageSize, status: ['active' as const] },
        { ...filters, search }
      )
    )
  )
  .columns([
    col.custom<Skill>({
      id: 'name',
      header: 'Name',
      render: skill => (
        <ListName>
          <SkillIconTile image={skill.image} imageUrl={skill.imageUrl} size={20} />
          <Text size="2" weight="strong">
            {skill.name}
          </Text>
        </ListName>
      )
    }),
    col.text<Skill>({
      id: 'description',
      header: 'Description',
      isDefault: false,
      get: skill => skill.description
    }),
    col.text<Skill>({
      id: 'slug',
      header: 'Slug',
      isDefault: false,
      get: skill => skill.slug
    }),
    col.createdAt<Skill>({ isDefault: false }),
    col.updatedAt<Skill>({ isDefault: true }),
    col.id<Skill>()
  ])
  .link((skill, _props, ctx) =>
    Paths.instance.skill(ctx.organization, ctx.project, ctx.instance, skill.id)
  )
  .layouts(['grid', 'table'], { default: 'grid' })
  .layout('grid', {
    label: 'Grid',
    render: args => <SkillsGridLayout {...args} />
  })
  .build();

export let SkillsPage = () => {
  let currentInstance = useCurrentInstance();

  return renderWithLoader({ instance: currentInstance })(({ instance }) => (
    <ContentLayout>
      <PageHeader
        title="Skills"
        description="Create reusable skills that extend integrations with documents, custom logic, and resources."
        actions={<CreateSkillButton instanceId={instance.data.id} />}
      />

      <CreateSkillWithAgent instanceId={instance.data.id} />

      <SkillsList
        emptyState={{
          initial: () => <SkillsEmptyState />,
          filtered: 'No skills match your search.'
        }}
      />
    </ContentLayout>
  ));
};
