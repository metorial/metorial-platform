import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { BubbleMenu } from '@tiptap/react/menus';
import type { Editor } from '@tiptap/react';
import { PluginKey, type EditorState } from '@tiptap/pm/state';
import { CellSelection } from '@tiptap/pm/tables';
import { getMarkRange } from '@tiptap/core';
import styled from 'styled-components';
import { menuEnter } from './animations';
import {
  IconBold,
  IconItalic,
  IconUnderline,
  IconStrike,
  IconCode,
  IconHighlight,
  IconLink,
  IconExternalLink,
  IconUnlink,
  IconClose,
  IconCheck
} from './icons';
import { validateLinkUrl } from './url';
import { InlineTurnIntoDropdown } from './ToolbarDropdowns';

let Floating = styled.div`
  display: flex;
  align-items: center;
  gap: 1px;
  padding: 4px;
  background: ${({ theme }) => theme.color.bgElevated};
  border: 1px solid ${({ theme }) => theme.color.border};
  border-radius: 10px;
  box-shadow: ${({ theme }) => theme.shadow.lg};
  backdrop-filter: blur(12px);
  transform-origin: center bottom;
  ${menuEnter(140)}
`;

let Btn = styled.button<{ $active?: boolean; $danger?: boolean }>`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  padding: 0;
  border: 0;
  background: ${({ $active, theme }) => ($active ? theme.color.bgActive : 'transparent')};
  color: ${({ $active, $danger, theme }) =>
    $danger ? theme.color.danger : $active ? theme.color.accent : theme.color.text};
  border-radius: ${({ theme }) => theme.size.radiusSm};
  cursor: pointer;
  transition: background ${({ theme }) => theme.motion.fast};

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

let Divider = styled.span`
  display: inline-block;
  width: 1px;
  height: 18px;
  margin: 0 4px;
  background: ${({ theme }) => theme.color.border};
`;

let LinkEditor = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0;
  padding: 0;
  min-width: 320px;
  max-width: 420px;
`;

let LinkRow = styled.div`
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 2px;
`;

let LinkInput = styled.input<{ $invalid?: boolean }>`
  flex: 1;
  height: 26px;
  padding: 0 8px;
  border: 0;
  background: transparent;
  color: ${({ theme }) => theme.color.text};
  font: inherit;
  font-size: 13px;
  outline: none;
  border-radius: ${({ theme }) => theme.size.radiusSm};
  min-width: 0;

  &::placeholder {
    color: ${({ theme }) => theme.color.textSubtle};
  }

  ${({ $invalid, theme }) => $invalid && `box-shadow: inset 0 0 0 1px ${theme.color.danger};`}
`;

let LinkError = styled.div`
  padding: 4px 10px 6px;
  font-size: 11.5px;
  color: ${({ theme }) => theme.color.danger};
  border-top: 1px solid ${({ theme }) => theme.color.border};
`;

interface Props {
  editor: Editor | null;
  /** A counter that should increment whenever the toolbar's link button is
   *  clicked. The bubble menu will then open in link-edit mode at the
   *  current selection (or current cursor, if the selection is empty). */
  linkPromptToken?: number;
}

let BUBBLE_MENU_OPTIONS = { placement: 'top', offset: 8 } as const;

let inlineBubbleMenuPluginKey = new PluginKey('inlineBubbleMenu');

let bubbleShouldShow = ({
  editor: e,
  from,
  to,
  state,
  element
}: {
  editor: Editor;
  from: number;
  to: number;
  state: EditorState;
  element: HTMLElement;
}) => {
  // While link mode is open, the menu wrapper has data-link-mode="true".
  // Keep the menu visible regardless of selection state in that case.
  if (element?.querySelector('[data-link-mode="true"]')) return true;

  if (from === to) return false;
  if (state.selection instanceof CellSelection) return false;
  if (e.isActive('image')) return false;
  if (e.isActive('codeBlock')) return false;
  let text = state.doc.textBetween(from, to, ' ').trim();
  return text.length > 0;
};

interface SavedRange {
  from: number;
  to: number;
}

/**
 * Resolve the range that an "edit link" action should target. If the
 * selection is non-empty we use that. If the selection is collapsed but
 * sits inside an existing link mark we expand to the full mark. Otherwise
 * we return the collapsed cursor position.
 */
function resolveLinkTargetRange(editor: Editor): SavedRange {
  let { selection, schema } = editor.state;
  let { from, to } = selection;
  if (from !== to) return { from, to };

  let linkMark = schema.marks.link;
  if (linkMark) {
    let range = getMarkRange(selection.$from, linkMark);
    if (range) return { from: range.from, to: range.to };
  }
  return { from, to };
}

export function EditorBubbleMenu({ editor, linkPromptToken }: Props) {
  let [mode, setMode] = useState<'menu' | 'link'>('menu');
  let [linkUrl, setLinkUrl] = useState('');
  let [linkError, setLinkError] = useState<string | null>(null);
  let [savedRange, setSavedRange] = useState<SavedRange | null>(null);
  // True when we forced the menu to show despite an empty selection (eg
  // entered link mode from the toolbar with no text selected). Used to
  // hide the menu again when link mode is dismissed.
  let [forcedVisible, setForcedVisible] = useState(false);

  let inputRef = useRef<HTMLInputElement | null>(null);

  let closeLinkMode = useCallback(
    (opts: { hideMenu?: boolean } = {}) => {
      setMode('menu');
      setLinkError(null);
      if (!editor) return;
      let shouldHide = opts.hideMenu ?? forcedVisible;
      if (shouldHide) {
        editor.view.dispatch(editor.state.tr.setMeta(inlineBubbleMenuPluginKey, 'hide'));
      } else {
        editor.commands.focus();
      }
      setForcedVisible(false);
      setSavedRange(null);
    },
    [editor, forcedVisible]
  );

  let enterLinkMode = useCallback(
    (opts: { force?: boolean } = {}) => {
      if (!editor) return;
      let range = resolveLinkTargetRange(editor);
      let existingHref = (editor.getAttributes('link').href as string | undefined) ?? '';
      let isEmpty = range.from === range.to;
      // Flush state updates synchronously so that when we dispatch the
      // BubbleMenu plugin's "show" meta below, the React-rendered portal
      // already contains the link editor markup (otherwise users would
      // briefly see the formatting buttons appear before being replaced).
      flushSync(() => {
        setSavedRange(range);
        setLinkUrl(existingHref);
        setLinkError(null);
        setMode('link');
        setForcedVisible(opts.force ? true : isEmpty);
      });
      if (opts.force) {
        editor.view.dispatch(editor.state.tr.setMeta(inlineBubbleMenuPluginKey, 'show'));
      }
    },
    [editor]
  );

  // External trigger: toolbar link button was clicked.
  let lastTokenRef = useRef<number | undefined>(linkPromptToken);
  useEffect(() => {
    if (linkPromptToken === undefined) return;
    if (linkPromptToken === lastTokenRef.current) return;
    lastTokenRef.current = linkPromptToken;
    enterLinkMode({ force: true });
  }, [linkPromptToken, enterLinkMode]);

  // Auto-focus + select the URL input whenever we enter link mode.
  useLayoutEffect(() => {
    if (mode !== 'link') return;
    let el = inputRef.current;
    if (!el) return;
    // Defer to next frame so the element is fully attached/visible.
    requestAnimationFrame(() => {
      el.focus();
      el.select();
    });
  }, [mode]);

  // If the editor's selection moves while link mode is open via natural
  // user interaction (clicking elsewhere in the editor, typing, etc.),
  // exit link mode. The check guards against the dispatch we trigger
  // ourselves to force-show the menu.
  useEffect(() => {
    if (!editor || mode !== 'link') return;
    let handler = ({ transaction }: { transaction: { selectionSet: boolean } }) => {
      if (!transaction.selectionSet) return;
      // The selection actually moved (not just doc-only changes).
      setMode('menu');
      setLinkError(null);
      if (forcedVisible) {
        editor.view.dispatch(editor.state.tr.setMeta(inlineBubbleMenuPluginKey, 'hide'));
      }
      setForcedVisible(false);
      setSavedRange(null);
    };
    editor.on('selectionUpdate', handler);
    return () => {
      editor.off('selectionUpdate', handler);
    };
  }, [editor, mode, forcedVisible]);

  // Click-outside dismissal: while editing a link, clicks anywhere outside
  // the editor and the menu should cancel link mode and hide the menu.
  // The bubble-menu plugin only handles editor blur, which doesn't fire
  // when focus is already on our URL input.
  useEffect(() => {
    if (!editor || mode !== 'link') return;
    let onMouseDown = (e: MouseEvent) => {
      let target = e.target as Node | null;
      if (!target) return;
      if (editor.view.dom.contains(target)) return;
      let menu = inputRef.current?.closest('[data-link-mode="true"]');
      if (menu && menu.contains(target)) return;
      closeLinkMode({ hideMenu: true });
    };
    document.addEventListener('mousedown', onMouseDown, true);
    return () => document.removeEventListener('mousedown', onMouseDown, true);
  }, [editor, mode, closeLinkMode]);

  let applyLink = useCallback(() => {
    if (!editor || !savedRange) return;
    let result = validateLinkUrl(linkUrl);
    if (!result.ok) {
      setLinkError(result.reason);
      return;
    }
    let { from, to } = savedRange;
    let isEmpty = from === to;
    if (isEmpty) {
      // Insert the URL as link text at the saved position.
      editor
        .chain()
        .focus()
        .insertContentAt(from, [
          {
            type: 'text',
            text: result.url,
            marks: [{ type: 'link', attrs: { href: result.url } }]
          }
        ])
        .run();
    } else {
      editor
        .chain()
        .focus()
        .setTextSelection({ from, to })
        .extendMarkRange('link')
        .setLink({ href: result.url })
        .setTextSelection(to)
        .run();
    }
    closeLinkMode({ hideMenu: isEmpty });
  }, [editor, savedRange, linkUrl, closeLinkMode]);

  let removeLink = useCallback(() => {
    if (!editor || !savedRange) return;
    editor
      .chain()
      .focus()
      .setTextSelection(savedRange)
      .extendMarkRange('link')
      .unsetLink()
      .run();
    closeLinkMode({ hideMenu: false });
  }, [editor, savedRange, closeLinkMode]);

  let openLink = useCallback(() => {
    let result = validateLinkUrl(linkUrl);
    if (!result.ok) {
      setLinkError(result.reason);
      return;
    }
    window.open(result.url, '_blank', 'noopener,noreferrer');
  }, [linkUrl]);

  let options = useMemo(() => BUBBLE_MENU_OPTIONS, []);

  if (!editor) return null;

  let hasExistingLink = !!editor.getAttributes('link').href;

  return (
    <BubbleMenu
      editor={editor}
      pluginKey={inlineBubbleMenuPluginKey}
      options={options}
      shouldShow={bubbleShouldShow}
    >
      <Floating onMouseDown={e => e.preventDefault()}>
        {mode === 'menu' ? (
          <>
            <InlineTurnIntoDropdown editor={editor} />
            <Divider />
            <Btn
              type="button"
              $active={editor.isActive('bold')}
              onClick={() => editor.chain().focus().toggleBold().run()}
              title="Bold"
            >
              <IconBold />
            </Btn>
            <Btn
              type="button"
              $active={editor.isActive('italic')}
              onClick={() => editor.chain().focus().toggleItalic().run()}
              title="Italic"
            >
              <IconItalic />
            </Btn>
            <Btn
              type="button"
              $active={editor.isActive('underline')}
              onClick={() => editor.chain().focus().toggleUnderline().run()}
              title="Underline"
            >
              <IconUnderline />
            </Btn>
            <Btn
              type="button"
              $active={editor.isActive('strike')}
              onClick={() => editor.chain().focus().toggleStrike().run()}
              title="Strikethrough"
            >
              <IconStrike />
            </Btn>
            <Divider />
            <Btn
              type="button"
              $active={editor.isActive('code')}
              onClick={() => editor.chain().focus().toggleCode().run()}
              title="Inline code"
            >
              <IconCode />
            </Btn>
            <Btn
              type="button"
              $active={editor.isActive('highlight')}
              onClick={() => editor.chain().focus().toggleHighlight().run()}
              title="Highlight"
            >
              <IconHighlight />
            </Btn>
            <Btn
              type="button"
              $active={editor.isActive('link')}
              onClick={() => enterLinkMode()}
              title="Link"
            >
              <IconLink />
            </Btn>
          </>
        ) : (
          <LinkEditor data-link-mode="true">
            <LinkRow>
              <LinkInput
                ref={inputRef}
                type="text"
                inputMode="url"
                spellCheck={false}
                autoCapitalize="off"
                autoCorrect="off"
                placeholder="Paste or type a link…"
                value={linkUrl}
                $invalid={!!linkError}
                onChange={e => {
                  setLinkUrl(e.target.value);
                  if (linkError) setLinkError(null);
                }}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    applyLink();
                  } else if (e.key === 'Escape') {
                    e.preventDefault();
                    closeLinkMode();
                  }
                }}
              />
              {hasExistingLink && (
                <Btn
                  type="button"
                  onClick={openLink}
                  title="Open link in a new tab"
                  disabled={!linkUrl.trim()}
                >
                  <IconExternalLink />
                </Btn>
              )}
              <Btn
                type="button"
                onClick={applyLink}
                title="Apply link (Enter)"
                disabled={!linkUrl.trim()}
              >
                <IconCheck />
              </Btn>
              {hasExistingLink ? (
                <Btn type="button" $danger onClick={removeLink} title="Remove link">
                  <IconUnlink />
                </Btn>
              ) : (
                <Btn type="button" onClick={() => closeLinkMode()} title="Cancel (Esc)">
                  <IconClose />
                </Btn>
              )}
            </LinkRow>
            {linkError && <LinkError>{linkError}</LinkError>}
          </LinkEditor>
        )}
      </Floating>
    </BubbleMenu>
  );
}
