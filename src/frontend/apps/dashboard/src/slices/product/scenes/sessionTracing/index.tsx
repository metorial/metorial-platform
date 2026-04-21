import { DashboardInstanceSessionsGetOutput } from '@metorial/dashboard-sdk';
import styled from 'styled-components';
import { DraggableSplitPane } from '../../../../components/draggableSplitPane';
import { SessionConnectionsPane } from './components/sessionConnectionsPane';
import { SessionTraceTabsPane } from './components/sessionTraceTabsPane';
import { useSessionTracing } from './hooks/useSessionTracing';

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

export let SessionTracingScene = ({
  session,
  initialExplorerTab,
  inspectorOptions
}: {
  session: DashboardInstanceSessionsGetOutput;
  initialExplorerTab?: boolean;
  inspectorOptions?: {
    sessionTemplateId?: string | null;
    magicMcpServerId?: string | null;
  };
}) => {
  let tracing = useSessionTracing(session, { initialExplorerTab });

  return (
    <SplitPaneWrapper>
      <DraggableSplitPane
        initialLeftSize={380}
        storageKey="metorial.sessionTracing.splitPane"
        left={
          <SessionConnectionsPane
            activeConnectionId={tracing.activeConnection?.id}
            activeTabId={tracing.activeTabId}
            connectionCount={tracing.connectionCount}
            explorerTabIdByConnectionId={tracing.explorerTabIdByConnectionId}
            groupedConnections={tracing.groupedConnections}
            isLoadingConnections={tracing.isLoadingConnections}
            isLoadingMoreConnections={tracing.isLoadingMoreConnections}
            listBodyRef={tracing.listBodyRef}
            listHeaderRef={tracing.listHeaderRef}
            onOpenAssignedExplorer={tracing.onOpenAssignedExplorer}
            onOpenConnectTab={tracing.onOpenConnectTab}
            onOpenConnection={tracing.onOpenConnection}
            onOpenExplorerTab={tracing.onOpenExplorerTab}
            onSelectTab={tracing.setActiveTabId}
            session={session}
            setConnectionRowElement={tracing.setConnectionRowElement}
          />
        }
        right={
          <SessionTraceTabsPane
            activeConnection={tracing.activeConnection}
            activeTabId={tracing.activeTabId}
            connectionIdByExplorerTabId={tracing.connectionIdByExplorerTabId}
            explorerTabIds={tracing.explorerTabIds}
            inspectorOptions={inspectorOptions}
            isExplorerActive={tracing.isExplorerActive}
            onCloseTab={tracing.onCloseTab}
            onOpenConnection={tracing.onOpenConnection}
            onReorderTabs={tracing.onReorderTabs}
            onSelectTab={tracing.setActiveTabId}
            openTabs={tracing.openTabs}
            session={session}
          />
        }
      />
    </SplitPaneWrapper>
  );
};
