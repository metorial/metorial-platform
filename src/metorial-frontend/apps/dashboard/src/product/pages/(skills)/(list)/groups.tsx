import { renderWithLoader } from '@metorial/data-hooks';
import { Paths } from '@metorial/frontend-config';
import { ContentLayout, PageHeader } from '@metorial/layout';
import {
  useCurrentInstance,
  useCurrentOrganization,
  useCurrentProject
} from '@metorial/state';
import { TableFilterState, useFilterQuery } from '@metorial/table';
import { Button } from '@metorial/ui';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { SkillResourceFilters, useSkillGroupFilters } from '../../../scenes/skills/filters';
import { SkillGroupsGrid } from '../../../scenes/skills/groupGrid';
import { showSkillGroupFormModal } from '../../../scenes/skills/groupModal';

export let SkillGroupsPage = () => {
  let instance = useCurrentInstance();
  let organization = useCurrentOrganization();
  let project = useCurrentProject();
  let navigate = useNavigate();
  let [search, setSearch] = useState('');
  let [filterState, setFilterState] = useState<TableFilterState[]>([]);
  let { filters, searchDebounced, skillGroupsFilter } = useSkillGroupFilters({
    search,
    filterState
  });

  useFilterQuery({
    filters,
    filterState: [filterState, setFilterState],
    searchState: [search, setSearch],
    debouncedSearch: searchDebounced
  });

  return renderWithLoader({ instance })(({ instance }) => (
    <ContentLayout>
      <PageHeader
        title="Skill Groups"
        description="Groups let you organize related skills and manage them as a set."
        actions={
          <Button
            size="2"
            onClick={() =>
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
              })
            }
          >
            Create Group
          </Button>
        }
      />

      <SkillResourceFilters
        searchState={[search, setSearch]}
        filterState={[filterState, setFilterState]}
        filters={filters}
        placeholder="Search groups..."
      />

      <SkillGroupsGrid instanceId={instance.data.id} {...skillGroupsFilter} />
    </ContentLayout>
  ));
};
