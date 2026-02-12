import { Input, Spacer } from '@metorial/ui';
import { useState } from 'react';
import { useDebounced } from '../../../../../hooks/useDebounced';
import { ServersGrid } from '../../../scenes/servers/grid';

export let ProvidersPage = () => {
  let [search, setSearch] = useState('');
  let searchDebounced = useDebounced(search, 500);

  return (
    <>
      <Input
        label="Search"
        hideLabel
        placeholder="Search for providers..."
        value={search}
        onChange={e => setSearch(e.target.value)}
      />

      <Spacer size={15} />

      <ServersGrid search={searchDebounced} orderByRank />
    </>
  );
};
