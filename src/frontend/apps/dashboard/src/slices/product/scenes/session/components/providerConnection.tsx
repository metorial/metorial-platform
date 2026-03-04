import { Button, theme } from '@metorial/ui';
import { ID } from '@metorial/ui-product';
import { RiArrowDownLine, RiRadarLine, RiSendPlane2Line } from '@remixicon/react';
import { useState } from 'react';
import styled from 'styled-components';
import { Entry } from './entry';
import { ItemList } from './itemList';

let Wrapper = styled.div`
  border-radius: 8px;
  border: 1px solid ${theme.colors.gray400};
  background: ${theme.colors.background};
  overflow: hidden;

  &[data-collapsed='true'] {
    max-height: 900px;
    overflow: hidden;
    position: relative;

    &::before {
      content: '';
      position: absolute;
      left: 0;
      right: 0;
      bottom: 0;
      height: 300px;
      z-index: 1;
      background: linear-gradient(
        to bottom,
        rgba(255, 255, 255, 0) 0%,
        rgba(255, 255, 255, 1) 90%
      );
    }

    .expand {
      position: absolute;
      bottom: 20px;
      left: 0;
      right: 0;
      display: flex;
      justify-content: center;
      align-items: center;
      flex-direction: column;
      gap: 10px;
      z-index: 2;

      svg {
        color: ${theme.colors.gray400};
      }
    }
  }
`;

let Header = styled.header`
  border-bottom: 1px solid ${theme.colors.gray400};
  padding: 15px 20px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  color: ${theme.colors.gray800};

  span {
    font-size: 12px;
    font-weight: 500;
  }
`;

let Main = styled.main`
  padding: 20px;
`;

export let ProviderConnection = ({
  connection,
  providerName,
  messageItems,
  eventItems
}: {
  connection: {
    id: string;
    mcp?: {
      client?: { name?: string; version?: string } | null;
      server?: { name?: string; version?: string } | null;
      connectionType?: string | null;
      protocolVersion?: string;
      transport?: string;
      capabilities?: Record<string, any>;
    } | null;
    createdAt: Date;
    startedAt?: Date | null;
    endedAt?: Date | null;
  };
  providerName?: string;
  messageItems?: { component: React.ReactNode; time: Date }[];
  eventItems?: { component: React.ReactNode; time: Date }[];
}) => {
  let [isCollapsed, setIsCollapsed] = useState(true);

  let name =
    providerName ??
    connection.mcp?.server?.name ??
    connection.mcp?.client?.name ??
    connection.mcp?.transport ??
    'MCP Connection';

  let allItems = [
    {
      component: (
        <Entry icon={<RiRadarLine />} title="Client connected" time={connection.createdAt} />
      ),
      time: connection.createdAt
    },

    ...(connection.startedAt
      ? [
          {
            component: (
              <Entry
                icon={<RiSendPlane2Line />}
                title="Session connection created"
                time={connection.startedAt}
              />
            ),
            time: connection.startedAt
          }
        ]
      : []),

    ...(eventItems ?? []),
    ...(messageItems ?? [])
  ];

  let displayItems = isCollapsed ? allItems.slice(0, 10) : allItems;

  return (
    <Wrapper data-collapsed={isCollapsed && allItems.length > 10}>
      {isCollapsed && allItems.length > 10 && (
        <div className="expand">
          <RiArrowDownLine />
          <Button size="2" onClick={() => setIsCollapsed(false)}>
            Expand Session Connection
          </Button>
        </div>
      )}

      <Header>
        <span>{name}</span>
        <span>
          <ID id={connection.id} />
        </span>
      </Header>

      <Main>
        <ItemList items={displayItems} />
      </Main>
    </Wrapper>
  );
};
