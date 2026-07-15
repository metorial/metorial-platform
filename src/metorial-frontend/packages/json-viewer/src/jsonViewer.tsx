import { theme } from '@metorial/ui';
import { type JsonValue, TreeView, VisualJson, useStudio } from '@visual-json/react';
import { useEffect, useRef } from 'react';
import styled from 'styled-components';

let Viewer = styled.div`
  overflow: hidden;
  font-size: 12px;

  [data-vj-root] {
    display: flex;
    flex-direction: column;
    min-height: 0;
  }

  [role='tree'] {
    overflow: auto;
  }

  [role='treeitem'] {
    border-radius: 8px;
  }

  [role='treeitem'] > span[style*='text-overflow'] {
    flex: 1 1 100%;
    min-width: 0;
    margin-left: 22px !important;
    overflow: visible !important;
    text-overflow: clip !important;
    white-space: pre-wrap !important;
    word-break: break-word !important;
    overflow-wrap: anywhere !important;
  }

  [role='treeitem'] + [role='treeitem'] {
    margin-top: 2px;
  }

  [draggable='true'] {
    cursor: default;
  }
`;

let TreeRoot = styled.div`
  min-height: 0;
`;

let JsonViewerTree = () => {
  let { actions, state } = useStudio();
  let actionsRef = useRef(actions);
  actionsRef.current = actions;

  let rootId = state.tree.root.id;
  let expandedRootRef = useRef<string | null>(null);

  useEffect(() => {
    if (expandedRootRef.current === rootId) return;
    expandedRootRef.current = rootId;
    actionsRef.current.expandAll();
  }, [rootId]);

  return <TreeView showValues showCounts />;
};

export let JsonViewer = ({ className, value }: { className?: string; value: JsonValue }) => {
  return (
    <Viewer
      className={className}
      onContextMenuCapture={event => event.preventDefault()}
      onDragStartCapture={event => event.preventDefault()}
      onDropCapture={event => event.preventDefault()}
      style={{
        ['--vj-bg' as string]: 'transparent',
        ['--vj-bg-panel' as string]: 'transparent',
        ['--vj-bg-hover' as string]: 'rgba(0, 0, 0, 0.04)',
        ['--vj-bg-selected' as string]: 'rgba(0, 0, 0, 0.08)',
        ['--vj-bg-selected-muted' as string]: 'rgba(0, 0, 0, 0.04)',
        ['--vj-bg-match' as string]: theme.colors.yellow100,
        ['--vj-bg-match-active' as string]: theme.colors.yellow200,
        ['--vj-border' as string]: theme.colors.gray300,
        ['--vj-border-subtle' as string]: theme.colors.gray200,
        ['--vj-text' as string]: theme.colors.foreground,
        ['--vj-text-muted' as string]: theme.colors.gray700,
        ['--vj-text-dim' as string]: theme.colors.gray600,
        ['--vj-text-dimmer' as string]: theme.colors.gray500,
        ['--vj-string' as string]: theme.colors.orange800,
        ['--vj-number' as string]: theme.colors.blue700,
        ['--vj-boolean' as string]: theme.colors.purple700,
        ['--vj-accent' as string]: theme.colors.blue600,
        ['--vj-accent-muted' as string]: theme.colors.blue100,
        ['--vj-error' as string]: theme.colors.red700,
        ['--vj-font' as string]:
          'ui-monospace, SFMono-Regular, SFMono, Menlo, Monaco, Consolas, Liberation Mono, monospace'
      }}
    >
      <TreeRoot>
        <VisualJson value={value}>
          <JsonViewerTree />
        </VisualJson>
      </TreeRoot>
    </Viewer>
  );
};

export type { JsonValue };
