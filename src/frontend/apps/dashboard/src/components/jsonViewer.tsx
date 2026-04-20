import { theme } from '@metorial/ui';
import { JsonValue, TreeView, VisualJson, useStudio } from '@visual-json/react';
import { useEffect } from 'react';
import styled from 'styled-components';

let Viewer = styled.div`
  overflow: hidden;
  /* border: 1px solid ${theme.colors.gray300};
  border-radius: 10px;
  background: ${theme.colors.background}; */

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
    /* align-items: flex-start;
    flex-wrap: wrap;
    min-width: 0; */
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
  let { actions } = useStudio();

  useEffect(() => {
    actions.expandAll();
  }, [actions]);

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
        ['--vj-bg' as string]: theme.colors.background,
        ['--vj-bg-panel' as string]: theme.colors.background,
        ['--vj-bg-hover' as string]: theme.colors.gray100,
        ['--vj-bg-selected' as string]: theme.colors.gray200,
        ['--vj-bg-selected-muted' as string]: theme.colors.gray100,
        ['--vj-bg-match' as string]: theme.colors.yellow100,
        ['--vj-bg-match-active' as string]: theme.colors.yellow200,
        ['--vj-border' as string]: theme.colors.gray300,
        ['--vj-border-subtle' as string]: theme.colors.gray200,
        ['--vj-text' as string]: theme.colors.foreground,
        ['--vj-text-muted' as string]: theme.colors.gray700,
        ['--vj-text-dim' as string]: theme.colors.gray600,
        ['--vj-text-dimmer' as string]: theme.colors.gray500,
        ['--vj-string' as string]: theme.colors.orange700,
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
