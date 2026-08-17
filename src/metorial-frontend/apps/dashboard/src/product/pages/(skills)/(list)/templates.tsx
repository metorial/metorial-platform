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
import { SkillResourceFilters, useSkillTemplateFilters } from '../../../scenes/skills/filters';
import { SkillTemplatesGrid } from '../../../scenes/skills/templateGrid';
import { showSkillTemplateFormModal } from '../../../scenes/skills/templateModal';

export let SkillTemplatesPage = () => {
  let instance = useCurrentInstance();
  let organization = useCurrentOrganization();
  let project = useCurrentProject();
  let navigate = useNavigate();
  let [search, setSearch] = useState('');
  let [filterState, setFilterState] = useState<TableFilterState[]>([]);
  let { filters, searchDebounced, skillTemplatesFilter } = useSkillTemplateFilters({
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
        title="Skill Templates"
        description="Templates let you reuse files, providers, and integrations when creating new skills."
        actions={
          <Button
            size="2"
            onClick={() =>
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
              })
            }
          >
            Create Template
          </Button>
        }
      />

      <SkillResourceFilters
        searchState={[search, setSearch]}
        filterState={[filterState, setFilterState]}
        filters={filters}
        placeholder="Search templates..."
      />

      <SkillTemplatesGrid instanceId={instance.data.id} {...skillTemplatesFilter} />
    </ContentLayout>
  ));
};
