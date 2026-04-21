import { DashboardInstanceSessionsGetOutput } from '@metorial/dashboard-sdk';
import {
  Badge,
  Button,
  Callout,
  CenteredSpinner,
  Error,
  Menu,
  RenderDate,
  Text,
  theme
} from '@metorial/ui';
import { RiArrowDownSLine, RiCompass3Line } from '@remixicon/react';
import { ReactNode, RefObject } from 'react';
import styled from 'styled-components';
import {
  GroupedConnectionItems,
  PlaceholderConnectionItem,
  TracingConnectionItem
} from '../types';
import { formatConnectionLabel, getConnectionAccentColor } from '../utils';
import { BreathingIndicator } from './breathing';

let PaneSection = styled.div`
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
  height: 100%;
  overflow: hidden;
`;

let PaneHeader = styled.div`
  position: sticky;
  top: 0;
  z-index: 2;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 14px 16px;
  background: ${theme.colors.background};
  border-bottom: 1px solid ${theme.colors.gray300};
`;

let PaneHeaderTitle = styled.div`
  font-size: 13px;
  font-weight: 600;
  color: ${theme.colors.foreground};
`;

let PaneBody = styled.div`
  flex: 1;
  min-height: 0;
  overflow: auto;
  background: ${theme.colors.background};
  scrollbar-width: thin;
  scrollbar-color: ${theme.colors.gray300} transparent;

  &::-webkit-scrollbar {
    width: 8px;
    height: 8px;
  }

  &::-webkit-scrollbar-track {
    background: transparent;
  }

  &::-webkit-scrollbar-thumb {
    background: ${theme.colors.gray300};
    border-radius: 999px;
    border: 2px solid transparent;
    background-clip: padding-box;
  }

  &::-webkit-scrollbar-thumb:hover {
    background: ${theme.colors.gray500};
    background-clip: padding-box;
  }
`;

let ConnectionGroups = styled.div`
  display: flex;
  flex-direction: column;
  gap: 20px;
  padding: 16px;
`;

let ConnectionGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: 10px;
`;

let ConnectionGroupLabel = styled.div`
  font-size: 12px;
  font-weight: 600;
  color: ${theme.colors.gray600};
  text-transform: uppercase;
  letter-spacing: 0.04em;
`;

let ConnectionButton = styled.div`
  width: 100%;
  border: 1px solid ${theme.colors.gray300};
  border-radius: 10px;
  background: ${theme.colors.background};
  padding: 12px;
  text-align: left;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  gap: 8px;
  transition:
    background 0.2s ease,
    border-color 0.2s ease,
    box-shadow 0.2s ease,
    transform 0.2s ease;

  &[data-active='true'] {
    border-color: ${theme.colors.primary};
    box-shadow: 0 0 0 1px ${theme.colors.primary};
  }

  &[data-error='true'] {
    border-color: ${theme.colors.red600};

    &[data-active='true'] {
      border-color: ${theme.colors.red600};
      box-shadow: 0 0 0 1px ${theme.colors.red600};
    }
  }

  &:hover {
    background: ${theme.colors.gray100};
  }

  &:focus-visible {
    outline: 2px solid ${theme.colors.primary};
    outline-offset: 1px;
  }
`;

let ConnectionButtonRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  min-width: 0;
`;

let ConnectionButtonMeta = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
`;

let ConnectionMain = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
`;

let StatusDot = styled.span`
  width: 9px;
  height: 9px;
  border-radius: 999px;
  background: var(--status-color);
  flex-shrink: 0;
`;

let ConnectionTitle = styled.div`
  font-size: 13px;
  font-weight: 600;
  color: ${theme.colors.foreground};
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

let ConnectionMeta = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 6px 10px;
  font-size: 12px;
  color: ${theme.colors.gray600};
  align-items: center;
  justify-content: space-between;
`;

let LoadingWrap = styled.div`
  display: flex;
  justify-content: center;
  padding: 20px;
`;

export let SessionConnectionsPane = ({
  activeConnectionId,
  activeTabId,
  connectionCount,
  explorerTabIdByConnectionId,
  groupedConnections,
  isLoadingConnections,
  isLoadingMoreConnections,
  listBodyRef,
  listHeaderRef,
  onOpenAssignedExplorer,
  onOpenConnectTab,
  onOpenConnection,
  onOpenExplorerTab,
  onSelectTab,
  session,
  setConnectionRowElement
}: {
  activeConnectionId?: string | null;
  activeTabId?: string | null;
  connectionCount: number;
  explorerTabIdByConnectionId: Map<string, string>;
  groupedConnections: GroupedConnectionItems[];
  isLoadingConnections: boolean;
  isLoadingMoreConnections: boolean;
  listBodyRef: RefObject<HTMLDivElement | null>;
  listHeaderRef: RefObject<HTMLDivElement | null>;
  onOpenAssignedExplorer: (connectionId: string) => void;
  onOpenConnectTab: () => void;
  onOpenConnection: (connectionId: string) => void;
  onOpenExplorerTab: () => void;
  onSelectTab: (tabId: string) => void;
  session: DashboardInstanceSessionsGetOutput;
  setConnectionRowElement: (connectionId: string, element: HTMLDivElement | null) => void;
}) => {
  return (
    <PaneSection>
      <PaneBody ref={listBodyRef}>
        <PaneHeader ref={listHeaderRef}>
          <PaneHeaderTitle>Recent Connections</PaneHeaderTitle>

          <Menu
            items={[
              {
                id: 'external',
                label: 'Connect external client',
                description: 'Use any MCP client to connect to this session.'
              },
              {
                id: 'explorer',
                label: 'Metorial Explorer',
                description: 'Use the built-in explorer to inspect the provider.'
              }
            ]}
            onItemClick={id => {
              if (id === 'external') onOpenConnectTab();
              else if (id === 'explorer') onOpenExplorerTab();
            }}
          >
            <Button size="2" variant="outline" iconRight={<RiArrowDownSLine size={14} />}>
              Connect
            </Button>
          </Menu>
        </PaneHeader>

        <ConnectionGroups>
          {groupedConnections.map(group => (
            <ConnectionGroup key={group.label}>
              <ConnectionGroupLabel>{group.label}</ConnectionGroupLabel>

              {group.items.map(item =>
                item.kind === 'placeholder' ? (
                  <PlaceholderConnectionRow
                    key={item.id}
                    activeTabId={activeTabId}
                    item={item}
                    onSelectTab={onSelectTab}
                  />
                ) : (
                  <SessionConnectionRow
                    key={item.id}
                    activeConnectionId={activeConnectionId}
                    connection={item}
                    explorerTabIdByConnectionId={explorerTabIdByConnectionId}
                    onOpenAssignedExplorer={onOpenAssignedExplorer}
                    onOpenConnection={onOpenConnection}
                    session={session}
                    setConnectionRowElement={setConnectionRowElement}
                  />
                )
              )}
            </ConnectionGroup>
          ))}

          {isLoadingMoreConnections && (
            <LoadingWrap>
              <CenteredSpinner size={16} />
            </LoadingWrap>
          )}

          {!connectionCount && !isLoadingConnections && (
            <Callout color="gray">
              No connections yet. Once a client connects to this session, it will appear here.
            </Callout>
          )}
        </ConnectionGroups>
      </PaneBody>
    </PaneSection>
  );
};

let SessionConnectionRow = ({
  activeConnectionId,
  connection,
  explorerTabIdByConnectionId,
  onOpenAssignedExplorer,
  onOpenConnection,
  session,
  setConnectionRowElement
}: {
  activeConnectionId?: string | null;
  connection: TracingConnectionItem;
  explorerTabIdByConnectionId: Map<string, string>;
  onOpenAssignedExplorer: (connectionId: string) => void;
  onOpenConnection: (connectionId: string) => void;
  session: DashboardInstanceSessionsGetOutput;
  setConnectionRowElement: (connectionId: string, element: HTMLDivElement | null) => void;
}) => {
  let meta: ReactNode[] = [];

  if (connection.hasErrors) {
    meta.push(<Error key="errors">Connection has errors.</Error>);
  } else if (connection.connectionState === 'connected') {
    meta.push(
      <Badge key="connected" size="1" color="blue">
        Connected
      </Badge>
    );
  }

  if (explorerTabIdByConnectionId.has(connection.id)) {
    meta.push(
      <Button
        key="explorer"
        size="1"
        variant="ghost"
        iconLeft={<RiCompass3Line size={14} />}
        onClick={event => {
          event.stopPropagation();
          onOpenAssignedExplorer(connection.id);
        }}
      >
        Open Explorer
      </Button>
    );
  }

  return (
    <ConnectionButton
      ref={element => setConnectionRowElement(connection.id, element)}
      role="button"
      tabIndex={0}
      data-active={connection.id === activeConnectionId}
      data-error={connection.hasErrors}
      onClick={() => onOpenConnection(connection.id)}
      onKeyDown={event => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onOpenConnection(connection.id);
        }
      }}
    >
      <ConnectionButtonRow>
        <ConnectionMain>
          <StatusDot
            style={{
              ['--status-color' as string]: getConnectionAccentColor({
                hasErrors: connection.hasErrors,
                connectionState: connection.connectionState
              }).full
            }}
          />
          <ConnectionTitle>{formatConnectionLabel(connection, session)}</ConnectionTitle>
        </ConnectionMain>

        <ConnectionButtonMeta>
          <Text size="1" color="gray600">
            <RenderDate date={connection.createdAt} format="time" />
          </Text>
        </ConnectionButtonMeta>
      </ConnectionButtonRow>

      {meta.length > 0 && <ConnectionMeta>{meta}</ConnectionMeta>}
    </ConnectionButton>
  );
};

let PlaceholderConnectionRow = ({
  activeTabId,
  item,
  onSelectTab
}: {
  activeTabId?: string | null;
  item: PlaceholderConnectionItem;
  onSelectTab: (tabId: string) => void;
}) => {
  return (
    <ConnectionButton
      role="button"
      tabIndex={0}
      data-active={activeTabId === item.tabId}
      onClick={() => onSelectTab(item.tabId)}
      onKeyDown={event => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onSelectTab(item.tabId);
        }
      }}
    >
      <ConnectionButtonRow>
        <ConnectionMain>
          <BreathingIndicator />
          <ConnectionTitle>{item.label}</ConnectionTitle>
        </ConnectionMain>

        <ConnectionButtonMeta>
          <Text size="1" color="gray600">
            Connecting…
          </Text>
        </ConnectionButtonMeta>
      </ConnectionButtonRow>
    </ConnectionButton>
  );
};
