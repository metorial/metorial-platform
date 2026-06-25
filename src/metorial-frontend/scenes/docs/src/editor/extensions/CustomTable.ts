import { Table } from '@tiptap/extension-table';
import type { Node as PMNode } from '@tiptap/pm/model';
import { NodeSelection } from '@tiptap/pm/state';
import { CellSelection, TableMap, moveTableColumn, moveTableRow } from '@tiptap/pm/tables';
import { createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { CornerHandle, ColGutter, RowGutter } from './TableGutters';

export let CustomTable = Table.extend({
  draggable: true,

  addNodeView() {
    return ({ node, editor, getPos }: any) => {
      let nodeRef: PMNode = node;
      let isInteractive = () => editor.isEditable;

      let wrapper = document.createElement('div');
      wrapper.className = 'pm-table-wrapper';

      let cornerHost = document.createElement('div');
      cornerHost.className = 'pm-table-corner-host';
      cornerHost.contentEditable = 'false';

      let colGutterHost = document.createElement('div');
      colGutterHost.className = 'pm-table-col-gutter-host';
      colGutterHost.contentEditable = 'false';

      let rowGutterHost = document.createElement('div');
      rowGutterHost.className = 'pm-table-row-gutter-host';
      rowGutterHost.contentEditable = 'false';

      let tableHost = document.createElement('div');
      tableHost.className = 'pm-table-host';

      let table = document.createElement('table');
      table.className = 'editor-table';
      let tbody = document.createElement('tbody');
      table.append(tbody);
      tableHost.append(table);

      wrapper.append(cornerHost, colGutterHost, rowGutterHost, tableHost);

      let cornerRoot: Root = createRoot(cornerHost);
      let colRoot: Root = createRoot(colGutterHost);
      let rowRoot: Root = createRoot(rowGutterHost);

      let getTablePos = (): number | null => {
        let p = typeof getPos === 'function' ? getPos() : null;
        return typeof p === 'number' ? p : null;
      };

      let dispatchCellSelection = (sel: CellSelection) => {
        let { state, dispatch } = editor.view;
        dispatch(state.tr.setSelection(sel));
        editor.view.focus();
      };

      let selectColumn = (col: number) => {
        if (!isInteractive()) return;
        let pos = getTablePos();
        if (pos == null) return;
        let map = TableMap.get(nodeRef);
        if (col < 0 || col >= map.width) return;
        let tableStart = pos + 1;
        let $anchor = editor.state.doc.resolve(tableStart + map.positionAt(0, col, nodeRef));
        let $head = editor.state.doc.resolve(
          tableStart + map.positionAt(map.height - 1, col, nodeRef)
        );
        dispatchCellSelection(CellSelection.colSelection($anchor, $head));
      };

      let selectRow = (row: number) => {
        if (!isInteractive()) return;
        let pos = getTablePos();
        if (pos == null) return;
        let map = TableMap.get(nodeRef);
        if (row < 0 || row >= map.height) return;
        let tableStart = pos + 1;
        let $anchor = editor.state.doc.resolve(tableStart + map.positionAt(row, 0, nodeRef));
        let $head = editor.state.doc.resolve(
          tableStart + map.positionAt(row, map.width - 1, nodeRef)
        );
        dispatchCellSelection(CellSelection.rowSelection($anchor, $head));
      };

      let selectTable = () => {
        if (!isInteractive()) return;
        let pos = getTablePos();
        if (pos == null) return;
        let map = TableMap.get(nodeRef);
        let tableStart = pos + 1;
        let $anchor = editor.state.doc.resolve(tableStart + map.positionAt(0, 0, nodeRef));
        let $head = editor.state.doc.resolve(
          tableStart + map.positionAt(map.height - 1, map.width - 1, nodeRef)
        );
        dispatchCellSelection(new CellSelection($anchor, $head));
      };

      let selectTableNode = () => {
        if (!isInteractive()) return;
        let pos = getTablePos();
        if (pos == null) return;
        let { state, dispatch } = editor.view;
        dispatch(state.tr.setSelection(NodeSelection.create(state.doc, pos)));
        editor.view.focus();
      };

      type DragState = { kind: 'column'; from: number } | { kind: 'row'; from: number } | null;
      let dragState: DragState = null;
      let dragOverIndex: number | null = null;

      let destroyed = false;
      let rafId: number | null = null;
      let lastWidths: number[] = [];
      let lastHeights: number[] = [];

      let setGuttersVisible = (visible: boolean) => {
        let display = visible ? '' : 'none';
        cornerHost.style.display = display;
        colGutterHost.style.display = display;
        rowGutterHost.style.display = display;
      };

      let getColumnIndexFromPointer = (clientX: number): number | null => {
        if (!lastWidths.length) return null;
        let rect = colGutterHost.getBoundingClientRect();
        let x = Math.max(0, Math.min(clientX - rect.left, rect.width));
        let acc = 0;
        for (let i = 0; i < lastWidths.length; i += 1) {
          let width = lastWidths[i] ?? 0;
          if (x <= acc + width) return i;
          acc += width;
        }
        return lastWidths.length - 1;
      };

      let getRowIndexFromPointer = (clientY: number): number | null => {
        if (!lastHeights.length) return null;
        let rect = rowGutterHost.getBoundingClientRect();
        let y = Math.max(0, Math.min(clientY - rect.top, rect.height));
        let acc = 0;
        for (let i = 0; i < lastHeights.length; i += 1) {
          let height = lastHeights[i] ?? 0;
          if (y <= acc + height) return i;
          acc += height;
        }
        return lastHeights.length - 1;
      };

      let renderWithLatestMeasurements = () => {
        if (destroyed) return;
        renderRoots(lastWidths, lastHeights);
      };

      let clearDragState = () => {
        dragState = null;
        dragOverIndex = null;
        renderWithLatestMeasurements();
      };

      let moveColumnTo = (from: number, to: number) => {
        if (!isInteractive()) return;
        let map = TableMap.get(nodeRef);
        if (from < 0 || to < 0 || from >= map.width || to >= map.width) return;
        if (from === to) return;

        if (from < to) {
          for (let index = from; index < to; index += 1) {
            moveTableColumn({ from: index, to: index + 1 })(
              editor.state,
              editor.view.dispatch
            );
          }
        } else {
          for (let index = from; index > to; index -= 1) {
            moveTableColumn({ from: index, to: index - 1 })(
              editor.state,
              editor.view.dispatch
            );
          }
        }
        selectColumn(to);
      };

      let moveRowTo = (from: number, to: number) => {
        if (!isInteractive()) return;
        let map = TableMap.get(nodeRef);
        if (from <= 0 || to <= 0 || from >= map.height || to >= map.height) return;
        if (from === to) return;

        if (from < to) {
          for (let index = from; index < to; index += 1) {
            moveTableRow({ from: index, to: index + 1 })(editor.state, editor.view.dispatch);
          }
        } else {
          for (let index = from; index > to; index -= 1) {
            moveTableRow({ from: index, to: index - 1 })(editor.state, editor.view.dispatch);
          }
        }
        selectRow(to);
      };

      let startColumnMove = (from: number) => {
        if (!isInteractive()) return;
        dragState = { kind: 'column', from };
        dragOverIndex = from;
        selectColumn(from);
        renderWithLatestMeasurements();
      };

      let overColumnMove = (to: number) => {
        if (!isInteractive()) return;
        if (!dragState || dragState.kind !== 'column') return;
        if (dragOverIndex === to) return;
        dragOverIndex = to;
        renderWithLatestMeasurements();
      };

      let dropColumnMove = (to: number) => {
        if (!isInteractive()) return;
        if (!dragState || dragState.kind !== 'column') return;
        moveColumnTo(dragState.from, to);
        editor.view.focus();
        clearDragState();
      };

      let startRowMove = (from: number) => {
        if (!isInteractive()) return;
        if (from <= 0) return;
        dragState = { kind: 'row', from };
        dragOverIndex = from;
        selectRow(from);
        renderWithLatestMeasurements();
      };

      let overRowMove = (to: number) => {
        if (!isInteractive()) return;
        if (!dragState || dragState.kind !== 'row') return;
        if (dragOverIndex === to) return;
        dragOverIndex = to;
        renderWithLatestMeasurements();
      };

      let dropRowMove = (to: number) => {
        if (!isInteractive()) return;
        if (!dragState || dragState.kind !== 'row') return;
        moveRowTo(dragState.from, to);
        editor.view.focus();
        clearDragState();
      };

      // Track the lifecycle of the nodeview so any pending RAFs / Resize
      // Observer callbacks bail out instead of trying to render into the
      // React roots after they (and the editor) are gone. Switching the
      // outer view mode (editor → preview-only) destroys the editor and
      // all of its nodeviews while a RAF scheduled by `scheduleSync` may
      // still be queued — without this guard `cornerRoot.render(...)`
      // throws "Cannot update an unmounted root".

      let renderRoots = (widths: number[], heights: number[]) => {
        if (destroyed) return;
        if (!isInteractive()) {
          setGuttersVisible(false);
          cornerRoot.render(null);
          colRoot.render(null);
          rowRoot.render(null);
          return;
        }
        setGuttersVisible(true);
        cornerRoot.render(
          createElement(CornerHandle, {
            onSelect: selectTable,
            onStartDrag: selectTableNode
          })
        );
        colRoot.render(
          createElement(ColGutter, {
            widths,
            onSelect: selectColumn,
            onMoveStart: startColumnMove,
            onMoveOver: overColumnMove,
            onMoveDrop: dropColumnMove,
            onMoveEnd: clearDragState,
            dragFrom: dragState?.kind === 'column' ? dragState.from : null,
            dragOver: dragState?.kind === 'column' ? dragOverIndex : null
          })
        );
        rowRoot.render(
          createElement(RowGutter, {
            heights,
            onSelect: selectRow,
            onMoveStart: startRowMove,
            onMoveOver: overRowMove,
            onMoveDrop: dropRowMove,
            onMoveEnd: clearDragState,
            dragFrom: dragState?.kind === 'row' ? dragState.from : null,
            dragOver: dragState?.kind === 'row' ? dragOverIndex : null
          })
        );
      };

      let measureAndRender = () => {
        if (destroyed) return;
        let firstRow = tbody.querySelector(':scope > tr');
        let rows = Array.from(tbody.querySelectorAll(':scope > tr')) as HTMLElement[];
        let widths: number[] = [];
        let heights: number[] = [];
        if (firstRow) {
          let cells = Array.from(
            firstRow.querySelectorAll(':scope > th, :scope > td')
          ) as HTMLElement[];
          widths = cells.map(c => c.offsetWidth);
          heights = rows.map(r => r.offsetHeight);
        }
        lastWidths = widths;
        lastHeights = heights;
        renderRoots(widths, heights);
      };

      let scheduleSync = () => {
        if (destroyed) return;
        if (rafId !== null) return;
        rafId = requestAnimationFrame(() => {
          rafId = null;
          measureAndRender();
        });
      };

      let observer =
        typeof ResizeObserver !== 'undefined'
          ? new ResizeObserver(() => scheduleSync())
          : null;
      observer?.observe(table);

      let onColHostDragOver = (event: DragEvent) => {
        if (!isInteractive()) return;
        if (!dragState || dragState.kind !== 'column') return;
        event.preventDefault();
        let index = getColumnIndexFromPointer(event.clientX);
        if (index == null || dragOverIndex === index) return;
        dragOverIndex = index;
        renderWithLatestMeasurements();
      };

      let onColHostDrop = (event: DragEvent) => {
        if (!isInteractive()) return;
        if (!dragState || dragState.kind !== 'column') return;
        event.preventDefault();
        let index = dragOverIndex ?? getColumnIndexFromPointer(event.clientX);
        if (index == null) {
          clearDragState();
          return;
        }
        dropColumnMove(index);
      };

      let onRowHostDragOver = (event: DragEvent) => {
        if (!isInteractive()) return;
        if (!dragState || dragState.kind !== 'row') return;
        event.preventDefault();
        let rawIndex = getRowIndexFromPointer(event.clientY);
        if (rawIndex == null) return;
        let index = Math.max(1, rawIndex);
        if (dragOverIndex === index) return;
        dragOverIndex = index;
        renderWithLatestMeasurements();
      };

      let onRowHostDrop = (event: DragEvent) => {
        if (!isInteractive()) return;
        if (!dragState || dragState.kind !== 'row') return;
        event.preventDefault();
        let rawIndex = dragOverIndex ?? getRowIndexFromPointer(event.clientY);
        if (rawIndex == null) {
          clearDragState();
          return;
        }
        dropRowMove(Math.max(1, rawIndex));
      };

      colGutterHost.addEventListener('dragover', onColHostDragOver);
      colGutterHost.addEventListener('drop', onColHostDrop);
      rowGutterHost.addEventListener('dragover', onRowHostDragOver);
      rowGutterHost.addEventListener('drop', onRowHostDrop);

      scheduleSync();

      return {
        dom: wrapper,
        contentDOM: tbody,
        update(updatedNode: PMNode) {
          if (updatedNode.type !== node.type) return false;
          nodeRef = updatedNode;
          scheduleSync();
          return true;
        },
        ignoreMutation(mutation: MutationRecord) {
          let target = mutation.target as Node;
          return (
            target === colGutterHost ||
            colGutterHost.contains(target) ||
            target === rowGutterHost ||
            rowGutterHost.contains(target) ||
            target === cornerHost ||
            cornerHost.contains(target)
          );
        },
        destroy() {
          destroyed = true;
          if (rafId !== null) {
            cancelAnimationFrame(rafId);
            rafId = null;
          }
          observer?.disconnect();
          colGutterHost.removeEventListener('dragover', onColHostDragOver);
          colGutterHost.removeEventListener('drop', onColHostDrop);
          rowGutterHost.removeEventListener('dragover', onRowHostDragOver);
          rowGutterHost.removeEventListener('drop', onRowHostDrop);
          // React refuses to unmount a root from inside a render pass
          // (which is where ProseMirror destroys the nodeview when the
          // outer editor unmounts). Defer to a microtask so we're outside
          // of any active commit phase.
          queueMicrotask(() => {
            try {
              cornerRoot.unmount();
            } catch {
              /* noop */
            }
            try {
              colRoot.unmount();
            } catch {
              /* noop */
            }
            try {
              rowRoot.unmount();
            } catch {
              /* noop */
            }
          });
        }
      };
    };
  }
});
