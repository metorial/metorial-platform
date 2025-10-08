import { DashboardInstanceMagicMcpServersListQuery } from '@metorial/dashboard-sdk/src/gen/src/mt_2025_01_01_dashboard';
import { renderWithLoader } from '@metorial/data-hooks';
import { Paths } from '@metorial/frontend-config';
import { useCurrentInstance, useMagicMcpServers } from '@metorial/state';
import { Avatar, Button, Spacer } from '@metorial/ui';
import { ItemGrid } from '@metorial/ui-product';
import { useNavigate } from 'react-router-dom';
import styled, { keyframes } from 'styled-components';
import { showMagicMcpServerFormModal } from '../serverDeployments/modal';

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

let moveDots = keyframes`
  0% {
    background-position: 0 0;
  }
  100% {
    background-position: 18px 18px;
  }
`;

let EmptyState = styled.div`
  position: relative;
  background: #eee;
  background-image: radial-gradient(#bbb 1px, transparent 0);
  background-size: 18px 18px;
  background-position: -10px -10px;
  animation: ${moveDots} 2s linear infinite;

  height: 600px;
  border-radius: 15px;
  box-shadow: 0 4px 6px rgba(220, 220, 220, 0.1);

  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 80px;
  text-align: center;

  overflow: hidden;

  &::before {
    content: '';
    position: absolute;
    inset: 0;
    border-radius: inherit;
    background: radial-gradient(
      circle,
      transparent calc(100% - 300px),
      rgba(220, 220, 220, 1) 100%
    );
    pointer-events: none;
    z-index: 1;
  }

  h1 {
    color: #222;
    font-size: 32px;
    font-weight: 700;
    margin-bottom: 30px;
    margin-top: 20px;
    z-index: 2;
    position: relative;
  }

  p {
    color: #777;
    font-size: 18px;
    font-weight: 500;
    max-width: 620px;
    z-index: 2;
    line-height: 1.5;
    letter-spacing: 1px;
    position: relative;
    text-wrap: balance;
  }
`;

export let MagicMcpServersGrid = (filter: DashboardInstanceMagicMcpServersListQuery) => {
  let instance = useCurrentInstance();
  let servers = useMagicMcpServers(instance.data?.id, {
    ...filter,
    order: filter.order ?? 'desc'
  });
  let navigate = useNavigate();

  return renderWithLoader({ servers })(({ servers }) => (
    <>
      {servers.data.items.length > 0 && (
        <ItemGrid.Root width="300px">
          {servers.data.items.map(server => (
            <ItemGrid.Item
              key={server.id}
              entity={{ id: server.id, hasUsage: true }}
              title={server.name}
              description={
                server.description?.slice(0, 100) +
                (server.description && server.description.length > 100 ? '...' : '')
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
              onClick={() =>
                navigate(
                  Paths.instance.magicMcp.server(
                    instance.data?.organization,
                    instance.data?.project,
                    instance.data,
                    server.id
                  )
                )
              }
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
        <EmptyState>
          <h1>Welcome to Magic MCP</h1>
          <p>
            Magic MCP enables to you create MCP servers in seconds. Configure it here, and
            connect to it using Cursor, Claude Code, or the Metorial APIs and SDKs.
          </p>

          <Spacer size={30} />

          <Button
            onClick={() =>
              showMagicMcpServerFormModal({
                type: 'create'
              })
            }
          >
            Create Magic MCP server
          </Button>
        </EmptyState>
      )}
    </>
  ));
};
