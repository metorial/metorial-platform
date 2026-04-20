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
  session
}: {
  session: DashboardInstanceSessionsGetOutput;
}) => {
  let tracing = useSessionTracing(session);

  return (
    <SplitPaneWrapper>
      <DraggableSplitPane
        initialLeftSize={380}
        left={
          <SessionConnectionsPane
            activeConnectionId={tracing.activeConnection?.id}
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
            session={session}
            setConnectionRowElement={tracing.setConnectionRowElement}
          />
        }
        right={
          <SessionTraceTabsPane
            activeConnection={tracing.activeConnection}
            activeTabId={tracing.activeTabId}
            explorerTabIds={tracing.explorerTabIds}
            isExplorerActive={tracing.isExplorerActive}
            onCloseTab={tracing.onCloseTab}
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
