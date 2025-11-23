import { ContentLayout } from '@metorial/layout/src/components/content';
import { PageHeader } from '@metorial/layout/src/components/header';
import { Input, Spacer } from '@metorial/ui';
import { useState } from 'react';
import { useDebounced } from '../../../../hooks/useDebounced';
import { ServersGrid } from '../../../../scenes/servers/grid';
import { usePortal } from '../../../../state/portal/client';

export let ServersPage = () => {
  let [search, setSearch] = useState('');
  let searchDebounced = useDebounced(search, 500);
  let portal = usePortal();

  return (
    <ContentLayout>
      <PageHeader
        title="Servers"
        description={`Explore and deploy the servers available in your ${portal.data?.name} portal.`}
      />

      <Input
        label="Search"
        hideLabel
        placeholder="Search for MCP servers..."
        value={search}
        onChange={e => setSearch(e.target.value)}
      />

      <Spacer size={15} />

      <ServersGrid
        limit={50}
        orderByRank
        search={searchDebounced}
        collectionId={
          searchDebounced
            ? undefined
            : (window as any).metorial_enterprise?.landing_collection_ids
        }
      />
    </ContentLayout>
  );
};
