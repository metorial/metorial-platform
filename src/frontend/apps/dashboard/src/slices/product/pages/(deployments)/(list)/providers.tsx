import { Input, Spacer } from '@metorial/ui';
import { useState } from 'react';
import { useDebounced } from '../../../../../hooks/useDebounced';
import { ProvidersGrid } from '../../../scenes/providers/grid_';

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
        onInput={setSearch}
      />

      <Spacer size={15} />

      <ProvidersGrid search={searchDebounced} limit={21} />
    </>
  );
};
