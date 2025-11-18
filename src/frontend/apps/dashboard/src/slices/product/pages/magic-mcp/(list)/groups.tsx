import { renderWithLoader } from '@metorial/data-hooks';
import { useCurrentInstance } from '@metorial/state';
import { Input, Spacer } from '@metorial/ui';
import { useState } from 'react';
import { useDebounced } from '../../../../../hooks/useDebounced';
import { MagicGroupsTable } from '../../../scenes/magicMcp/groupsTable';

export let MagicMcpGroupsPage = () => {
  let instance = useCurrentInstance();
  let [search, setSearch] = useState('');
  let searchDebounced = useDebounced(search, 300);

  return renderWithLoader({ instance })(({ instance }) => (
    <>
      <Input
        label="Search Groups"
        placeholder="Search Magic MCP Groups"
        hideLabel
        value={search}
        onChange={e => setSearch(e.target.value)}
      />

      <Spacer height={15} />

      <MagicGroupsTable search={searchDebounced} />
    </>
  ));
};
