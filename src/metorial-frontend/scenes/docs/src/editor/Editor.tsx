import { TextSelection } from '@tiptap/pm/state';
import {
  EditorContent as TiptapEditorContent,
  useEditor,
  type Editor as TiptapEditor
} from '@tiptap/react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import styled, { useTheme } from 'styled-components';
import type { Awareness } from 'y-protocols/awareness';
import type { Doc as YDoc } from 'yjs';
import type { Theme } from '../styles/theme';
import { BlockHandle } from './BlockHandle';
import { CalloutMenu } from './CalloutMenu';
import { EditorBubbleMenu } from './EditorBubbleMenu';
import { EditorContent, EditorScroll, TitleInput } from './EditorStyles';
import type { SharedPerson } from './HeaderActions';
import { useImageUpload, type ImageUploadFn } from './ImageUploadContext';
import { LinkPreviewPopover } from './LinkPreviewPopover';
import { TableMenu } from './TableMenu';
import { TableOfContents } from './TableOfContents';
import { TitleStatusBar } from './TitleStatusBar';
import { buildExtensions } from './extensions';
import { makePlaceholderId, stashPendingFile } from './extensions/ImagePlaceholder';
import { SlashCommand } from './extensions/SlashCommand';
import { slashSuggestion } from './slashMenuRenderer';

interface MarkdownStorage {
  getMarkdown: () => string;
}

let Wrap = styled.div`
  display: flex;
  flex-direction: column;
  flex: 1;
  min-width: 0;
  min-height: 0;
  background: ${({ theme }) => theme.color.bg};
`;

let FrontMatterWrap = styled.div<{ $invalid?: boolean }>`
  margin: -4px 0 18px;
  border: 1px solid
    ${({ $invalid, theme }) => ($invalid ? theme.color.danger : theme.color.border)};
  border-radius: ${({ theme }) => theme.size.radius};
  background: ${({ theme }) => theme.color.bgAlt};
  overflow: hidden;
`;

let FrontMatterFence = styled.div`
  padding: 6px 12px;
  font-family: ${({ theme }) => theme.font.mono};
  font-size: 12px;
  color: ${({ theme }) => theme.color.textSubtle};
  border-bottom: 1px solid ${({ theme }) => theme.color.border};
  background: ${({ theme }) => theme.color.bg};
`;

let FrontMatterInput = styled.textarea`
  display: block;
  width: 100%;
  margin: 0;
  border: 0;
  resize: none;
  outline: 0;
  background: transparent;
  color: ${({ theme }) => theme.color.text};
  font-family: ${({ theme }) => theme.font.mono};
  font-size: 12.5px;
  line-height: 1.5;
  padding: 10px 12px;
  min-height: 92px;
  box-sizing: border-box;

  &::placeholder {
    color: ${({ theme }) => theme.color.textSubtle};
  }
`;

let FrontMatterError = styled.div`
  padding: 8px 12px 10px;
  border-top: 1px solid ${({ theme }) => theme.color.border};
  font-size: 12px;
  color: ${({ theme }) => theme.color.danger};
  background: ${({ theme }) => theme.color.bg};
`;

interface EditorProps {
  initialMarkdown: string;
  readOnly?: boolean;
  title: string;
  frontMatter?: string;
  frontMatterOpen?: boolean;
  frontMatterError?: string | null;
  onTitleChange: (title: string) => void;
  onMarkdownChange: (markdown: string) => void;
  onFrontMatterChange?: (frontMatter: string) => void;
  onToggleFrontMatter?: () => void;
  /** Bubbles the underlying tiptap editor instance up to the App so the
   *  toolbar (now hosted in the top header) can drive it. Called with
   *  `null` on unmount. */
  onEditorReady?: (editor: TiptapEditor | null) => void;
  /** Notifies the App when the top toolbar should be disabled (e.g. while
   *  editing the title, front matter, code blocks, or equations). */
  onTitleFocusChange?: (focused: boolean) => void;
  /** Counter that should increment whenever the toolbar's link button is
   *  pressed; the bubble menu reacts by entering link-edit mode at the
   *  current selection / cursor position. */
  linkPromptToken?: number;
  /** Requests opening link edit mode (e.g. from keyboard shortcut). */
  onRequestLinkEdit?: () => void;
  statusCurrentUser?: {
    name: string;
    email: string;
    imageUrl?: string;
    role: 'editor' | 'viewer';
  };
  statusEditors?: SharedPerson[];
  statusUpdatedAt?: Date;
  statusWordCount?: number;
  statusCharCount?: number;
  onOpenPageInfo?: () => void;
  allowInitialHashScroll?: boolean;
  onInitialHashScrollComplete?: () => void;
  collaboration?: {
    ydoc: YDoc;
    awareness: Awareness;
    user: {
      name: string;
      color: string;
      imageUrl?: string;
    };
    onFirstRender?: () => void;
  };
}

export function Editor({
  initialMarkdown,
  readOnly = false,
  title,
  frontMatter = '',
  frontMatterOpen = false,
  frontMatterError = null,
  onTitleChange,
  onMarkdownChange,
  onFrontMatterChange,
  onToggleFrontMatter,
  onEditorReady,
  onTitleFocusChange,
  linkPromptToken,
  onRequestLinkEdit,
  statusCurrentUser,
  statusEditors,
  statusUpdatedAt,
  statusWordCount,
  statusCharCount,
  onOpenPageInfo,
  allowInitialHashScroll,
  onInitialHashScrollComplete,
  collaboration
}: EditorProps) {
  let theme = useTheme() as Theme;
  let themeRef = useRef(theme);
  themeRef.current = theme;

  let upload = useImageUpload();
  let uploadRef = useRef<ImageUploadFn>(upload);
  uploadRef.current = upload;

  // Forward declaration: we need to reference the editor instance from
  // editorProps (created before `useEditor` returns). The ref is filled
  // in once tiptap hands the instance back.
  let editorRef = useRef<TiptapEditor | null>(null);

  let titleRef = useRef<HTMLTextAreaElement | null>(null);
  let frontMatterRef = useRef<HTMLTextAreaElement | null>(null);
  let scrollRef = useRef<HTMLDivElement | null>(null);
  let [blockMenuOpen, setBlockMenuOpen] = useState(false);
  let [titleInputFocused, setTitleInputFocused] = useState(false);
  let [frontMatterFocused, setFrontMatterFocused] = useState(false);
  let [structuredBlockFocused, setStructuredBlockFocused] = useState(false);

  /** Move focus to the title input and place the caret at the end. */
  let focusTitle = useCallback(() => {
    let el = titleRef.current;
    if (!el) return;
    el.focus();
    let len = el.value.length;
    // setSelectionRange after focus so the caret is at the end of the title
    requestAnimationFrame(() => el.setSelectionRange(len, len));
  }, []);

  // Build extensions exactly once. Re-creating the array on every render
  // makes tiptap's `useEditor` consider the options changed and replay
  // `setOptions`, which in turn updates the editor view state on every
  // render and trips up other plugins (e.g. the suggestion plugin behind
  // the slash menu).
  let extensions = useMemo(
    () => [
      ...buildExtensions(
        collaboration
          ? {
              collaboration: {
                ydoc: collaboration.ydoc,
                awareness: collaboration.awareness,
                user: collaboration.user,
                onFirstRender: collaboration.onFirstRender
              }
            }
          : undefined
      ),
      SlashCommand.configure({
        suggestion: slashSuggestion(() => themeRef.current)
      })
    ],
    [collaboration]
  );

  let editor = useEditor({
    extensions: extensions as any,
    content: collaboration ? undefined : initialMarkdown,
    editable: !readOnly,
    autofocus: false,
    immediatelyRender: true,
    shouldRerenderOnTransaction: true,
    editorProps: {
      attributes: {
        spellcheck: 'true',
        class: 'tiptap-editor'
      },
      handleDrop: (view, event, _slice, moved) => {
        // Don't intercept internal moves — that would break dragging
        // existing blocks/cells around inside the editor.
        if (moved) return false;
        let dt = (event as DragEvent).dataTransfer;
        let files = Array.from(dt?.files ?? []).filter(f => f.type.startsWith('image/'));
        if (!files.length) return false;

        let coords = {
          left: (event as DragEvent).clientX,
          top: (event as DragEvent).clientY
        };
        let dropPos = view.posAtCoords(coords)?.pos ?? view.state.selection.from;

        let ed = editorRef.current;
        if (!ed) return false;

        event.preventDefault();
        insertImagePlaceholdersForFiles(ed, files, dropPos);
        return true;
      },
      handlePaste: (_view, event) => {
        let dt = event.clipboardData;
        let files = Array.from(dt?.files ?? []).filter(f => f.type.startsWith('image/'));
        if (!files.length) return false;

        let ed = editorRef.current;
        if (!ed) return false;

        event.preventDefault();
        insertImagePlaceholdersForFiles(ed, files, ed.state.selection.from);
        return true;
      },
      // ArrowUp on the first visual line of the editor jumps to the title
      // input. Backspace at the document start jumps too — and removes the
      // first block first if it's empty so users can collapse the doc back
      // toward the title.
      handleKeyDown: (view, event) => {
        let isLinkShortcut =
          (event.metaKey || event.ctrlKey) &&
          event.shiftKey &&
          !event.altKey &&
          event.key.toLowerCase() === 'k';
        if (isLinkShortcut) {
          if (!onRequestLinkEdit) return false;
          event.preventDefault();
          onRequestLinkEdit();
          return true;
        }
        if (event.shiftKey || event.metaKey || event.ctrlKey || event.altKey) {
          return false;
        }
        let { state } = view;
        let { selection } = state;
        if (!selection.empty) return false;

        if (event.key === 'ArrowUp') {
          try {
            let cursor = view.coordsAtPos(selection.from);
            let docStart = view.coordsAtPos(1);
            let lineHeight = Math.max(1, cursor.bottom - cursor.top);
            if (cursor.top - docStart.top < lineHeight * 0.5) {
              event.preventDefault();
              focusTitle();
              return true;
            }
          } catch {
            // coordsAtPos can throw on transient state — fall through to
            // ProseMirror's default ArrowUp handling.
            return false;
          }
          return false;
        }

        if (event.key === 'ArrowLeft') {
          let docStart = TextSelection.atStart(state.doc).from;
          if (selection.from === docStart) {
            event.preventDefault();
            focusTitle();
            return true;
          }
          return false;
        }

        if (event.key === 'Backspace') {
          let docStart = TextSelection.atStart(state.doc).from;
          if (selection.from !== docStart) return false;

          let firstBlock = state.doc.firstChild;
          let firstBlockEmpty =
            !!firstBlock && firstBlock.isTextblock && firstBlock.content.size === 0;

          // Drop an empty first block so the doc visually shrinks back into
          // the title. We only do this when there's content below — never
          // leave the doc completely empty (ProseMirror always needs at
          // least one block).
          if (firstBlockEmpty && state.doc.childCount > 1 && firstBlock) {
            let tr = state.tr.delete(0, firstBlock.nodeSize);
            view.dispatch(tr);
          }
          event.preventDefault();
          focusTitle();
          return true;
        }

        return false;
      }
    },
    onUpdate: ({ editor }) => {
      let storage = editor.storage as unknown as {
        markdown?: MarkdownStorage;
      };
      let md = storage.markdown?.getMarkdown() ?? '';
      onMarkdownChange(md);
    }
  });

  useEffect(() => {
    if (!collaboration) return;

    collaboration.awareness.setLocalStateField('user', collaboration.user);
  }, [collaboration]);

  useEffect(() => {
    if (!editor) return;
    editor.setEditable(!readOnly, false);
  }, [editor, readOnly]);

  // Keep editorRef in sync so editorProps callbacks (which were created
  // before tiptap returned the instance) can drive commands.
  useEffect(() => {
    editorRef.current = editor;
    return () => {
      editorRef.current = null;
    };
  }, [editor]);

  // Surface the editor instance to the parent (App) so the toolbar that
  // now lives in the top header can act on it. Reset on unmount so a
  // remounted Editor (e.g. after import) gets a fresh hand-off.
  useEffect(() => {
    onEditorReady?.(editor);
    return () => {
      onEditorReady?.(null);
    };
  }, [editor, onEditorReady]);

  useEffect(() => {
    let el = titleRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [title]);

  useEffect(() => {
    if (!frontMatterOpen) return;
    let el = frontMatterRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.max(el.scrollHeight, 92)}px`;
  }, [frontMatter, frontMatterOpen]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (window.location.hash.trim()) return;
    let scroller = scrollRef.current;
    if (!scroller) return;
    let raf = window.requestAnimationFrame(() => {
      if (window.location.hash.trim()) return;
      scroller.scrollTop = 0;
    });
    return () => {
      window.cancelAnimationFrame(raf);
    };
  }, []);

  useEffect(() => {
    if (!readOnly) return;
    setBlockMenuOpen(false);
  }, [readOnly]);

  useEffect(() => {
    if (!editor) {
      setStructuredBlockFocused(false);
      return;
    }
    let root = editor.view.dom;
    let isStructured = (el: Element | null) =>
      !!el?.closest('.code-block-wrapper, .equation-block-wrapper');
    let raf = 0;

    let updateStructuredFocused = () => {
      let active = document.activeElement;
      let activeEl = active instanceof Element ? active : null;
      let byDom = !!activeEl && root.contains(activeEl) && isStructured(activeEl);
      let bySelection =
        editor.isFocused && (editor.isActive('codeBlock') || editor.isActive('equationBlock'));
      let next = byDom || bySelection;
      setStructuredBlockFocused(prev => (prev === next ? prev : next));
    };

    let scheduleUpdate = () => {
      window.cancelAnimationFrame(raf);
      raf = window.requestAnimationFrame(updateStructuredFocused);
    };

    let onFocusIn = () => scheduleUpdate();
    let onFocusOut = () => scheduleUpdate();
    let onEditorUpdate = () => scheduleUpdate();

    root.addEventListener('focusin', onFocusIn);
    root.addEventListener('focusout', onFocusOut);
    editor.on('selectionUpdate', onEditorUpdate);
    editor.on('focus', onEditorUpdate);
    editor.on('blur', onEditorUpdate);
    editor.on('transaction', onEditorUpdate);
    updateStructuredFocused();
    return () => {
      window.cancelAnimationFrame(raf);
      root.removeEventListener('focusin', onFocusIn);
      root.removeEventListener('focusout', onFocusOut);
      editor.off('selectionUpdate', onEditorUpdate);
      editor.off('focus', onEditorUpdate);
      editor.off('blur', onEditorUpdate);
      editor.off('transaction', onEditorUpdate);
      setStructuredBlockFocused(false);
    };
  }, [editor]);

  useEffect(() => {
    if (!frontMatterOpen) {
      setFrontMatterFocused(false);
    }
  }, [frontMatterOpen]);

  useEffect(() => {
    if (!readOnly) return;
    setTitleInputFocused(false);
    setFrontMatterFocused(false);
    setStructuredBlockFocused(false);
  }, [readOnly]);

  let toolbarDisabled = titleInputFocused || frontMatterFocused || structuredBlockFocused;

  useEffect(() => {
    onTitleFocusChange?.(toolbarDisabled);
  }, [toolbarDisabled, onTitleFocusChange]);

  let handleTitleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (!editor || readOnly) return;

      if (e.key === 'Enter') {
        e.preventDefault();
        // Insert an empty paragraph at the very top of the document and
        // place the caret inside it. Position 0 is before the first block;
        // position 1 lands the cursor inside the freshly inserted paragraph.
        editor
          .chain()
          .insertContentAt(0, { type: 'paragraph' })
          .setTextSelection(1)
          .focus()
          .run();
        return;
      }

      if (e.key === 'ArrowDown') {
        let el = titleRef.current;
        if (!el) return;
        // Only jump out of the title when the caret is on the last visual
        // line of the textarea. We approximate this by checking that no
        // text remains after the caret on its own line.
        let value = el.value;
        let caret = el.selectionStart;
        let remainder = value.slice(caret);
        if (!remainder.includes('\n')) {
          e.preventDefault();
          editor.commands.focus('start');
        }
        return;
      }

      if (e.key === 'ArrowRight') {
        let el = titleRef.current;
        if (!el) return;
        // Caret at the end of the title (no selection) → step into editor.
        if (el.selectionStart === el.value.length && el.selectionEnd === el.value.length) {
          e.preventDefault();
          editor.commands.focus('start');
        }
      }
    },
    [editor, readOnly]
  );

  return (
    <Wrap>
      <EditorScroll ref={scrollRef}>
        <EditorContent $readOnly={readOnly}>
          <TitleInput
            ref={titleRef}
            value={title}
            placeholder="Untitled"
            spellCheck
            readOnly={readOnly}
            rows={1}
            onFocus={() => {
              if (readOnly) return;
              setTitleInputFocused(true);
            }}
            onBlur={() => {
              if (readOnly) return;
              setTitleInputFocused(false);
            }}
            onChange={e => onTitleChange(e.target.value)}
            onKeyDown={handleTitleKeyDown}
          />
          {statusCurrentUser &&
            statusEditors &&
            statusUpdatedAt &&
            typeof statusWordCount === 'number' &&
            typeof statusCharCount === 'number' && (
              <TitleStatusBar
                currentUser={statusCurrentUser}
                editors={statusEditors}
                updatedAt={statusUpdatedAt}
                wordCount={statusWordCount}
                charCount={statusCharCount}
                frontMatterOpen={frontMatterOpen}
                hasFrontMatter={frontMatter.trim().length > 0}
                frontMatterError={frontMatterError}
                onToggleFrontMatter={onToggleFrontMatter}
                onOpenPageInfo={onOpenPageInfo}
              />
            )}
          {frontMatterOpen && (
            <FrontMatterWrap $invalid={!!frontMatterError}>
              <FrontMatterFence>---</FrontMatterFence>
              <FrontMatterInput
                ref={frontMatterRef}
                value={frontMatter}
                readOnly={readOnly}
                placeholder="key: value"
                spellCheck={false}
                onFocus={() => {
                  if (readOnly) return;
                  setFrontMatterFocused(true);
                }}
                onBlur={() => {
                  if (readOnly) return;
                  setFrontMatterFocused(false);
                }}
                onChange={e => onFrontMatterChange?.(e.target.value)}
              />
              <FrontMatterFence>---</FrontMatterFence>
              {frontMatterError && <FrontMatterError>{frontMatterError}</FrontMatterError>}
            </FrontMatterWrap>
          )}
          <TiptapEditorContent editor={editor} />
        </EditorContent>
      </EditorScroll>
      {editor && (
        <TableOfContents
          editor={editor}
          scrollContainerRef={scrollRef}
          documentTitle={title}
          allowInitialHashScroll={allowInitialHashScroll}
          onInitialHashScrollComplete={onInitialHashScrollComplete}
        />
      )}
      {!readOnly && (
        <>
          <EditorBubbleMenu editor={editor} linkPromptToken={linkPromptToken} />
          <TableMenu editor={editor} />
          <CalloutMenu editor={editor} />
          {editor && <BlockHandle editor={editor} onMenuOpenChange={setBlockMenuOpen} />}
        </>
      )}
      {editor && <LinkPreviewPopover editor={editor} suppress={blockMenuOpen} />}
    </Wrap>
  );
}

/**
 * Insert one image placeholder per dropped/pasted file at the given
 * position. Each placeholder gets a stashed `File` reference and an
 * `autoUpload` flag so its NodeView kicks off the upload on mount.
 *
 * Files are inserted in reverse order from the bottom up so the
 * computed insertion offsets don't have to be re-calculated as the
 * document grows.
 */
function insertImagePlaceholdersForFiles(editor: TiptapEditor, files: File[], pos: number) {
  for (let i = files.length - 1; i >= 0; i--) {
    let file = files[i];
    let id = makePlaceholderId();
    let key = stashPendingFile(editor, file);
    editor
      .chain()
      .insertContentAt(pos, {
        type: 'imagePlaceholder',
        attrs: {
          id,
          fileName: file.name,
          autoUpload: true,
          pendingFileKey: key,
          status: 'uploading'
        }
      })
      .run();
  }
}
