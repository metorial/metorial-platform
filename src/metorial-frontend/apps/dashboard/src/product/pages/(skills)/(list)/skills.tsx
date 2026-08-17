import type {
  DashboardInstanceSkillsListOutput,
  DashboardInstanceSkillsListQuery
} from '@metorial/dashboard-sdk';
import { renderWithLoader } from '@metorial/data-hooks';
import { Paths } from '@metorial/frontend-config';
import { ContentLayout, PageHeader } from '@metorial/layout';
import { showScmRepositoryPicker } from '@metorial/scene-scm';
import { useSkillImportActions } from '@metorial/scene-skills';
import {
  useCurrentInstance,
  useCurrentOrganization,
  useCurrentProject,
  useDuplicateSkill,
  useSkills
} from '@metorial/state';
import { Avatar, Badge, Button, RenderDate, Text } from '@metorial/ui';
import { ID } from '@metorial/ui-product';
import { RiFileCopyLine } from '@remixicon/react';
import { useNavigate } from 'react-router-dom';
import { styled } from 'styled-components';
import { EmptyState } from '@metorial/empty-state';
import { Table as DashboardTable } from '@metorial/table';
import {
  FilterPayload,
  TableFilter,
  TableStateProvider,
  TableStateProviderResult,
  getDateRangeFilterValue,
  getEnumListFilterValue,
  getStringFilterValue
} from '@metorial/table';
import { useSkillFilters } from '../../../scenes/skills/filters';
import { showSkillCloneFormModal } from '../../../scenes/skills/cloneModal';
import { showSkillFormModal } from '../../../scenes/skills/modal';
import { showSkillTemplateFormModal } from '../../../scenes/skills/templateModal';

type Skill = DashboardInstanceSkillsListOutput['items'][number];

type SkillsTableProps = {
  instanceId: string;
  organization: ReturnType<typeof useCurrentOrganization>;
  project: ReturnType<typeof useCurrentProject>;
  instance: ReturnType<typeof useCurrentInstance>;
};

let Name = styled.div`
  display: flex;
  align-items: center;
  gap: 9px;
  min-width: 220px;
`;

let Creator = styled.div`
  display: flex;
  align-items: center;
  gap: 7px;
`;

let getStatusFilterValue = (
  value: FilterPayload | undefined
): DashboardInstanceSkillsListQuery['status'] =>
  getEnumListFilterValue(value, ['active', 'archived', 'deleted']);

let skillsTableState: TableStateProvider<
  SkillsTableProps,
  Skill,
  TableStateProviderResult<Skill>
> = (props, opts) => {
  let skills = useSkills(props.instanceId, {
    order: 'desc',
    limit: 70,
    status: getStatusFilterValue(opts.filter.status) ?? ['active'],
    providerId: getStringFilterValue(opts.filter.providerId),
    integrationId: getStringFilterValue(opts.filter.integrationId),
    skillGroupId: getStringFilterValue(opts.filter.skillGroupId),
    createdAt: getDateRangeFilterValue(opts.filter.createdAt),
    updatedAt: getDateRangeFilterValue(opts.filter.updatedAt),
    search: opts.search
  });

  return {
    isLoading: skills.isLoading,
    error: skills.error,
    hasMoreAfter: skills.data?.pagination.hasMoreAfter ?? false,
    hasMoreBefore: skills.data?.pagination.hasMoreBefore ?? false,
    items: skills.data?.items ?? [],
    loadNext: skills.next,
    loadPrevious: skills.previous
  };
};

let getStatusColor = (status: Skill['status']) => {
  if (status == 'active') return 'green';
  if (status == 'archived') return 'orange';
  return 'gray';
};

let skillsTable = new DashboardTable<SkillsTableProps, Skill>('skills')
  .state(skillsTableState)
  .hookState((_, props) => ({
    duplicateSkill: useDuplicateSkill(),
    navigate: useNavigate(),
    ...props
  }))
  .columns([
    {
      id: 'name',
      isDefault: true,
      header: 'Name',
      render: skill => (
        <Name>
          <Avatar
            entity={{ name: skill.name, imageUrl: skill.imageUrl }}
            size={28}
            noTooltip
            imageFit="contain"
          />
          <Text size="2" weight="strong">
            {skill.name}
          </Text>
        </Name>
      )
    },
    {
      id: 'slug',
      isDefault: true,
      header: 'Identifier',
      render: skill => <ID id={skill.slug} />
    },
    {
      id: 'createdAt',
      isDefault: true,
      header: 'Created',
      render: skill => <RenderDate date={skill.createdAt} />
    },
    {
      id: 'description',
      isDefault: false,
      header: 'Description',
      render: skill => (
        <Text size="2" color={skill.description ? undefined : 'gray600'}>
          {skill.description || '—'}
        </Text>
      )
    },
    {
      id: 'creator',
      isDefault: false,
      header: 'Created by',
      render: skill =>
        skill.hierarchy.creator ? (
          <Creator>
            <Avatar
              entity={{
                name: skill.hierarchy.creator.name,
                imageUrl: skill.hierarchy.creator.imageUrl
              }}
              size={24}
              noTooltip
            />
            <Text size="2">{skill.hierarchy.creator.name}</Text>
          </Creator>
        ) : (
          <Text size="2" color="gray600">
            —
          </Text>
        )
    },
    {
      id: 'status',
      isDefault: false,
      header: 'Status',
      render: skill => <Badge color={getStatusColor(skill.status)}>{skill.status}</Badge>
    },
    {
      id: 'providers',
      isDefault: false,
      header: 'Providers',
      render: skill => (
        <Text size="2">
          {skill.providers.length} {skill.providers.length == 1 ? 'provider' : 'providers'}
        </Text>
      )
    },
    {
      id: 'integrations',
      isDefault: false,
      header: 'Integrations',
      render: skill => (
        <Text size="2">
          {skill.integrations.length}{' '}
          {skill.integrations.length == 1 ? 'integration' : 'integrations'}
        </Text>
      )
    },
    {
      id: 'updatedAt',
      isDefault: false,
      header: 'Updated',
      render: skill => <RenderDate date={skill.updatedAt} />
    },
    {
      id: 'id',
      isDefault: false,
      header: 'Skill ID',
      render: skill => <ID id={skill.id} />
    }
  ])
  .search('Search skills...')
  .link((skill, props) =>
    Paths.instance.skill(
      props.organization.data,
      props.project.data,
      props.instance.data,
      skill.id
    )
  )
  .actions({
    duplicate: async (skills, state) => {
      let skill = skills[0];
      if (!skill) return;

      showSkillCloneFormModal({
        title: 'Duplicate Skill',
        description: 'Choose a name and description for the duplicated skill.',
        submitLabel: 'Duplicate Skill',
        initialName: `Copy of ${skill.name}`,
        initialDescription: skill.description,
        onSubmit: async values => {
          let [duplicatedSkill] = await state.duplicateSkill.mutate({
            instanceId: state.instanceId,
            skillId: skill.id,
            name: values.name,
            description: values.description
          });

          if (!duplicatedSkill) return false;

          state.navigate(
            Paths.instance.skill(
              state.organization.data,
              state.project.data,
              state.instance.data,
              duplicatedSkill.id
            )
          );
        }
      });
    }
  })
  .rowActions([
    {
      id: 'duplicate',
      label: 'Duplicate Skill',
      icon: <RiFileCopyLine />,
      action: 'duplicate'
    }
  ])
  .build();

export let SkillsPage = () => {
  let currentInstance = useCurrentInstance();
  let organization = useCurrentOrganization();
  let project = useCurrentProject();
  let navigate = useNavigate();
  let { filters } = useSkillFilters({ search: '', filterState: [] });
  let listPathParams = [organization.data, project.data, currentInstance.data] as const;
  let skillImport = useSkillImportActions({
    instanceId: currentInstance.data?.id ?? '',
    getSkillPath: skillId => Paths.instance.skill(...listPathParams, skillId)
  });

  return renderWithLoader({ instance: currentInstance })(({ instance }) => (
    <ContentLayout>
      <PageHeader
        title="Skills"
        description="Create reusable skills that extend integrations with documents, custom logic, and resources."
        actions={
          <Button
            size="2"
            onClick={() =>
              showSkillFormModal({
                instanceId: instance.data.id,
                onCreate: skill => {
                  navigate(Paths.instance.skill(...listPathParams, skill.id));
                }
              })
            }
            menu={[
              {
                label: 'Import Skill',
                onClick: () => {
                  showScmRepositoryPicker({
                    instanceId: instance.data.id,
                    allowPublicUrl: true,
                    title: 'Import skills',
                    description:
                      'Select a connected repository or enter a public GitHub, GitLab, or Bitbucket repository URL.',
                    onManageSourceControl: () => {
                      if (!organization.data || !project.data) return;
                      window.location.href = `/o/${organization.data.slug}/project/${project.data.slug}/scm`;
                    },
                    onSelect: async repository => {
                      return skillImport.createImport({
                        type: 'origin',
                        repositoryId: repository.id
                      });
                    },
                    onSelectPublicUrl: async repositoryUrl => {
                      return skillImport.createImport({
                        type: 'public',
                        repositoryUrl
                      });
                    },
                    selectionError: <skillImport.RenderError />
                  });
                }
              },
              {
                label: 'Upload Skill',
                onClick: skillImport.uploadSkill
              },
              {
                label: 'Create Template',
                onClick: () =>
                  showSkillTemplateFormModal({
                    instanceId: instance.data.id,
                    onCreate: skillTemplate => {
                      navigate(Paths.instance.skillTemplate(...listPathParams, skillTemplate.id));
                    }
                  })
              }
            ]}
          >
            Create Skill
          </Button>
        }
      />

      {skillsTable({
        instanceId: instance.data.id,
        organization,
        project,
        instance: currentInstance,
        tableFilters: filters as TableFilter<Skill>[],
        emptyState: () => (
          <EmptyState
            extra="Skills"
            title="Create your first skill"
            description="Skills let you extend integrations with documents, custom logic, and resources to create advanced agent workflows."
            action={{
              label: 'Create Skill',
              onClick: () =>
                showSkillFormModal({
                  instanceId: instance.data.id,
                  onCreate: skill =>
                    navigate(
                      Paths.instance.skill(
                        organization.data,
                        project.data,
                        currentInstance.data,
                        skill.id
                      )
                    )
                })
            }}
          />
        )
      })}
    </ContentLayout>
  ));
};
