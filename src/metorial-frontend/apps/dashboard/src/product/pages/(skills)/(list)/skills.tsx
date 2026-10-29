import { renderWithLoader, renderWithPagination } from '@metorial/data-hooks';
import { EmptyState } from '@metorial/empty-state';
import { Paths } from '@metorial/frontend-config';
import { ContentLayout, PageHeader } from '@metorial/layout';
import { showScmRepositoryPicker } from '@metorial/scene-scm';
import { SkillIconTile, useSkillImportActions } from '@metorial/scene-skills';
import {
  useCurrentInstance,
  useCurrentOrganization,
  useCurrentProject,
  useInstancePinnedSkills,
  useSkillContentPreviews,
  useSkillGroups,
  useSkills
} from '@metorial/state';
import { Button, Input, OptionToggle, RenderDate, Select, Text } from '@metorial/ui';
import { ItemGrid, Table } from '@metorial/ui-product';
import { useDebounced } from '@metorial/use-debounced';
import { RiGridLine, RiListUnordered } from '@remixicon/react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { styled } from 'styled-components';
import { SkillPreviewCard } from '../../../scenes/skills/overview/skillPreviewCard';
import { showSkillFormModal } from '../../../scenes/skills/modal';
import { showSkillTemplateFormModal } from '../../../scenes/skills/templateModal';

let allGroupsTab = 'all';
let searchDebounceMs = 300;
let skillsPageSize = 48;

type SkillsView = 'grid' | 'list';

let Toolbar = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 24px;

  @media (max-width: 720px) {
    flex-wrap: wrap;
  }
`;

let GroupField = styled.div`
  width: 200px;
  flex: 0 0 auto;
`;

let SearchField = styled.div`
  flex: 1 1 auto;
  min-width: 0;
`;

let ViewField = styled.div`
  flex: 0 0 auto;
`;

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

let GroupFilter = (p: {
  instanceId: string;
  current: string;
  onChange: (id: string) => void;
}) => {
  let groups = useSkillGroups(p.instanceId, { limit: 100 });

  return (
    <GroupField>
      <Select
        label="Group"
        hideLabel
        size="3"
        value={p.current}
        onChange={p.onChange}
        items={[
          { id: allGroupsTab, label: 'All Groups' },
          ...(groups.data?.items ?? []).map(group => ({ id: group.id, label: group.name }))
        ]}
      />
    </GroupField>
  );
};

let SkillsCollection = (p: {
  instanceId: string;
  search: string;
  skillGroupId: string | undefined;
  view: SkillsView;
}) => {
  let organization = useCurrentOrganization();
  let navigate = useNavigate();
  let pathParams = usePathParams();

  let skills = useSkills(p.instanceId, {
    order: 'desc',
    limit: skillsPageSize,
    status: ['active'],
    search: p.search || undefined,
    skillGroupId: p.skillGroupId
  });
  let pinned = useInstancePinnedSkills(organization.data?.id, p.instanceId);
  let previews = useSkillContentPreviews(
    p.view == 'grid' ? p.instanceId : null,
    (skills.data?.items ?? []).map(skill => skill.id)
  );

  let isFiltered = !!p.search || !!p.skillGroupId;

  return renderWithPagination(skills, {
    emptyState: isFiltered ? (
      <Text size="2" color="gray600">
        No skills match your search.
      </Text>
    ) : (
      <EmptyState
        extra="Skills"
        title="Create your first skill"
        description="Skills let you extend integrations with documents, custom logic, and resources to create advanced agent workflows."
        action={{
          label: 'Create Skill',
          onClick: () =>
            showSkillFormModal({
              instanceId: p.instanceId,
              onCreate: skill => navigate(Paths.instance.skill(...pathParams, skill.id))
            })
        }}
      />
    )
  })(skills => {
    if (!skills.data.items.length) return null;

    if (p.view == 'list') {
      return (
        <Table
          headers={['Name', 'Updated']}
          data={skills.data.items.map(skill => ({
            href: Paths.instance.skill(...pathParams, skill.id),
            data: [
              <ListName>
                <SkillIconTile image={skill.image} imageUrl={skill.imageUrl} size={20} />
                <Text size="2" weight="strong">
                  {skill.name}
                </Text>
              </ListName>,
              <RenderDate date={skill.updatedAt} format="date" />
            ]
          }))}
        />
      );
    }

    return (
      <ItemGrid.Root width="232px">
        {skills.data.items.map(skill => {
          let isPinned = pinned.isPinned(skill.id);

          return (
            <li key={skill.id}>
              <SkillPreviewCard
                skill={skill}
                content={previews.data ? previews.getContent(skill.id) : undefined}
                href={Paths.instance.skill(...pathParams, skill.id)}
                isPinned={isPinned}
                menu={[
                  isPinned
                    ? { label: 'Unpin', onClick: () => pinned.unpin(skill.id) }
                    : { label: 'Pin', onClick: () => pinned.pin(skill.id) }
                ]}
              />
            </li>
          );
        })}
      </ItemGrid.Root>
    );
  });
};

export let SkillsPage = () => {
  let currentInstance = useCurrentInstance();
  let [searchParams, setSearchParams] = useSearchParams();

  let search = searchParams.get('search') ?? '';
  let groupId = searchParams.get('group') ?? allGroupsTab;
  let view: SkillsView = searchParams.get('view') == 'list' ? 'list' : 'grid';
  let debouncedSearch = useDebounced(search, searchDebounceMs);

  let setParam = (key: string, value: string | null) =>
    setSearchParams(
      params => {
        if (value) params.set(key, value);
        else params.delete(key);
        return params;
      },
      { replace: true }
    );

  return renderWithLoader({ instance: currentInstance })(({ instance }) => (
    <ContentLayout>
      <PageHeader
        title="Skills"
        description="Create reusable skills that extend integrations with documents, custom logic, and resources."
        actions={<CreateSkillButton instanceId={instance.data.id} />}
      />

      <Toolbar>
        <GroupFilter
          instanceId={instance.data.id}
          current={groupId}
          onChange={id => setParam('group', id == allGroupsTab ? null : id)}
        />

        <SearchField>
          <Input
            label="Search"
            hideLabel
            size="3"
            placeholder="Search skills..."
            value={search}
            onInput={value => setParam('search', value)}
          />
        </SearchField>

        <ViewField>
          <OptionToggle
            ariaLabel="View"
            size="1"
            itemMinWidth={0}
            value={view}
            onChange={value => setParam('view', value == 'list' ? 'list' : null)}
            items={[
              { id: 'grid', label: 'Grid', iconLeft: <RiGridLine /> },
              { id: 'list', label: 'List', iconLeft: <RiListUnordered /> }
            ]}
          />
        </ViewField>
      </Toolbar>

      <SkillsCollection
        instanceId={instance.data.id}
        search={debouncedSearch}
        skillGroupId={groupId == allGroupsTab ? undefined : groupId}
        view={view}
      />
    </ContentLayout>
  ));
};
