import type { Editor } from '@tiptap/react';
import { useEditorState } from '@tiptap/react';
import { Tooltip } from '@metorial/ui';
import styled from 'styled-components';
import {
  IconBold,
  IconItalic,
  IconUnderline,
  IconStrike,
  IconCode,
  IconHighlight,
  IconLink,
  IconUndo,
  IconRedo
} from './icons';
import { ListDropdown, MoreDropdown, TextTypeDropdown } from './ToolbarDropdowns';

let Bar = styled.div<{ $disabled?: boolean; $visible?: boolean }>`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding: 0 8px;
  background: transparent;
  overflow-x: auto;
  scrollbar-width: thin;
  opacity: ${({ $visible, $disabled }) => (!$visible ? 0 : $disabled ? 0.45 : 1)};
  transform: translateY(${({ $visible }) => ($visible ? '0' : '-4px')});
  pointer-events: ${({ $visible, $disabled }) => (!$visible || $disabled ? 'none' : 'auto')};
  user-select: ${({ $visible, $disabled }) => (!$visible || $disabled ? 'none' : 'auto')};
  transition:
    opacity ${({ theme }) => theme.motion.base},
    transform ${({ theme }) => theme.motion.base};
  max-width: 100%;

  &::-webkit-scrollbar {
    height: 4px;
  }
`;

let Group = styled.div`
  display: flex;
  align-items: center;
  gap: 2px;
  flex-shrink: 0;
`;

let TooltipAnchor = styled.span`
  display: inline-flex;
`;

let Divider = styled.span`
  display: inline-block;
  width: 1px;
  height: 18px;
  margin: 0 6px;
  background: ${({ theme }) => theme.color.border};
  flex-shrink: 0;
`;

let Btn = styled.button<{ $active?: boolean }>`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  padding: 0;
  border: 0;
  background: ${({ $active, theme }) => ($active ? theme.color.bgActive : 'transparent')};
  color: ${({ $active, theme }) => ($active ? theme.color.accent : theme.color.text)};
  border-radius: ${({ theme }) => theme.size.radiusSm};
  cursor: pointer;
  transition:
    background ${({ theme }) => theme.motion.fast},
    color ${({ theme }) => theme.motion.fast};

  &:hover:not(:disabled) {
    background: ${({ theme }) => theme.color.bgHover};
  }

  &:disabled {
    color: ${({ theme }) => theme.color.textSubtle};
    cursor: not-allowed;
  }

  svg {
    width: 16px;
    height: 16px;
  }
`;

interface ToolbarProps {
  editor: Editor | null;
  /** When true, the entire toolbar is visually grayed out and unreachable
   *  (used while the title input has focus). */
  disabled?: boolean;
  /** Invoked when the user clicks the link button in the toolbar. The
   *  consumer is expected to open the inline bubble menu in link-edit
   *  mode at the editor's current selection. */
  onRequestLinkEdit?: () => void;
}

export function Toolbar({ editor, disabled, onRequestLinkEdit }: ToolbarProps) {
  // Subscribe to editor transactions so the active/disabled states track
  // the current selection. We extract just the booleans we render off of
  // so that re-renders are scoped to actual state changes (the default
  // deep-equal comparison from `useEditorState` short-circuits otherwise).
  // The selector is guarded against a destroyed editor: tiptap fires
  // one final "transaction" while tearing the editor down, which can
  // run this selector after `commandManager` / `state` have already been
  // nulled out — accessing `isActive` / `can` on that snapshot throws.
  let state = useEditorState({
    editor,
    selector: ({ editor: e }) => {
      if (!e || e.isDestroyed) return null;
      return {
        bold: e.isActive('bold'),
        italic: e.isActive('italic'),
        underline: e.isActive('underline'),
        strike: e.isActive('strike'),
        code: e.isActive('code'),
        highlight: e.isActive('highlight'),
        link: e.isActive('link'),
        canUndo: e.can().undo(),
        canRedo: e.can().redo()
      };
    }
  });

  let visible = !!editor && !editor.isDestroyed && !!state;

  return (
    <Bar
      $disabled={disabled}
      $visible={visible}
      aria-hidden={disabled || !visible || undefined}
    >
      {visible && editor && state && (
        <>
          <Group>
            <Tooltip content="Undo (Ctrl+Z)" side="bottom">
              <TooltipAnchor>
                <Btn
                  type="button"
                  aria-label="Undo (Ctrl+Z)"
                  onMouseDown={e => e.preventDefault()}
                  onClick={() => editor.chain().focus().undo().run()}
                  disabled={!state.canUndo}
                >
                  <IconUndo />
                </Btn>
              </TooltipAnchor>
            </Tooltip>
            <Tooltip content="Redo (Ctrl+Shift+Z)" side="bottom">
              <TooltipAnchor>
                <Btn
                  type="button"
                  aria-label="Redo (Ctrl+Shift+Z)"
                  onMouseDown={e => e.preventDefault()}
                  onClick={() => editor.chain().focus().redo().run()}
                  disabled={!state.canRedo}
                >
                  <IconRedo />
                </Btn>
              </TooltipAnchor>
            </Tooltip>
          </Group>

          <Divider />

          <Group>
            <TextTypeDropdown editor={editor} />
          </Group>

          <Divider />

          <Group>
            <Tooltip content="Bold (Ctrl+B)" side="bottom">
              <TooltipAnchor>
                <Btn
                  type="button"
                  aria-label="Bold (Ctrl+B)"
                  $active={state.bold}
                  onMouseDown={e => e.preventDefault()}
                  onClick={() => editor.chain().focus().toggleBold().run()}
                >
                  <IconBold />
                </Btn>
              </TooltipAnchor>
            </Tooltip>
            <Tooltip content="Italic (Ctrl+I)" side="bottom">
              <TooltipAnchor>
                <Btn
                  type="button"
                  aria-label="Italic (Ctrl+I)"
                  $active={state.italic}
                  onMouseDown={e => e.preventDefault()}
                  onClick={() => editor.chain().focus().toggleItalic().run()}
                >
                  <IconItalic />
                </Btn>
              </TooltipAnchor>
            </Tooltip>
            <Tooltip content="Underline (Ctrl+U)" side="bottom">
              <TooltipAnchor>
                <Btn
                  type="button"
                  aria-label="Underline (Ctrl+U)"
                  $active={state.underline}
                  onMouseDown={e => e.preventDefault()}
                  onClick={() => editor.chain().focus().toggleUnderline().run()}
                >
                  <IconUnderline />
                </Btn>
              </TooltipAnchor>
            </Tooltip>
            <Tooltip content="Strikethrough" side="bottom">
              <TooltipAnchor>
                <Btn
                  type="button"
                  aria-label="Strikethrough"
                  $active={state.strike}
                  onMouseDown={e => e.preventDefault()}
                  onClick={() => editor.chain().focus().toggleStrike().run()}
                >
                  <IconStrike />
                </Btn>
              </TooltipAnchor>
            </Tooltip>
            <Tooltip content="Inline code" side="bottom">
              <TooltipAnchor>
                <Btn
                  type="button"
                  aria-label="Inline code"
                  $active={state.code}
                  onMouseDown={e => e.preventDefault()}
                  onClick={() => editor.chain().focus().toggleCode().run()}
                >
                  <IconCode />
                </Btn>
              </TooltipAnchor>
            </Tooltip>
            <Tooltip content="Highlight (Mark)" side="bottom">
              <TooltipAnchor>
                <Btn
                  type="button"
                  aria-label="Highlight (Mark)"
                  $active={state.highlight}
                  onMouseDown={e => e.preventDefault()}
                  onClick={() => editor.chain().focus().toggleHighlight().run()}
                >
                  <IconHighlight />
                </Btn>
              </TooltipAnchor>
            </Tooltip>
            <Tooltip content="Link (Ctrl+Shift+K)" side="bottom">
              <TooltipAnchor>
                <Btn
                  type="button"
                  aria-label="Link (Ctrl+Shift+K)"
                  $active={state.link}
                  onMouseDown={e => e.preventDefault()}
                  onClick={() => onRequestLinkEdit?.()}
                  disabled={!onRequestLinkEdit}
                >
                  <IconLink />
                </Btn>
              </TooltipAnchor>
            </Tooltip>
          </Group>

          <Divider />

          <Group>
            <ListDropdown editor={editor} />
          </Group>

          <Divider />

          <Group>
            <MoreDropdown editor={editor} />
          </Group>
        </>
      )}
    </Bar>
  );
}
