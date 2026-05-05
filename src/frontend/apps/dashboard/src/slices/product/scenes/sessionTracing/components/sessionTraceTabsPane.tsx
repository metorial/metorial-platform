import { DashboardInstanceSessionsGetOutput } from '@metorial/dashboard-sdk';
import { theme } from '@metorial/ui';
import styled from 'styled-components';
import { EditorTabItem, EditorTabs } from '../../../../../components/editorTabs';
import { TracingConnectionItem } from '../types';
import { CONNECT_TAB_ID } from '../utils';
import { ConnectTabPanel } from './connectTabPanel';
import { ConnectionLogs } from './connectionLogs';
import { InspectorFrame } from './inspectorFrame';

let PaneSection = styled.div`
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
  height: 100%;
  overflow: hidden;
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
  font-size: 18px;
  font-weight: 500;
  color: ${theme.colors.gray600};
  text-align: center;
`;

export let SessionTraceTabsPane = ({
  activeConnection,
  activeTabId,
  connectionIdByExplorerTabId,
  explorerTabIds,
  focusedItemId,
  inspectorOptions,
  isExplorerActive,
  onCloseTab,
  onOpenConnection,
  onReorderTabs,
  onSelectTab,
  openTabs,
  session
}: {
  activeConnection: TracingConnectionItem | null;
  activeTabId: string | null;
  connectionIdByExplorerTabId: Record<string, string>;
  explorerTabIds: string[];
  focusedItemId?: string | null;
  inspectorOptions?: {
    sessionTemplateId?: string | null;
    magicMcpServerId?: string | null;
  };
  isExplorerActive: boolean;
  onCloseTab: (id: string) => void;
  onOpenConnection: (connectionId: string) => void;
  onReorderTabs: (sourceId: string, targetId: string, position: 'before' | 'after') => void;
  onSelectTab: (id: string) => void;
  openTabs: EditorTabItem[];
  session: DashboardInstanceSessionsGetOutput;
}) => {
  return (
    <PaneSection>
      <EditorTabs
        tabs={openTabs}
        activeId={activeTabId ?? null}
        onSelect={id => onSelectTab(id)}
        onClose={onCloseTab}
        onReorder={onReorderTabs}
      />

      {explorerTabIds.map(id => {
        let connectionId = connectionIdByExplorerTabId[id];
        return (
          <ExplorerHost key={id} data-active={id === activeTabId}>
            <InspectorFrame
              sessionId={session.id}
              sessionTemplateId={inspectorOptions?.sessionTemplateId}
              magicMcpServerId={inspectorOptions?.magicMcpServerId}
              onOpenLogs={connectionId ? () => onOpenConnection(connectionId) : undefined}
            />
          </ExplorerHost>
        );
      })}

      {!isExplorerActive && (
        <PaneBody>
          {activeTabId === CONNECT_TAB_ID ? (
            <ConnectTabPanel session={session} />
          ) : activeConnection ? (
            <ConnectionLogs
              session={session}
              connection={activeConnection}
              focusedItemId={focusedItemId}
            />
          ) : (
            <DetailEmptyState>
              Select a connection from the left to inspect its logs.
            </DetailEmptyState>
          )}
        </PaneBody>
      )}
    </PaneSection>
  );
};
