import type {
  DashboardInstanceSkillsListOutput,
  DashboardInstanceSkillsListQuery
} from '@metorial/dashboard-sdk';
import {
  col,
  createDataList,
  defineAction,
  deleteAction,
  f,
  lifecycleStatus,
  withDefaults,
  type DataListLayoutRenderArgs,
  type PaginatedLoaderResult
} from '@metorial/data-list';
import { EmptyState } from '@metorial/empty-state';
import { Paths } from '@metorial/frontend-config';
import { showScmRepositoryPicker } from '@metorial/scene-scm';
import {
  CreateSkillWithAgent as SharedCreateSkillWithAgent,
  SkillIconTile,
  SkillPreviewCard,
  useSkillImportActions
} from '@metorial/scene-skills';
import {
  useCurrentInstance,
  useCurrentOrganization,
  useAddSkillToSkillGroupIfMissing,
  useCurrentProject,
  useDeleteSkill,
  useInstancePinnedSkills,
  useSkillContentPreviews,
  useSkills
} from '@metorial/state';
import { Button, Text } from '@metorial/ui';
import { ItemGrid } from '@metorial/ui-product';
import { createContext, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { styled } from 'styled-components';
import { useInstanceContext } from '../../../lib/dataList';
import { entityFilters } from '../../entityFilters';
import { showSkillGroupPickerModal } from '../groupPickerModal';
import { showSkillFormModal } from '../modal';
import { showSkillTemplateFormModal } from '../templateModal';
import { skillViewFilter, type SkillView } from './skillViews';

let skillsPageSize = 48;

type Skill = DashboardInstanceSkillsListOutput['items'][number];

export type SkillsListItemMenu = (skill: Skill) => { label: string; onClick: () => void }[];

let SkillsListItemMenuContext = createContext<SkillsListItemMenu | null>(null);

export let SkillsListItemMenuProvider = SkillsListItemMenuContext.Provider;

let ListName = styled.div`
  display: flex;
  align-items: center;
  gap: 9px;
  min-width: 200px;
`;

export let useSkillPathParams = () => {
  let organization = useCurrentOrganization();
  let project = useCurrentProject();
  let instance = useCurrentInstance();

  return [organization.data, project.data, instance.data] as const;
};

export let CreateSkillWithAgent = (p: { instanceId: string }) => {
  let pathParams = useSkillPathParams();

  return (
    <SharedCreateSkillWithAgent
      instanceId={p.instanceId}
      getSkillPath={skillId => Paths.instance.skill(...pathParams, skillId)}
    />
  );
};

export let CreateSkillButton = (p: { instanceId: string; skillGroupId?: string }) => {
  let organization = useCurrentOrganization();
  let project = useCurrentProject();
  let navigate = useNavigate();
  let pathParams = useSkillPathParams();

  let skillImport = useSkillImportActions({
    instanceId: p.instanceId,
    skillGroupId: p.skillGroupId,
    getSkillPath: skillId => Paths.instance.skill(...pathParams, skillId)
  });

  return (
    <Button
      size="2"
      onClick={() =>
        showSkillFormModal({
          instanceId: p.instanceId,
          skillGroupId: p.skillGroupId,
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
        ...(p.skillGroupId
          ? []
          : [
              {
                label: 'Create Template',
                onClick: () =>
                  showSkillTemplateFormModal({
                    instanceId: p.instanceId,
                    onCreate: skillTemplate =>
                      navigate(Paths.instance.skillTemplate(...pathParams, skillTemplate.id))
                  })
              }
            ])
      ]}
    >
      Create Skill
    </Button>
  );
};

export let SkillsEmptyState = () => {
  let ctx = useInstanceContext();
  let navigate = useNavigate();
  let pathParams = useSkillPathParams();

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

let SkillsGridLayout = ({
  items,
  getItemProps,
  toggleSelected
}: DataListLayoutRenderArgs<Skill>) => {
  let { instanceId } = useInstanceContext();
  let pathParams = useSkillPathParams();
  let getExtraMenu = useContext(SkillsListItemMenuContext);

  let favorites = useInstancePinnedSkills({ instanceId });
  let previews = useSkillContentPreviews(instanceId, {
    skillIds: items.map(skill => skill.id)
  });

  return (
    <ItemGrid.Root width="220px">
      {items.map(skill => {
        let isFavorite = favorites.has(skill.id);

        return (
          <li key={skill.id}>
            <SkillPreviewCard
              item={skill}
              content={previews.data ? previews.getContent(skill.id) : undefined}
              href={Paths.instance.skill(...pathParams, skill.id)}
              isFavorite={isFavorite}
              isSelected={getItemProps(skill).isSelected}
              onToggleSelect={range => toggleSelected(skill.id, range)}
              menu={[
                isFavorite
                  ? {
                      label: 'Remove From Favorites',
                      onClick: () => favorites.remove(skill.id)
                    }
                  : { label: 'Add to Favorites', onClick: () => favorites.add(skill.id) },
                ...(getExtraMenu?.(skill) ?? []),
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

let useSkillsForView = (
  instanceId: string | undefined,
  view: SkillView | undefined,
  query: DashboardInstanceSkillsListQuery
): PaginatedLoaderResult<Skill> => {
  let favorites = useInstancePinnedSkills({ instanceId });
  let showFavorites = view == 'favorites';
  let hasFavorites = favorites.isReady && favorites.items.length > 0;

  let skills = useSkills(
    showFavorites && !hasFavorites ? null : instanceId,
    showFavorites
      ? { ...query, id: favorites.items }
      : view == 'mine'
        ? { ...query, ownedByMe: true }
        : query
  );

  if (!showFavorites || hasFavorites) return skills;
  if (!favorites.isReady) return { ...skills, isLoading: true };

  return {
    ...skills,
    isLoading: false,
    error: null,
    data: { items: [], pagination: { hasMoreAfter: false, hasMoreBefore: false } }
  };
};

export let SkillsList = createDataList<{ skillGroupId?: string }>('skills', {
  hidePaginationWhenUnavailable: true
})
  .context(useInstanceContext)
  .filters((props, ctx) => ({
    view: skillViewFilter({ withTemplates: !props.skillGroupId }),
    status: f.status(lifecycleStatus, { only: ['active', 'archived'] }),
    ...(props.skillGroupId
      ? {}
      : { skillGroupId: f.entity(entityFilters.skillGroup(ctx.instanceId)) }),
    providerId: f.entity(entityFilters.provider(ctx.instanceId)),
    integrationId: f.entity(entityFilters.integration(ctx.instanceId)),
    createdAt: f.createdAt(),
    updatedAt: f.updatedAt()
  }))
  .search('Search skills…')
  .paginated(({ props, ctx, filters: { view, ...filters }, search }) =>
    useSkillsForView(
      ctx.instanceId,
      view?.[0],
      withDefaults(
        { order: 'desc' as const, limit: skillsPageSize, status: ['active' as const] },
        {
          ...filters,
          ...(props.skillGroupId ? { skillGroupId: [props.skillGroupId] } : {}),
          search
        }
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
  .itemActions([
    defineAction<Skill>({
      id: 'add-to-group',
      label: 'Add to Group',
      row: false,
      bulk: { batchSize: 5 },
      bulkInput: (_rows, { ctx }) =>
        new Promise<string | null>(resolve => {
          if (!ctx.instanceId) return resolve(null);

          showSkillGroupPickerModal({
            instanceId: ctx.instanceId,
            onSelect: groupId => resolve(groupId),
            onCancel: () => resolve(null)
          });
        }),
      useOnComplete: ({ ctx }) => {
        let navigate = useNavigate();

        return ({ input, failures, rows }) => {
          if (failures >= rows.length) return;

          navigate(
            Paths.instance.skillGroup(ctx.organization, ctx.project, ctx.instance, input)
          );
        };
      },
      useRun: ({ ctx }) => {
        let createItem = useAddSkillToSkillGroupIfMissing();

        return async (skill, skillGroupId: string) => {
          let [, error] = await createItem.mutate({
            instanceId: ctx.instanceId!,
            skillGroupId,
            skillId: skill.id
          });
          if (error) throw error;
        };
      }
    }),
    deleteAction<Skill>({
      noun: 'Skill',
      name: skill => skill.name,
      useMutate: () => useDeleteSkill(),
      input: (skill, { ctx }) => ({ instanceId: ctx.instanceId!, skillId: skill.id })
    })
  ])
  .layouts(['grid', 'table'], { default: 'grid' })
  .layout('grid', {
    label: 'Grid',
    render: args => <SkillsGridLayout {...args} />
  })
  .build();
