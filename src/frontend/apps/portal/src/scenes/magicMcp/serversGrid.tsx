import { MagicMcpServersListQuery } from '@metorial/consumer-sdk/src/gen/src/mt_2025_01_01_dashboard';
import { renderWithLoader, renderWithPagination } from '@metorial/data-hooks';
import { Avatar, RenderDate, Text } from '@metorial/ui';
import { ItemGrid, Table } from '@metorial/ui-product';
import { useNavigate } from 'react-router-dom';
import styled from 'styled-components';
import { useMagicMcpServers } from '../../state/consumer/magicMcpServer';
import { usePaths } from '../../state/portal/path';

let Aliases = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
`;

let Alias = styled.div`
  background: #f0f0f0;
  height: 26px;
  border-radius: 50px;
  padding: 0 10px;
  display: flex;
  align-items: center;
  font-size: 12px;
  font-weight: 500;
`;

export let MagicMcpServersGrid = (filter: MagicMcpServersListQuery) => {
  let servers = useMagicMcpServers({
    ...filter,
    order: filter.order ?? 'desc'
  });
  let navigate = useNavigate();

  let Paths = usePaths();

  return renderWithLoader({ servers })(({ servers }) => (
    <>
      {servers.data.items.length > 0 && (
        <ItemGrid.Root width="300px">
          {servers.data.items.map(server => (
            <ItemGrid.Item
              key={server.id}
              entity={{ id: server.id, hasUsage: true }}
              title={server.name ?? 'Unknown Server'}
              description={
                server.description
                  ? server.description?.slice(0, 100) +
                    (server.description && server.description.length > 100 ? '...' : '')
                  : undefined
              }
              height={250}
              icon={
                <Avatar
                  entity={{
                    ...server,
                    imageUrl: `https://avatar-cdn.metorial.com/${server.id}`
                  }}
                  size={30}
                />
              }
              onClick={() => navigate(Paths.magicMcpServer(server.id))}
              bottom={
                <Aliases>
                  {server.endpoints.map(e => (
                    <Alias key={e.id}>{e.alias}</Alias>
                  ))}
                </Aliases>
              }
            />
          ))}
        </ItemGrid.Root>
      )}

      {servers.data.items.length == 0 && (
        <>
          {filter.search ? (
            <Text size="2" color="gray600" align="center" style={{ marginTop: 10 }}>
              No Magic MCP servers found for "{filter.search}".
            </Text>
          ) : (
            <Text size="2" color="gray600" align="center" style={{ marginTop: 10 }}>
              You don't have any Magic MCP servers yet. Get started by picking a server and
              deploying it.
            </Text>
          )}
        </>
      )}
    </>
  ));
};

export let MagicMcpServersTable = (filter: MagicMcpServersListQuery) => {
  let Paths = usePaths();
  let servers = useMagicMcpServers({
    ...filter,
    order: filter.order ?? 'desc'
  });

  return renderWithPagination(servers)(servers => (
    <>
      <Table
        headers={['Info', 'Created']}
        data={servers.data.items.map(server => ({
          data: [
            <div>
              <Text size="2" weight="strong">
                {server.name}
              </Text>
              {server.description && (
                <Text size="1" color="gray600">
                  {server.description}
                </Text>
              )}
            </div>,

            <RenderDate date={server.createdAt} />
          ],
          href: Paths.magicMcpServer(server.id)
        }))}
      />

      {servers.data.items.length == 0 && (
        <Text size="2" color="gray600" align="center" style={{ marginTop: 10 }}>
          No Magic MCP servers found.
        </Text>
      )}
    </>
  ));
};
