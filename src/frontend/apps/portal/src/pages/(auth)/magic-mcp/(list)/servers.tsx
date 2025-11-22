import { renderWithLoader } from '@metorial/data-hooks';
import { ContentLayout, PageHeader } from '@metorial/layout';
import { Input, LinkTabs, Spacer } from '@metorial/ui';
import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useDebounced } from '../../../../hooks/useDebounced';
import { MagicMcpServersGrid } from '../../../../scenes/magicMcp/serversGrid';
import { usePaths } from '../../../../state/portal/path';

export let MagicMcpServerPage = () => {
  let [search, setSearch] = useState('');
  let searchDebounced = useDebounced(search, 300);

  let pathname = useLocation().pathname;
  let Paths = usePaths();

  return (
    <ContentLayout>
      <PageHeader title="Magic MCP Servers" description="Manage your Magic MCP servers." />

      <LinkTabs
        current={pathname}
        links={[
          {
            label: 'Deployments',
            to: Paths.magicMcpServers()
          },
          {
            label: 'Connections',
            to: Paths.magicMcpSessions()
          }
        ]}
      />

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
    </ContentLayout>
  );
};
