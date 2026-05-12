import { useCallback, useMemo } from 'react';
import { BubbleMenu } from '@tiptap/react/menus';
import type { Editor } from '@tiptap/react';
import { PluginKey } from '@tiptap/pm/state';
import { CellSelection, moveTableColumn, moveTableRow, selectedRect } from '@tiptap/pm/tables';
import styled from 'styled-components';
import { menuEnter } from './animations';
import {
  IconBold,
  IconCode,
  IconColumnDelete,
  IconColumnInsertLeft,
  IconColumnInsertRight,
  IconColumnMoveLeft,
  IconColumnMoveRight,
  IconHighlight,
  IconItalic,
  IconRowDelete,
  IconRowInsertAbove,
  IconRowInsertBelow,
  IconRowMoveDown,
  IconRowMoveUp,
  IconStrike,
  IconTableDelete,
  IconUnderline
} from './icons';

let Floating = styled.div`
  display: flex;
  align-items: center;
  gap: 1px;
  padding: 4px;
  background: ${({ theme }) => theme.color.bgElevated};
  border: 1px solid ${({ theme }) => theme.color.border};
  border-radius: 10px;
  box-shadow: ${({ theme }) => theme.shadow.lg};
  white-space: nowrap;
  transform-origin: center bottom;
  ${menuEnter(140)}
`;

let Btn = styled.button<{ $active?: boolean }>`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  padding: 0;
  border: 0;
  background: ${({ $active, theme }) => ($active ? theme.color.bgActive : 'transparent')};
  color: ${({ $active, theme }) => ($active ? theme.color.accent : theme.color.text)};
  border-radius: ${({ theme }) => theme.size.radiusSm};
  cursor: pointer;
  transition:
    background ${({ theme }) => theme.motion.fast},
    color ${({ theme }) => theme.motion.fast};
  flex-shrink: 0;

  &:hover:not(:disabled) {
    background: ${({ theme }) => theme.color.bgHover};
  }

  &:disabled {
    color: ${({ theme }) => theme.color.textSubtle};
    cursor: not-allowed;
  }

  svg {
    width: 14px;
    height: 14px;
  }
`;

let DangerBtn = styled(Btn)`
  color: ${({ theme }) => theme.color.danger};

  &:hover:not(:disabled) {
    background: ${({ theme }) => theme.color.callout.danger.bg};
  }
`;

let Divider = styled.span`
  display: inline-block;
  width: 1px;
  height: 18px;
  margin: 0 4px;
  background: ${({ theme }) => theme.color.border};
  flex-shrink: 0;
`;

let tableMenuPluginKey = new PluginKey('tableMenu');
let TABLE_MENU_OPTIONS = {
  placement: 'top',
  offset: 8,
  flip: false,
  shift: { padding: 8 }
} as const;

type TableContext = 'column' | 'row' | 'table' | 'cells' | null;

function getTableContext(editor: Editor): TableContext {
  let { selection } = editor.state;
  if (!(selection instanceof CellSelection)) return null;
  let isCol = selection.isColSelection();
  let isRow = selection.isRowSelection();
  if (isCol && isRow) return 'table';
  if (isCol) return 'column';
  if (isRow) return 'row';
  return 'cells';
}

let tableShouldShow = ({ editor }: { editor: Editor }) => getTableContext(editor) !== null;

interface ClientRect {
  x: number;
  y: number;
  width: number;
  height: number;
  top: number;
  left: number;
  right: number;
  bottom: number;
}

function offsetRectTop(rect: ClientRect, offset: number): ClientRect {
  if (offset === 0) return rect;
  return {
    ...rect,
    y: rect.y + offset,
    top: rect.top + offset,
    bottom: rect.bottom + offset
  };
}

function getSelectionDOMRect(editor: Editor): ClientRect | null {
  let { selection } = editor.state;
  if (!(selection instanceof CellSelection)) return null;
  let left = Infinity;
  let top = Infinity;
  let right = -Infinity;
  let bottom = -Infinity;
  let found = false;
  selection.forEachCell((_node, pos) => {
    let dom = editor.view.nodeDOM(pos);
    if (!(dom instanceof HTMLElement)) return;
    let rect = dom.getBoundingClientRect();
    found = true;
    if (rect.left < left) left = rect.left;
    if (rect.top < top) top = rect.top;
    if (rect.right > right) right = rect.right;
    if (rect.bottom > bottom) bottom = rect.bottom;
  });
  if (!found) return null;
  return {
    x: left,
    y: top,
    left,
    top,
    right,
    bottom,
    width: right - left,
    height: bottom - top
  };
}

function readRect(editor: Editor) {
  try {
    return selectedRect(editor.state);
  } catch {
    return null;
  }
}

interface Props {
  editor: Editor | null;
}

interface InlineFormattingProps {
  editor: Editor;
}

function InlineFormatting({ editor }: InlineFormattingProps) {
  return (
    <>
      <Btn
        type="button"
        title="Bold"
        $active={editor.isActive('bold')}
        onClick={() => editor.chain().focus().toggleBold().run()}
      >
        <IconBold />
      </Btn>
      <Btn
        type="button"
        title="Italic"
        $active={editor.isActive('italic')}
        onClick={() => editor.chain().focus().toggleItalic().run()}
      >
        <IconItalic />
      </Btn>
      <Btn
        type="button"
        title="Underline"
        $active={editor.isActive('underline')}
        onClick={() => editor.chain().focus().toggleUnderline().run()}
      >
        <IconUnderline />
      </Btn>
      <Btn
        type="button"
        title="Strikethrough"
        $active={editor.isActive('strike')}
        onClick={() => editor.chain().focus().toggleStrike().run()}
      >
        <IconStrike />
      </Btn>
      <Btn
        type="button"
        title="Inline code"
        $active={editor.isActive('code')}
        onClick={() => editor.chain().focus().toggleCode().run()}
      >
        <IconCode />
      </Btn>
      <Btn
        type="button"
        title="Highlight"
        $active={editor.isActive('highlight')}
        onClick={() => editor.chain().focus().toggleHighlight().run()}
      >
        <IconHighlight />
      </Btn>
    </>
  );
}

export function TableMenu({ editor }: Props) {
  let moveColumn = useCallback(
    (direction: -1 | 1) => {
      if (!editor) return;
      let rect = readRect(editor);
      if (!rect) return;
      let from = rect.left;
      let to = from + direction;
      if (to < 0 || to >= rect.map.width) return;
      moveTableColumn({ from, to })(editor.state, editor.view.dispatch);
      editor.view.focus();
    },
    [editor]
  );

  let moveRow = useCallback(
    (direction: -1 | 1) => {
      if (!editor) return;
      let rect = readRect(editor);
      if (!rect) return;
      let from = rect.top;
      let to = from + direction;
      if (to < 0 || to >= rect.map.height) return;
      moveTableRow({ from, to })(editor.state, editor.view.dispatch);
      editor.view.focus();
    },
    [editor]
  );

  let options = useMemo(() => TABLE_MENU_OPTIONS, []);

  let getReferencedVirtualElement = useCallback(() => {
    if (!editor) return null;
    let readAnchorRect = () => {
      let rect = getSelectionDOMRect(editor);
      if (!rect) return null;
      let context = getTableContext(editor);
      // Keep column controls away from the table's top gutter handles.
      return context === 'column' ? offsetRectTop(rect, -20) : rect;
    };
    let initial = readAnchorRect();
    if (!initial) return null;
    return {
      getBoundingClientRect: () => readAnchorRect() ?? initial
    };
  }, [editor]);

  if (!editor) return null;

  let context = getTableContext(editor);
  let rect = context ? readRect(editor) : null;

  let colIndex = rect?.left ?? 0;
  let rowIndex = rect?.top ?? 0;
  let width = rect?.map.width ?? 0;
  let height = rect?.map.height ?? 0;

  return (
    <BubbleMenu
      editor={editor}
      pluginKey={tableMenuPluginKey}
      options={options}
      shouldShow={tableShouldShow}
      getReferencedVirtualElement={getReferencedVirtualElement}
      updateDelay={0}
    >
      <Floating onMouseDown={e => e.preventDefault()}>
        <InlineFormatting editor={editor} />
        {context !== 'cells' && <Divider />}

        {context === 'column' && (
          <>
            <Btn
              type="button"
              title="Insert column before"
              onClick={() => editor.chain().focus().addColumnBefore().run()}
            >
              <IconColumnInsertLeft />
            </Btn>
            <Btn
              type="button"
              title="Insert column after"
              onClick={() => editor.chain().focus().addColumnAfter().run()}
            >
              <IconColumnInsertRight />
            </Btn>
            <Btn
              type="button"
              title="Move column left"
              disabled={colIndex <= 0}
              onClick={() => moveColumn(-1)}
            >
              <IconColumnMoveLeft />
            </Btn>
            <Btn
              type="button"
              title="Move column right"
              disabled={colIndex >= width - 1}
              onClick={() => moveColumn(1)}
            >
              <IconColumnMoveRight />
            </Btn>
            <Divider />
            <DangerBtn
              type="button"
              title="Delete column"
              disabled={width <= 1}
              onClick={() => editor.chain().focus().deleteColumn().run()}
            >
              <IconColumnDelete />
            </DangerBtn>
          </>
        )}

        {context === 'row' && (
          <>
            <Btn
              type="button"
              title={rowIndex === 0 ? 'Header row stays at top' : 'Insert row above'}
              disabled={rowIndex === 0}
              onClick={() => editor.chain().focus().addRowBefore().run()}
            >
              <IconRowInsertAbove />
            </Btn>
            <Btn
              type="button"
              title="Insert row below"
              onClick={() => editor.chain().focus().addRowAfter().run()}
            >
              <IconRowInsertBelow />
            </Btn>
            <Btn
              type="button"
              title={rowIndex <= 1 ? 'Cannot move past the header row' : 'Move row up'}
              disabled={rowIndex <= 1}
              onClick={() => moveRow(-1)}
            >
              <IconRowMoveUp />
            </Btn>
            <Btn
              type="button"
              title={rowIndex === 0 ? 'Header row stays at top' : 'Move row down'}
              disabled={rowIndex === 0 || rowIndex >= height - 1}
              onClick={() => moveRow(1)}
            >
              <IconRowMoveDown />
            </Btn>
            <Divider />
            <DangerBtn
              type="button"
              title={rowIndex === 0 ? 'Header row cannot be deleted' : 'Delete row'}
              disabled={rowIndex === 0 || height <= 1}
              onClick={() => editor.chain().focus().deleteRow().run()}
            >
              <IconRowDelete />
            </DangerBtn>
          </>
        )}

        {context === 'table' && (
          <DangerBtn
            type="button"
            title="Delete table"
            onClick={() => editor.chain().focus().deleteTable().run()}
          >
            <IconTableDelete />
          </DangerBtn>
        )}
      </Floating>
    </BubbleMenu>
  );
}
