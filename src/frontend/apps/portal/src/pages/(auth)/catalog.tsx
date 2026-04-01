import { renderWithPagination } from '@metorial/data-hooks';
import { ContentLayout, PageHeader } from '@metorial/layout';
import { Input, Spacer } from '@metorial/ui';
import { useState } from 'react';
import { CatalogGrid } from '../../scenes/catalog/cards';
import { useDebounced } from '../../hooks/useDebounced';
import { useProviderCatalog } from '../../state/consumer/catalog';

export let CatalogPage = () => {
  let [search, setSearch] = useState('');
  let searchDebounced = useDebounced(search, 250);
  let catalog = useProviderCatalog({
    search: searchDebounced
  });

  return renderWithPagination(catalog)(catalog => (
    <ContentLayout>
      <Spacer height={28} />

      <PageHeader
        title="Provider catalog"
        description="Published provider templates and Magic MCP deployments available through this portal."
      />

      <Spacer height={18} />

      <Input
        label="Search the portal catalog"
        hideLabel
        placeholder="Search providers, templates, or deployments"
        value={search}
        onChange={event => setSearch(event.target.value)}
      />

      <Spacer height={18} />

      <CatalogGrid items={catalog.data.items} />

      <Spacer height={30} />
    </ContentLayout>
  ));
};
