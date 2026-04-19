import {
  DashboardInstanceSessionsConnectionsListOutput,
  DashboardInstanceSessionsEventsListOutput,
  DashboardInstanceSessionsGetOutput,
  DashboardInstanceSessionsMessagesGetOutput
} from '@metorial/dashboard-sdk';
import { renderWithLoader } from '@metorial/data-hooks';
import {
  useAccumulatedSessionConnections,
  useCurrentInstance,
  useProviderRuns,
  useSession,
  useSessionErrors,
  useSessionEvents,
  useSessionMessages
} from '@metorial/state';
import {
  Button,
  Callout,
  CenteredSpinner,
  Copy,
  Entity,
  Menu,
  RenderDate,
  Text,
  theme
} from '@metorial/ui';
import {
  RiArrowDownSLine,
  RiCornerUpRightDoubleLine,
  RiErrorWarningLine,
  RiPlugLine,
  RiRadarLine,
  RiSendPlane2Line,
  RiServerLine
} from '@remixicon/react';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import styled from 'styled-components';
import { DraggableSplitPane } from '../../../../../components/draggableSplitPane';
import { EditorTabs } from '../../../../../components/editorTabs';
import { SessionConnectionStatusBadge } from '../../../scenes/providerSessions/table';
import { Entry } from '../../../scenes/session/components/entry';
import { ItemList } from '../../../scenes/session/components/itemList';
import { Message } from '../../../scenes/session/components/message';
import { ProviderRunLogs } from '../../../scenes/session/components/providerRunLogs';
import { useAggregatedMessages } from '../../../scenes/session/hooks/useAggregatedMessages';
import { InspectorFrame } from '../../explorer/inspector';

type SessionEvent = DashboardInstanceSessionsEventsListOutput['items'][number];
type SessionConnection = DashboardInstanceSessionsConnectionsListOutput['items'][number];
type TimelineItem = { component: React.ReactNode; time: Date };
let CONNECT_TAB_ID = '__connect__';
let EXPLORER_TAB_PREFIX = '__explorer_';
let isExplorerTabId = (id: string) => id.startsWith(EXPLORER_TAB_PREFIX);

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

let ConnectionButton = styled.button`
  width: 100%;
  border: 1px solid ${theme.colors.gray400};
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
    border-color: ${theme.colors.blue700};
    box-shadow: 0 0 0 1px ${theme.colors.blue700};
  }

  &[data-error='true'] {
    border-color: ${theme.colors.red500};
  }

  &:hover {
    background: ${theme.colors.gray100};
    transform: translateY(-1px);
  }
`;

let ConnectionButtonRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  min-width: 0;
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
`;

let ConnectPanel = styled.div`
  height: 100%;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 14px;
`;

let ExplorerHost = styled.div`
  flex: 1;
  min-height: 0;
  min-width: 0;
  overflow: hidden;
  display: none;
  flex-direction: column;

  &[data-active='true'] {
    display: flex;
  }
`;

let DetailEmptyState = styled.div`
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
`;

let DetailContent = styled.div`
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 16px;
`;

let DetailTimeline = styled.div`
  display: flex;
  flex-direction: column;
  gap: 16px;
`;

let LoadingWrap = styled.div`
  display: flex;
  justify-content: center;
  padding: 20px;
`;

let getEventConnectionId = (evt: SessionEvent) =>
  evt.connection?.id ??
  evt.providerRun?.connectionId ??
  evt.message?.connectionId ??
  evt.error?.connectionId ??
  evt.warning?.connectionId ??
  '__ungrouped';

let formatConnectionLabel = (
  connection: SessionConnection,
  session: DashboardInstanceSessionsGetOutput
) =>
  connection.participant?.name ??
  connection.mcp?.transport ??
  session.providers?.[0]?.deployment?.name ??
  `Connection ${connection.id.slice(0, 8)}...`;

let formatGroupDateLabel = (date: Date) => {
  let groupDay = new Date(date);
  groupDay.setHours(0, 0, 0, 0);

  let today = new Date();
  today.setHours(0, 0, 0, 0);

  let yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (groupDay.getTime() === today.getTime()) return 'Today';
  if (groupDay.getTime() === yesterday.getTime()) return 'Yesterday';

  return groupDay.toLocaleDateString(undefined, {
    month: 'long',
    day: 'numeric',
    year: 'numeric'
  });
};

let getConnectionAccentColor = ({
  hasErrors,
  connectionState
}: {
  hasErrors?: boolean | null;
  connectionState?: SessionConnection['connectionState'];
}) => {
  if (hasErrors) return theme.colors.red600;
  if (connectionState === 'connected') return theme.colors.blue700;
  return theme.colors.gray500;
};

let reorderList = (
  items: string[],
  sourceId: string,
  targetId: string,
  position: 'before' | 'after'
) => {
  let sourceIndex = items.indexOf(sourceId);
  let targetIndex = items.indexOf(targetId);

  if (sourceIndex === -1 || targetIndex === -1 || sourceIndex === targetIndex) return items;

  let next = [...items];
  let [moved] = next.splice(sourceIndex, 1);
  let adjustedTargetIndex = next.indexOf(targetId);
  let insertIndex = position === 'before' ? adjustedTargetIndex : adjustedTargetIndex + 1;
  next.splice(insertIndex, 0, moved);
  return next;
};

export let ProviderSessionLogsPage = () => {
  let instance = useCurrentInstance();
  let { sessionId } = useParams();
  let session = useSession(instance.data?.id, sessionId);

  return renderWithLoader({ session })(({ session }) => (
    <ProviderSessionLogs session={session.data} />
  ));
};

export let ProviderSessionLogs = ({
  session
}: {
  session: DashboardInstanceSessionsGetOutput;
}) => {
  let instance = useCurrentInstance();
  let instanceId = instance.data?.id;
  let [openTabIds, setOpenTabIds] = useState<string[]>([]);
  let [activeTabId, setActiveTabId] = useState<string | null>(null);
  let [didInitializeTabs, setDidInitializeTabs] = useState(false);
  let [explorerTabCounter, setExplorerTabCounter] = useState(0);
  let listBodyRef = useRef<HTMLDivElement>(null);
  let loadMoreRef = useRef<HTMLDivElement>(null);

  let connections = useAccumulatedSessionConnections(instanceId, session.id, {
    limit: 50,
    order: 'desc'
  });
  let errorScopedConnectionIds = connections.items
    .slice(0, 100)
    .map(connection => connection.id);
  let errors = useSessionErrors(errorScopedConnectionIds.length ? instanceId : null, {
    limit: 100,
    sessionConnectionId: errorScopedConnectionIds
  });

  useEffect(() => {
    setOpenTabIds([]);
    setActiveTabId(null);
    setDidInitializeTabs(false);
    setExplorerTabCounter(0);
  }, [session.id]);

  useEffect(() => {
    let loadMoreElement = loadMoreRef.current;
    let listElement = listBodyRef.current;
    if (!loadMoreElement || !listElement) return;
    if (!connections.hasMoreAfter) return;

    let observer = new IntersectionObserver(
      entries => {
        let first = entries[0];
        if (!first?.isIntersecting) return;
        connections.loadMore();
      },
      {
        root: listElement,
        rootMargin: '0px 0px 240px 0px'
      }
    );

    observer.observe(loadMoreElement);
    return () => observer.disconnect();
  }, [connections.hasMoreAfter, connections.items.length, connections.loadMore]);

  let errorConnectionIds = useMemo(() => {
    let ids = new Set<string>();
    for (let error of errors.data?.items ?? []) {
      if (error.connectionId) ids.add(error.connectionId);
    }
    return ids;
  }, [errors.data?.items]);

  let connectionItems = useMemo(
    () =>
      connections.items.map(connection => ({
        ...connection,
        hasErrors: connection.hasErrors || errorConnectionIds.has(connection.id)
      })),
    [connections.items, errorConnectionIds]
  );

  useEffect(() => {
    if (didInitializeTabs) return;

    let firstConnection = connectionItems[0];
    if (!firstConnection) return;

    setOpenTabIds([firstConnection.id]);
    setActiveTabId(firstConnection.id);
    setDidInitializeTabs(true);
  }, [connectionItems, didInitializeTabs]);

  let connectionsById = useMemo(
    () => new Map(connectionItems.map(connection => [connection.id, connection])),
    [connectionItems]
  );

  let groupedConnections = useMemo(() => {
    let grouped = new Map<string, { label: string; items: typeof connectionItems }>();

    for (let connection of connectionItems) {
      let label = formatGroupDateLabel(connection.createdAt);
      let key = new Date(connection.createdAt).toDateString();
      let existing = grouped.get(key);

      if (existing) {
        existing.items.push(connection);
        continue;
      }

      grouped.set(key, { label, items: [connection] });
    }

    return Array.from(grouped.values());
  }, [connectionItems]);

  let openConnection = (connectionId: string) => {
    setOpenTabIds(current =>
      current.includes(connectionId) ? current : [...current, connectionId]
    );
    setActiveTabId(connectionId);
  };

  let openConnectTab = () => {
    setOpenTabIds(current =>
      current.includes(CONNECT_TAB_ID) ? current : [...current, CONNECT_TAB_ID]
    );
    setActiveTabId(CONNECT_TAB_ID);
  };

  let openExplorerTab = () => {
    let nextId = `${EXPLORER_TAB_PREFIX}${explorerTabCounter}__`;
    setExplorerTabCounter(c => c + 1);
    setOpenTabIds(current => [...current, nextId]);
    setActiveTabId(nextId);
  };

  let closeTab = (tabId: string) => {
    setOpenTabIds(current => {
      let next = current.filter(id => id !== tabId);

      if (activeTabId === tabId) {
        setActiveTabId(next[next.length - 1] ?? null);
      }

      return next;
    });
  };

  let explorerTabIds = useMemo(() => openTabIds.filter(isExplorerTabId), [openTabIds]);

  let explorerNumberById = useMemo(() => {
    let map = new Map<string, number>();
    let idx = 0;
    for (let id of openTabIds) {
      if (isExplorerTabId(id)) {
        idx++;
        map.set(id, idx);
      }
    }
    return map;
  }, [openTabIds]);

  let totalExplorerTabs = explorerNumberById.size;

  let openTabs = openTabIds
    .map(id => {
      if (id === CONNECT_TAB_ID) {
        return {
          id: CONNECT_TAB_ID,
          label: 'Connect',
          accentColor: theme.colors.blue700
        };
      }

      if (isExplorerTabId(id)) {
        let n = explorerNumberById.get(id);
        return {
          id,
          label: totalExplorerTabs > 1 && n ? `Metorial Explorer ${n}` : 'Metorial Explorer',
          accentColor: theme.colors.purple700
        };
      }

      let connection = connectionsById.get(id);
      if (!connection) return null;

      return {
        id: connection.id,
        label: formatConnectionLabel(connection, session),
        accentColor: getConnectionAccentColor({
          hasErrors: connection.hasErrors,
          connectionState: connection.connectionState
        })
      };
    })
    .filter((tab): tab is NonNullable<typeof tab> => Boolean(tab));

  let isExplorerActive = activeTabId ? isExplorerTabId(activeTabId) : false;
  let activeConnection =
    activeTabId && activeTabId !== CONNECT_TAB_ID && !isExplorerActive
      ? connectionsById.get(activeTabId)
      : null;

  useLayoutEffect(() => {
    try {
      (window as any).metorial_setRestrictHeight(true);
    } catch {}

    return () => {
      try {
        (window as any).metorial_setRestrictHeight(false);
      } catch {}
    };
  }, [session.id]);

  return (
    <SplitPaneWrapper>
      <DraggableSplitPane
        initialLeftSize={380}
        left={
          <PaneSection>
            <PaneBody ref={listBodyRef}>
              <PaneHeader>
                <PaneHeaderTitle>Recent Connections</PaneHeaderTitle>

                <Menu
                  items={[
                    {
                      id: 'external',
                      label: 'Connect external client',
                      description: 'Show the connection URL and secret for a remote client.'
                    },
                    {
                      id: 'explorer',
                      label: 'Metorial Explorer',
                      description: 'Open the built-in MCP tool explorer in a new tab.'
                    }
                  ]}
                  onItemClick={id => {
                    if (id === 'external') openConnectTab();
                    else if (id === 'explorer') openExplorerTab();
                  }}
                >
                  <Button
                    size="2"
                    variant="outline"
                    iconRight={<RiArrowDownSLine size={14} />}
                  >
                    Connect
                  </Button>
                </Menu>
              </PaneHeader>

              <ConnectionGroups>
                {groupedConnections.map(group => (
                  <ConnectionGroup key={group.label}>
                    <ConnectionGroupLabel>{group.label}</ConnectionGroupLabel>

                    {group.items.map(connection => (
                      <ConnectionButton
                        key={connection.id}
                        type="button"
                        data-active={connection.id === activeConnection?.id}
                        data-error={connection.hasErrors}
                        onClick={() => openConnection(connection.id)}
                      >
                        <ConnectionButtonRow>
                          <ConnectionMain>
                            <StatusDot
                              style={{
                                ['--status-color' as string]: getConnectionAccentColor({
                                  hasErrors: connection.hasErrors,
                                  connectionState: connection.connectionState
                                })
                              }}
                            />
                            <ConnectionTitle>
                              {formatConnectionLabel(connection, session)}
                            </ConnectionTitle>
                          </ConnectionMain>

                          <Text size="1" color="gray600">
                            <RenderDate date={connection.createdAt} />
                          </Text>
                        </ConnectionButtonRow>

                        <ConnectionMeta>
                          <span>{connection.connectionState}</span>
                          {connection.hasErrors && <span>Error detected</span>}
                          {connection.lastActiveAt && (
                            <span>
                              Last active <RenderDate date={connection.lastActiveAt} />
                            </span>
                          )}
                        </ConnectionMeta>
                      </ConnectionButton>
                    ))}
                  </ConnectionGroup>
                ))}

                {connections.hasMoreAfter && <div ref={loadMoreRef} style={{ height: 1 }} />}

                {connections.isLoadingMore && (
                  <LoadingWrap>
                    <CenteredSpinner size={16} />
                  </LoadingWrap>
                )}

                {!connectionItems.length && !connections.isLoading && (
                  <Callout color="gray">
                    No connections yet. Once a client connects to this session, it will appear
                    here.
                  </Callout>
                )}
              </ConnectionGroups>
            </PaneBody>
          </PaneSection>
        }
        right={
          <PaneSection>
            <EditorTabs
              tabs={openTabs}
              activeId={activeTabId ?? null}
              onSelect={setActiveTabId}
              onClose={closeTab}
              onReorder={(sourceId: string, targetId: string, position: 'before' | 'after') =>
                setOpenTabIds(current => reorderList(current, sourceId, targetId, position))
              }
            />

            {explorerTabIds.map(id => (
              <ExplorerHost key={id} data-active={id === activeTabId}>
                <InspectorFrame sessionId={session.id} />
              </ExplorerHost>
            ))}

            {!isExplorerActive && (
              <PaneBody>
                {activeTabId === CONNECT_TAB_ID ? (
                  <ConnectPanel>
                    <Text size="2" color="gray700">
                      Use this URL and session-scoped secret to connect a client directly to
                      this session.
                    </Text>

                    <Copy
                      label="Connection URL"
                      value={session.connectionUrl ?? 'No connection URL available'}
                      copyValue={session.connectionUrl ?? ''}
                    />

                    {session.clientSecret ? (
                      <Copy
                        label="Client Secret"
                        value={session.clientSecret}
                        copyValue={session.clientSecret}
                      />
                    ) : (
                      <Callout color="gray">
                        This session does not currently expose a client secret.
                      </Callout>
                    )}
                  </ConnectPanel>
                ) : activeConnection ? (
                  <ProviderSessionConnectionLogs
                    session={session}
                    connection={activeConnection}
                  />
                ) : (
                  <DetailEmptyState>
                    <Callout color="gray">
                      Select a connection from the left to inspect its logs.
                    </Callout>
                  </DetailEmptyState>
                )}
              </PaneBody>
            )}
          </PaneSection>
        }
      />
    </SplitPaneWrapper>
  );
};

let ProviderSessionConnectionLogs = ({
  session,
  connection
}: {
  session: DashboardInstanceSessionsGetOutput;
  connection: SessionConnection;
}) => {
  let instance = useCurrentInstance();
  let instanceId = instance.data?.id;

  let messages = useSessionMessages(instanceId, session.id, {
    limit: 100,
    sessionConnectionId: [connection.id]
  });
  let events = useSessionEvents(instanceId, session.id, {
    limit: 100,
    sessionConnectionId: [connection.id]
  });
  let providerRuns = useProviderRuns(instanceId, session.id, {
    limit: 100,
    sessionConnectionId: [connection.id]
  });

  let allMessages = useMemo(() => {
    let messageMap = new Map<string, DashboardInstanceSessionsMessagesGetOutput>();

    for (let msg of messages.data?.items ?? []) {
      messageMap.set(msg.id, msg);
    }

    for (let evt of events.data?.items ?? []) {
      if (evt.type === 'message_created' && evt.message) {
        let evtMsg = evt.message as DashboardInstanceSessionsMessagesGetOutput;
        let existing = messageMap.get(evtMsg.id);
        if (!existing || (!existing.output && evtMsg.output)) {
          messageMap.set(evtMsg.id, evtMsg);
        }
      }
    }

    return Array.from(messageMap.values()).sort((a, b) => {
      let aId = Number(a.transport?.mcp?.id ?? 0);
      let bId = Number(b.transport?.mcp?.id ?? 0);
      if (aId !== bId) return aId - bId;
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    });
  }, [events.data?.items, messages.data?.items]);

  let aggregatedMessages = useAggregatedMessages(allMessages);
  let mcp = connection.mcp as
    | (NonNullable<SessionConnection['mcp']> & {
        client?: { name?: string; version?: string } | null;
        server?: { name?: string; version?: string } | null;
        connectionType?: string | null;
      })
    | undefined;

  let messageItems = useMemo(
    () =>
      allMessages.map(message => ({
        component: <Message message={message} aggregatedMessages={aggregatedMessages} />,
        time: message.createdAt
      })),
    [aggregatedMessages, allMessages]
  );

  let providerRunItems = providerRuns.data?.items ?? [];
  let providerRunById = useMemo(
    () => new Map(providerRunItems.map(run => [run.id, run])),
    [providerRunItems]
  );

  let eventItems = useMemo(() => {
    let items: TimelineItem[] = [];
    let renderedProviderRunLogs = new Set<string>();

    for (let evt of events.data?.items ?? []) {
      if (getEventConnectionId(evt) !== connection.id) continue;

      let type = evt.type as string;
      let runId = evt.providerRun?.id;
      let providerRun = runId ? providerRunById.get(runId) : undefined;
      let providerRunLogTime = providerRun?.createdAt ?? evt.createdAt;

      if (type === 'error_occurred') {
        let errorMsg =
          evt.error?.code && evt.error?.message
            ? `${evt.error.code} - ${evt.error.message}`
            : (evt.error?.message ?? evt.warning?.message ?? null);
        items.push({
          component: (
            <Entry
              icon={<RiErrorWarningLine />}
              title={errorMsg ? `Error: ${errorMsg}` : 'Error occurred'}
              time={evt.createdAt}
              variant="error"
            />
          ),
          time: evt.createdAt
        });
      } else if (type === 'provider_run_started') {
        items.push({
          component: (
            <Entry icon={<RiServerLine />} title="Provider started" time={evt.createdAt} />
          ),
          time: evt.createdAt
        });
        if (runId && !renderedProviderRunLogs.has(runId)) {
          renderedProviderRunLogs.add(runId);
          items.push({
            component: <ProviderRunLogs providerRunId={runId} lazy />,
            time: providerRunLogTime
          });
        }
      } else if (type === 'provider_run_stopped') {
        items.push({
          component: (
            <Entry icon={<RiServerLine />} title="Provider stopped" time={evt.createdAt} />
          ),
          time: evt.createdAt
        });
        if (runId && !renderedProviderRunLogs.has(runId)) {
          renderedProviderRunLogs.add(runId);
          items.push({
            component: <ProviderRunLogs providerRunId={runId} lazy />,
            time: providerRunLogTime
          });
        }
      } else if (type === 'connection_disconnected') {
        items.push({
          component: (
            <Entry
              icon={<RiPlugLine />}
              title="Connection disconnected"
              time={evt.createdAt}
            />
          ),
          time: evt.createdAt
        });
      }
    }

    for (let run of providerRunItems) {
      if (!renderedProviderRunLogs.has(run.id)) {
        let evtForConn = (events.data?.items ?? []).some(
          event =>
            getEventConnectionId(event) === connection.id && event.providerRun?.id === run.id
        );
        if (evtForConn) {
          items.push({
            component: <ProviderRunLogs providerRunId={run.id} lazy />,
            time: run.createdAt
          });
        }
      }
    }

    return items;
  }, [connection.id, events.data?.items, providerRunById, providerRunItems]);

  let timelineItems = useMemo<TimelineItem[]>(
    () => [
      {
        component: (
          <Entry icon={<RiRadarLine />} title="Client connected" time={connection.createdAt} />
        ),
        time: connection.createdAt
      },
      {
        component: (
          <Entry
            icon={<RiSendPlane2Line />}
            title="Session connection created"
            time={connection.createdAt}
          />
        ),
        time: connection.createdAt
      },
      ...eventItems,
      ...messageItems
    ],
    [connection.createdAt, eventItems, messageItems]
  );

  let isLoading = messages.isLoading || events.isLoading || providerRuns.isLoading;
  let hasTimelineActivity = timelineItems.length > 2;
  let connectionName = formatConnectionLabel(connection, session);

  return (
    <DetailContent>
      <Entity.Wrapper>
        <Entity.Content>
          <Entity.Field title="Connection" value={connectionName} />
          <Entity.Field
            title="Status"
            value={
              <SessionConnectionStatusBadge
                connectionStatus={connection.connectionState}
                hasErrors={connection.hasErrors}
                hasWarnings={connection.hasWarnings}
              />
            }
          />
          <Entity.Field title="Connection ID" value={connection.id} />
          <Entity.Field
            title="Created At"
            value={<RenderDate date={connection.createdAt} />}
          />
          {connection.lastActiveAt && (
            <Entity.Field
              title="Last Active"
              value={<RenderDate date={connection.lastActiveAt} />}
            />
          )}
        </Entity.Content>
      </Entity.Wrapper>

      {mcp &&
        (mcp.client?.name ||
          mcp.client?.version ||
          mcp.server?.name ||
          mcp.server?.version ||
          mcp.connectionType) && (
          <Entity.Wrapper>
            <Entity.Content>
              {(mcp.client?.name || mcp.client?.version) && (
                <Entity.Field
                  title="Client"
                  value={[mcp.client?.name, mcp.client?.version].filter(Boolean).join('@')}
                />
              )}
              {(mcp.server?.name || mcp.server?.version) && (
                <Entity.Field
                  title="Server"
                  value={[mcp.server?.name, mcp.server?.version].filter(Boolean).join('@')}
                />
              )}
              {mcp.connectionType && (
                <Entity.Field
                  title="Connected Via"
                  value={
                    {
                      websocket: 'WebSocket',
                      streamable_http: 'Streamable HTTP',
                      sse: 'Server-Sent Events'
                    }[mcp.connectionType] ?? mcp.connectionType
                  }
                />
              )}
            </Entity.Content>
          </Entity.Wrapper>
        )}

      <DetailTimeline>
        <Entry
          icon={<RiCornerUpRightDoubleLine />}
          title="Session created"
          time={session.createdAt}
        />

        <ItemList items={timelineItems} />

        {!hasTimelineActivity && !isLoading && (
          <Callout color="gray">
            No activity has been recorded for this connection yet.
          </Callout>
        )}

        {isLoading && (
          <LoadingWrap>
            <CenteredSpinner size={16} />
          </LoadingWrap>
        )}
      </DetailTimeline>
    </DetailContent>
  );
};
