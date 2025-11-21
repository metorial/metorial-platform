import { renderWithLoader } from '@metorial/data-hooks';
import { PageHeader } from '@metorial/layout';
import { Input, Spacer } from '@metorial/ui';
import { useState } from 'react';
import { useDebounced } from '../../../../hooks/useDebounced';
import { MagicMcpServersGrid } from '../../../../scenes/magicMcp/serversGrid';

export let MagicMcpServerPage = () => {
  let [search, setSearch] = useState('');
  let searchDebounced = useDebounced(search, 300);

  return (
    <>
      <PageHeader title="Magic MCP Servers" description="Manage your Magic MCP servers." />

      {renderWithLoader({})(({}) => (
        <>
          <Input
            label="Search Servers"
            placeholder="Search Magic MCP Servers"
            hideLabel
            value={search}
            onChange={e => setSearch(e.target.value)}
          />

          <Spacer height={15} />

          <MagicMcpServersGrid search={searchDebounced} />
        </>
      ))}
    </>
  );
};
