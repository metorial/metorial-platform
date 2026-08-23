import {
  useAllSessionConnections,
  useAllSessionErrors,
  useCurrentInstance,
  useSession
} from '@metorial/state';
import {
  Badge,
  Callout,
  CenteredSpinner,
  Error as ErrorText,
  RenderDate,
  Text,
  theme
} from '@metorial/ui';
import { ReactNode, RefObject, useLayoutEffect, useMemo, useRef, useState } from 'react';
import styled from 'styled-components';
import { DraggableSplitPane } from '@metorial/split-pane';
import { ConnectionLogs } from './components/connectionLogs';
import { SessionConnection, TracingConnectionItem } from './types';
import { getConnectionAccentColor, groupConnectionsByDay } from './utils';

let SplitPaneWrapper = styled.div`
  flex: 1;
  min-height: 0;
  height: 100%;
  display: flex;
  overflow: hidden;

  > * {
    flex: 1;
    min-height: 0;
  }
`;

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

let RightPaneBody = styled(PaneBody)``;

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
    border-color: ${theme.colors.red600};
    box-shadow: 0 0 0 1px ${theme.colors.red600};
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

let ConnectionSessionLabel = styled.div`
  font-size: 11px;
  color: ${theme.colors.gray600};
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-family: monospace;
`;

let LoadingWrap = styled.div`
  display: flex;
  justify-content: center;
  padding: 20px;
`;

let DetailEmptyState = styled.div`
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  font-size: 18px;
  font-weight: 500;
  color: ${theme.colors.gray600};
  text-align: center;
`;

export let ProviderErrorTracingScene = ({ errorGroupId }: { errorGroupId: string }) => {
  let instance = useCurrentInstance();
  let instanceId = instance.data?.id;

  let errors = useAllSessionErrors(instanceId, {
    sessionErrorGroupId: errorGroupId,
    limit: 100
  });

  let errorItems = errors.data?.items ?? [];

  let { connectionIds, sessionByConnection, errorCountByConnection } = useMemo(() => {
    let ids = new Set<string>();
    let sessionMap = new Map<string, string>();
    let errorCount = new Map<string, number>();

    for (let err of errorItems) {
      if (!err.connectionId) continue;
      ids.add(err.connectionId);
      if (err.sessionId) sessionMap.set(err.connectionId, err.sessionId);
      errorCount.set(err.connectionId, (errorCount.get(err.connectionId) ?? 0) + 1);
    }

    return {
      connectionIds: Array.from(ids),
      sessionByConnection: sessionMap,
      errorCountByConnection: errorCount
    };
  }, [errorItems]);

  let connections = useAllSessionConnections(
    instanceId && connectionIds.length ? instanceId : null,
    {
      id: connectionIds,
      limit: 100,
      order: 'desc'
    }
  );

  let connectionItems = useMemo<TracingConnectionItem[]>(
    () =>
      (connections.data?.items ?? []).map(connection => ({
        ...connection,
        hasErrors: true
      })),
    [connections.data?.items]
  );

  let groupedConnections = useMemo(
    () =>
      groupConnectionsByDay(
        connectionItems.map(connection => ({
          kind: 'connection' as const,
          ...connection
        }))
      ),
    [connectionItems]
  );

  let [activeConnectionId, setActiveConnectionId] = useState<string | null>(null);

  let effectiveActiveConnectionId = activeConnectionId ?? connectionItems[0]?.id ?? null;

  let activeConnection = useMemo(
    () =>
      effectiveActiveConnectionId
        ? (connectionItems.find(c => c.id === effectiveActiveConnectionId) ?? null)
        : null,
    [connectionItems, effectiveActiveConnectionId]
  );

  let activeSessionId = activeConnection?.sessionId ?? null;
  let activeSession = useSession(instanceId, activeSessionId);

  let listBodyRef = useRef<HTMLDivElement>(null);
  let listHeaderRef = useRef<HTMLDivElement>(null);
  let rightPaneBodyRef = useRef<HTMLDivElement>(null);

  let isLoadingConnections = errors.isLoading || connections.isLoading;
  let connectionCount = connectionItems.length;

  useLayoutEffect(() => {
    try {
      (window as any).metorial_setRestrictHeight(true);
    } catch {}

    return () => {
      try {
        (window as any).metorial_setRestrictHeight(false);
      } catch {}
    };
  }, [errorGroupId]);

  return (
    <SplitPaneWrapper>
      <DraggableSplitPane
        initialLeftSize={380}
        storageKey="metorial.providerErrorTracing.splitPane"
        left={
          <ErrorConnectionsPane
            activeConnectionId={effectiveActiveConnectionId}
            connectionCount={connectionCount}
            errorCountByConnection={errorCountByConnection}
            groupedConnections={groupedConnections}
            isLoadingConnections={isLoadingConnections}
            listBodyRef={listBodyRef}
            listHeaderRef={listHeaderRef}
            onOpenConnection={setActiveConnectionId}
            sessionByConnection={sessionByConnection}
          />
        }
        right={
          <PaneSection>
            {activeConnection ? (
              activeSession.isLoading || !activeSession.data ? (
                <LoadingWrap>
                  <CenteredSpinner size={16} />
                </LoadingWrap>
              ) : (
                <RightPaneBody ref={rightPaneBodyRef}>
                  <ConnectionLogs
                    connection={activeConnection}
                    scrollRef={rightPaneBodyRef}
                    session={activeSession.data}
                  />
                </RightPaneBody>
              )
            ) : isLoadingConnections ? (
              <LoadingWrap>
                <CenteredSpinner size={16} />
              </LoadingWrap>
            ) : (
              <DetailEmptyState>
                {connectionCount === 0
                  ? 'No connections have recorded this error yet.'
                  : 'Select a connection from the left to inspect its logs.'}
              </DetailEmptyState>
            )}
          </PaneSection>
        }
      />
    </SplitPaneWrapper>
  );
};

let ErrorConnectionsPane = ({
  activeConnectionId,
  connectionCount,
  errorCountByConnection,
  groupedConnections,
  isLoadingConnections,
  listBodyRef,
  listHeaderRef,
  onOpenConnection,
  sessionByConnection
}: {
  activeConnectionId: string | null;
  connectionCount: number;
  errorCountByConnection: Map<string, number>;
  groupedConnections: ReturnType<typeof groupConnectionsByDay>;
  isLoadingConnections: boolean;
  listBodyRef: RefObject<HTMLDivElement | null>;
  listHeaderRef: RefObject<HTMLDivElement | null>;
  onOpenConnection: (connectionId: string) => void;
  sessionByConnection: Map<string, string>;
}) => {
  return (
    <PaneSection>
      <PaneBody ref={listBodyRef}>
        <PaneHeader ref={listHeaderRef}>
          <PaneHeaderTitle>Connections with this error</PaneHeaderTitle>

          {connectionCount > 0 && (
            <Badge size="1" color="gray">
              {connectionCount}
            </Badge>
          )}
        </PaneHeader>

        <ConnectionGroups>
          {groupedConnections.map(group => (
            <ConnectionGroup key={group.label}>
              <ConnectionGroupLabel>{group.label}</ConnectionGroupLabel>

              {group.items.map(item =>
                item.kind === 'placeholder' ? null : (
                  <ErrorConnectionRow
                    key={item.id}
                    activeConnectionId={activeConnectionId}
                    connection={item}
                    errorCount={errorCountByConnection.get(item.id) ?? 0}
                    onOpenConnection={onOpenConnection}
                    sessionId={sessionByConnection.get(item.id) ?? item.sessionId}
                  />
                )
              )}
            </ConnectionGroup>
          ))}

          {isLoadingConnections && (
            <LoadingWrap>
              <CenteredSpinner size={16} />
            </LoadingWrap>
          )}

          {!connectionCount && !isLoadingConnections && (
            <Callout color="gray">
              No connections have been associated with this error yet.
            </Callout>
          )}
        </ConnectionGroups>
      </PaneBody>
    </PaneSection>
  );
};

let ErrorConnectionRow = ({
  activeConnectionId,
  connection,
  errorCount,
  onOpenConnection,
  sessionId
}: {
  activeConnectionId: string | null;
  connection: TracingConnectionItem;
  errorCount: number;
  onOpenConnection: (connectionId: string) => void;
  sessionId: string | null | undefined;
}) => {
  let meta: ReactNode[] = [];

  meta.push(
    <ErrorText key="errors">
      {errorCount > 0
        ? `${errorCount} occurrence${errorCount === 1 ? '' : 's'}`
        : 'Has errors'}
    </ErrorText>
  );

  return (
    <ConnectionButton
      role="button"
      tabIndex={0}
      data-active={connection.id === activeConnectionId}
      data-error={true}
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
                hasErrors: true,
                connectionState: connection.connectionState
              }).full
            }}
          />
          <ConnectionTitle>{formatErrorConnectionLabel(connection)}</ConnectionTitle>
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

let formatErrorConnectionLabel = (connection: SessionConnection) =>
  connection.participant?.name ??
  connection.mcp?.transport ??
  `Connection ${connection.id.slice(0, 8)}...`;
