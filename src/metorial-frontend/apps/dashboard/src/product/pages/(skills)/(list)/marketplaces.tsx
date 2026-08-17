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
import {
  SkillResourceFilters,
  useSkillMarketplaceFilters
} from '../../../scenes/skills/filters';
import { SkillMarketplacesGrid } from '../../../scenes/skills/marketplaceGrid';
import { showSkillMarketplaceFormModal } from '../../../scenes/skills/marketplaceModal';

export let SkillMarketplacesPage = () => {
  let instance = useCurrentInstance();
  let organization = useCurrentOrganization();
  let project = useCurrentProject();
  let navigate = useNavigate();
  let [search, setSearch] = useState('');
  let [filterState, setFilterState] = useState<TableFilterState[]>([]);
  let { filters, searchDebounced, skillMarketplacesFilter } = useSkillMarketplaceFilters({
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
        title="Skill Marketplaces"
        description="Marketplaces let you publish selected plugins and skills to your users."
        actions={
          <Button
            size="2"
            onClick={() =>
              showSkillMarketplaceFormModal({
                instanceId: instance.data.id,
                onCreate: marketplace => {
                  navigate(
                    Paths.instance.skillMarketplace(
                      organization.data,
                      project.data,
                      instance.data,
                      marketplace.id
                    )
                  );
                }
              })
            }
          >
            Create Marketplace
          </Button>
        }
      />

      <SkillResourceFilters
        searchState={[search, setSearch]}
        filterState={[filterState, setFilterState]}
        filters={filters}
        placeholder="Search marketplaces..."
      />

      <SkillMarketplacesGrid instanceId={instance.data.id} {...skillMarketplacesFilter} />
    </ContentLayout>
  ));
};
