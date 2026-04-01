import { renderWithLoader } from '@metorial/data-hooks';
import { Avatar, Badge, Text } from '@metorial/ui';
import { ItemGrid } from '@metorial/ui-product';
import { useNavigate } from 'react-router-dom';
import {
  MagicMcpServersListQuery,
  useMagicMcpServers
} from '../../state/consumer/magicMcpServer';
import { usePaths } from '../../state/portal/path';

type MagicMcpServersFilter = MagicMcpServersListQuery & {
  serverId?: string[];
};

let getServerStatusColor = (status: string) =>
  (
    {
      active: 'green',
      archived: 'orange',
      deleted: 'gray'
    } as Record<string, 'green' | 'orange' | 'gray'>
  )[status] ?? 'gray';

export let MagicMcpServersGrid = (filter: MagicMcpServersFilter = {}) => {
  let servers = useMagicMcpServers({
    ...filter,
    order: filter.order ?? 'desc'
  });
  let navigate = useNavigate();
  let paths = usePaths();

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
                    name: server.name ?? 'Unknown Server',
                    imageUrl: `https://avatar-cdn.metorial.com/${server.id}`
                  }}
                  size={30}
                />
              }
              onClick={() => navigate(paths.magicMcpServer(server.id))}
              bottom={
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  <Badge color={getServerStatusColor(server.status)} size="1">
                    {server.status}
                  </Badge>
                  {server.endpoints.map(e => (
                    <Badge key={e.id} color="gray" size="1">
                      {e.alias}
                    </Badge>
                  ))}
                </div>
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
