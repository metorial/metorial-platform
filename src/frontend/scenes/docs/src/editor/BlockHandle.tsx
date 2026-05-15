import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { DragHandle } from '@tiptap/extension-drag-handle-react';
import type { Editor } from '@tiptap/react';
import type { Node as ProseMirrorNode } from '@tiptap/pm/model';
import { TextSelection } from '@tiptap/pm/state';
import { offset } from '@floating-ui/dom';
import styled from 'styled-components';
import { IconGrip } from './icons';
import { BlockMenu } from './BlockMenu';
import type { SlashItem } from './SlashMenu';

let HIDDEN_NODE_TYPES = new Set(['table']);

function measureFirstLineHeight(dom: HTMLElement): number {
  let cs = getComputedStyle(dom);
  let lineHeight = parseFloat(cs.lineHeight);
  if (isNaN(lineHeight) || cs.lineHeight === 'normal') {
    let fontSize = parseFloat(cs.fontSize) || 16;
    lineHeight = fontSize * 1.4;
  }
  return lineHeight;
}

function getHandleCrossAxis({
  dom,
  nodeType,
  handleHeight,
  referenceHeight
}: {
  dom: HTMLElement;
  nodeType: string | null | undefined;
  handleHeight: number;
  referenceHeight?: number;
}): number {
  // Horizontal rules are visually a 1px line with large outer margins.
  // Centering the handle against line-height places it too low; use the
  // actual node box height so the gutter aligns with the line itself.
  if (nodeType === 'horizontalRule') {
    let height = referenceHeight ?? dom.getBoundingClientRect().height;
    return height / 2 - handleHeight / 2 + 2;
  }
  let lineHeight = measureFirstLineHeight(dom);
  return Math.max(0, lineHeight / 2 - handleHeight / 2);
}

let HandleBtn = styled.button`
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  padding: 0;
  border: 0;
  background: transparent;
  color: ${({ theme }) => theme.color.textSubtle};
  border-radius: 4px;
  cursor: grab;
  transition:
    background ${({ theme }) => theme.motion.fast},
    color ${({ theme }) => theme.motion.fast};

  /* Transparent bridge that extends the hit-area into the gap toward the
     block, so mousing from the editor onto the handle stays inside the
     drag-handle wrapper (otherwise the plugin's mouseleave handler would
     hide the handle as soon as the cursor crosses the gap). */
  &::after {
    content: '';
    position: absolute;
    top: -4px;
    bottom: -4px;
    left: 100%;
    width: 12px;
  }

  &:hover {
    background: ${({ theme }) => theme.color.bgAlt};
    color: ${({ theme }) => theme.color.text};
  }

  &:active {
    cursor: grabbing;
  }

  svg {
    width: 16px;
    height: 16px;
  }
`;

let PinnedHandle = styled.div`
  position: fixed;
  z-index: 1001;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border-radius: 4px;
  background: ${({ theme }) => theme.color.bgAlt};
  color: ${({ theme }) => theme.color.text};
  box-shadow: ${({ theme }) => theme.shadow.sm};
  pointer-events: none;

  svg {
    width: 16px;
    height: 16px;
  }
`;

interface Props {
  editor: Editor;
  onMenuOpenChange?: (open: boolean) => void;
}

function getTopLevelNodeAtPos(
  doc: ProseMirrorNode,
  pos: number
): { index: number; pos: number; node: ProseMirrorNode } | null {
  let safePos = Math.min(Math.max(pos, 0), doc.content.size);
  let $pos = doc.resolve(safePos);
  let topLevelPos = $pos.depth > 0 ? $pos.before(1) : safePos;

  let exact: { index: number; pos: number; node: ProseMirrorNode } | null = null;
  doc.forEach((child, offset, index) => {
    if (offset === topLevelPos) exact = { index, pos: offset, node: child };
  });
  if (exact) return exact;

  let running = 0;
  for (let i = 0; i < doc.childCount; i += 1) {
    let child = doc.child(i);
    let end = running + child.nodeSize;
    if (topLevelPos >= running && topLevelPos < end) {
      return { index: i, pos: running, node: child };
    }
    running = end;
  }
  return null;
}

function getCurrentBlockLabel(target: ProseMirrorNode | null): string | undefined {
  if (!target) return undefined;
  if (target.type.name === 'paragraph') return 'Text';
  if (target.type.name === 'heading') return `Heading ${target.attrs.level ?? 1}`;
  if (target.type.name === 'bulletList') return 'Bullet list';
  if (target.type.name === 'orderedList') return 'Numbered list';
  if (target.type.name === 'taskList') return 'To-do list';
  if (target.type.name === 'blockquote') return 'Quote';
  if (target.type.name === 'codeBlock') return 'Code block';
  if (target.type.name === 'equationBlock') return 'Equation';
  if (target.type.name === 'callout') {
    let type = target.attrs.type;
    if (type === 'warning') return 'Warning callout';
    if (type === 'success') return 'Success callout';
    if (type === 'danger') return 'Danger callout';
    return 'Info callout';
  }
  return undefined;
}

export function BlockHandle({ editor, onMenuOpenChange }: Props) {
  let currentRef = useRef<{
    node: ProseMirrorNode;
    pos: number;
    dom: HTMLElement | null;
  } | null>(null);
  let [currentNodeType, setCurrentNodeType] = useState<string | null>(null);
  let [menuOpen, setMenuOpen] = useState(false);
  let [activeTitle, setActiveTitle] = useState<string | undefined>(undefined);
  let [codeLanguage, setCodeLanguage] = useState('plaintext');
  let [isImageBlock, setIsImageBlock] = useState(false);
  let [headingLink, setHeadingLink] = useState<string | undefined>(undefined);
  // Anchor is preserved across closes so the exit animation has a position
  // to render at after `menuOpen` flips to false.
  let [menuAnchor, setMenuAnchor] = useState<{ left: number; top: number }>({
    left: 0,
    top: 0
  });
  let [pinnedHandleAnchor, setPinnedHandleAnchor] = useState<{
    left: number;
    top: number;
  } | null>(null);
  let pinnedNodeRef = useRef<HTMLElement | null>(null);
  let menuTriggerRef = useRef<HTMLButtonElement | null>(null);
  let lockedRef = useRef(false);
  let pressRef = useRef<{ x: number; y: number; t: number } | null>(null);
  let draggingRef = useRef(false);

  let lock = useCallback(() => {
    if (lockedRef.current) return;
    lockedRef.current = true;
    editor.commands.lockDragHandle();
  }, [editor]);

  let unlock = useCallback(() => {
    if (!lockedRef.current) return;
    lockedRef.current = false;
    editor.commands.unlockDragHandle();
  }, [editor]);

  useEffect(() => {
    return () => {
      if (lockedRef.current && !editor.isDestroyed) {
        editor.commands.unlockDragHandle();
      }
    };
  }, [editor]);

  let positionConfig = useMemo(
    () => ({
      placement: 'left-start' as const,
      strategy: 'absolute' as const,
      middleware: [
        offset(({ rects }) => {
          let dom = currentRef.current?.dom ?? null;
          let nodeType = currentRef.current?.node.type.name;
          let crossAxis = dom
            ? getHandleCrossAxis({
                dom,
                nodeType,
                handleHeight: rects.floating.height,
                referenceHeight: rects.reference.height
              })
            : 0;
          return { mainAxis: 6, crossAxis };
        })
      ]
    }),
    []
  );

  let menuOpenRef = useRef(menuOpen);
  menuOpenRef.current = menuOpen;

  let closeMenu = useCallback(() => {
    menuOpenRef.current = false;
    setMenuOpen(false);
    setPinnedHandleAnchor(null);
    pinnedNodeRef.current = null;
    menuTriggerRef.current = null;
    unlock();
  }, [unlock]);

  let openMenuFromButton = (btn: HTMLButtonElement) => {
    menuOpenRef.current = true;
    menuTriggerRef.current = btn;
    let rect = btn.getBoundingClientRect();
    if (
      Number.isFinite(rect.right) &&
      Number.isFinite(rect.top) &&
      !(rect.width === 0 && rect.height === 0)
    ) {
      setMenuAnchor({ left: rect.right + 6, top: rect.top });
    }
    let pinnedNode = currentRef.current?.dom ?? null;
    pinnedNodeRef.current = pinnedNode;
    if (pinnedNode && pinnedNode.isConnected) {
      let pinnedRect = pinnedNode.getBoundingClientRect();
      if (
        Number.isFinite(pinnedRect.left) &&
        Number.isFinite(pinnedRect.top) &&
        !(pinnedRect.width === 0 && pinnedRect.height === 0)
      ) {
        let nodeType = currentRef.current?.node.type.name;
        let top =
          pinnedRect.top +
          getHandleCrossAxis({
            dom: pinnedNode,
            nodeType,
            handleHeight: 22,
            referenceHeight: pinnedRect.height
          });
        let left = pinnedRect.left - 6 - 22;
        setPinnedHandleAnchor({ left, top });
      }
    }
    setMenuOpen(true);
    lock();
  };

  useEffect(() => {
    if (!menuOpen) return;
    let raf = 0;
    let updatePinned = () => {
      let node = pinnedNodeRef.current;
      if (!node || !node.isConnected) return;
      let rect = node.getBoundingClientRect();
      if (!Number.isFinite(rect.left) || !Number.isFinite(rect.top)) return;
      if (rect.width === 0 && rect.height === 0) return;
      let nodeType = currentRef.current?.node.type.name;
      let next = {
        left: rect.left - 6 - 22,
        top:
          rect.top +
          getHandleCrossAxis({
            dom: node,
            nodeType,
            handleHeight: 22,
            referenceHeight: rect.height
          })
      };
      setPinnedHandleAnchor(prev =>
        prev && prev.left === next.left && prev.top === next.top ? prev : next
      );
      let nextMenu = {
        left: rect.left,
        top: next.top
      };
      setMenuAnchor(prev =>
        prev.left === nextMenu.left && prev.top === nextMenu.top ? prev : nextMenu
      );
    };
    let tick = () => {
      updatePinned();
      raf = window.requestAnimationFrame(tick);
    };
    tick();
    return () => {
      window.cancelAnimationFrame(raf);
    };
  }, [menuOpen]);

  useEffect(() => {
    onMenuOpenChange?.(menuOpen);
  }, [menuOpen, onMenuOpenChange]);

  let handleMouseDown = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (e.button !== 0) return;
    pressRef.current = { x: e.clientX, y: e.clientY, t: Date.now() };
    draggingRef.current = false;
  };

  let handleMouseUp = (e: React.MouseEvent<HTMLButtonElement>) => {
    let press = pressRef.current;
    pressRef.current = null;
    if (!press) return;
    if (draggingRef.current) {
      draggingRef.current = false;
      return;
    }
    let dx = Math.abs(e.clientX - press.x);
    let dy = Math.abs(e.clientY - press.y);
    let dt = Date.now() - press.t;
    if (dx > 5 || dy > 5 || dt > 500) return;
    e.preventDefault();
    e.stopPropagation();
    if (menuOpen) {
      closeMenu();
      return;
    }
    openMenuFromButton(e.currentTarget);
  };

  let handleSelect = (item: SlashItem) => {
    let target = currentRef.current;
    if (!target) {
      closeMenu();
      return;
    }

    let topLevel = getTopLevelNodeAtPos(editor.state.doc, target.pos);
    if (!topLevel) {
      closeMenu();
      return;
    }

    let { state, view } = editor;
    let $pos = state.doc.resolve(Math.min(topLevel.pos + 1, state.doc.content.size));
    let selection = TextSelection.near($pos, 1);

    // Move the cursor inside the target block, then `clearNodes` lifts any
    // wrapper (blockquote, callout, lists, …) and resets inner textblocks to
    // the default paragraph type. After that the conversion command applied
    // below replaces the entire block rather than just its inner content.
    editor.chain().setTextSelection(selection.from).clearNodes().run();

    view.focus();
    let cursor = editor.state.selection.from;
    item.command({ editor, range: { from: cursor, to: cursor } });
    closeMenu();
  };

  let moveBlock = useCallback(
    (direction: -1 | 1) => {
      let target = currentRef.current;
      if (!target) {
        closeMenu();
        return;
      }
      let topLevel = getTopLevelNodeAtPos(editor.state.doc, target.pos);
      if (!topLevel) {
        closeMenu();
        return;
      }
      let nextIndex = topLevel.index + direction;
      if (nextIndex < 0 || nextIndex >= editor.state.doc.childCount) {
        closeMenu();
        return;
      }

      let tr = editor.state.tr;
      tr.delete(topLevel.pos, topLevel.pos + topLevel.node.nodeSize);

      let insertPos = 0;
      for (let i = 0; i < nextIndex; i += 1) {
        insertPos += tr.doc.child(i).nodeSize;
      }
      tr.insert(insertPos, topLevel.node);

      let cursorPos = Math.min(insertPos + 1, tr.doc.content.size);
      tr.setSelection(TextSelection.near(tr.doc.resolve(cursorPos), 1));
      editor.view.dispatch(tr.scrollIntoView());
      closeMenu();
    },
    [editor, closeMenu]
  );

  let insertBlock = useCallback(
    (placement: 'above' | 'below') => {
      let target = currentRef.current;
      if (!target) {
        closeMenu();
        return;
      }
      let topLevel = getTopLevelNodeAtPos(editor.state.doc, target.pos);
      if (!topLevel) {
        closeMenu();
        return;
      }
      let insertPos =
        placement === 'above' ? topLevel.pos : topLevel.pos + topLevel.node.nodeSize;
      editor
        .chain()
        .focus()
        .insertContentAt(insertPos, { type: 'paragraph' })
        .setTextSelection(insertPos + 1)
        .run();
      closeMenu();
    },
    [editor, closeMenu]
  );

  let deleteBlock = useCallback(() => {
    let target = currentRef.current;
    if (!target) {
      closeMenu();
      return;
    }
    let topLevel = getTopLevelNodeAtPos(editor.state.doc, target.pos);
    if (!topLevel) {
      closeMenu();
      return;
    }

    if (editor.state.doc.childCount <= 1) {
      editor.chain().focus().clearContent().run();
      closeMenu();
      return;
    }

    let tr = editor.state.tr.delete(topLevel.pos, topLevel.pos + topLevel.node.nodeSize);
    let cursorPos = Math.min(topLevel.pos + 1, tr.doc.content.size);
    tr.setSelection(TextSelection.near(tr.doc.resolve(cursorPos), 1));
    editor.view.dispatch(tr.scrollIntoView());
    closeMenu();
  }, [editor, closeMenu]);

  let updateCodeLanguage = useCallback(
    (language: string) => {
      let target = currentRef.current;
      if (!target) return;
      let topLevel = getTopLevelNodeAtPos(editor.state.doc, target.pos);
      if (!topLevel || topLevel.node.type.name !== 'codeBlock') return;

      let tr = editor.state.tr.setNodeMarkup(topLevel.pos, undefined, {
        ...topLevel.node.attrs,
        language
      });
      editor.view.dispatch(tr);
      setCodeLanguage(language);
    },
    [editor]
  );

  let copyHeadingLink = useCallback(async () => {
    if (!headingLink) return;
    try {
      await navigator.clipboard.writeText(headingLink);
    } catch {
      let input = document.createElement('input');
      input.value = headingLink;
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      input.remove();
    }
    closeMenu();
  }, [headingLink, closeMenu]);

  // Stable callbacks for the DragHandle plugin. The plugin's underlying
  // useEffect re-registers (and resets) the entire ProseMirror plugin chain
  // whenever any of these references change, which would clobber other
  // plugin views (e.g. the slash command menu) on every render.
  let onElementDragStart = useCallback(() => {
    draggingRef.current = true;
    pressRef.current = null;
    if (menuOpenRef.current) setMenuOpen(false);
  }, []);

  let onElementDragEnd = useCallback(() => {
    draggingRef.current = false;
    // The drop indicator from `prosemirror-dropcursor` only clears on
    // `drop`/`dragend`/`dragleave` events fired on the editor's DOM.
    // Because our drag originates from a portal outside the editor,
    // `dragend` never bubbles there, and depending on where the user
    // releases the mouse `drop` may not fire on it either. Without a
    // nudge the cursor lingers up to its 5s `dragover` fallback. Sending
    // a synthetic `dragend` on the editor DOM kicks off the plugin's
    // 20ms cleanup path immediately.
    if (!editor.isDestroyed) {
      editor.view.dom.dispatchEvent(
        new DragEvent('dragend', { bubbles: false, cancelable: true })
      );
    }
  }, [editor]);

  let onNodeChange = useCallback(
    ({ node, pos }: { node: ProseMirrorNode | null; pos: number }) => {
      if (menuOpenRef.current) return;
      if (node && pos >= 0) {
        let domNode = editor.view.nodeDOM(pos);
        let dom =
          domNode instanceof HTMLElement
            ? domNode
            : domNode instanceof Node
              ? (domNode.parentElement ?? null)
              : null;
        currentRef.current = { node, pos, dom };
        // The plugin synchronously calls `repositionDragHandle` and
        // `showHandle` immediately after this callback. Without
        // `flushSync` React would commit the state change after the
        // wrapper has already been moved/shown, so the previous block's
        // button briefly appears next to a table/code block. Flushing
        // makes the visibility decision happen before the next paint.
        flushSync(() => setCurrentNodeType(node.type.name));
        setActiveTitle(getCurrentBlockLabel(node));
        setIsImageBlock(/image/i.test(node.type.name));
        if (
          node.type.name === 'heading' &&
          typeof node.attrs.id === 'string' &&
          node.attrs.id
        ) {
          let url = `${window.location.origin}${window.location.pathname}${window.location.search}#${node.attrs.id}`;
          setHeadingLink(url);
        } else {
          setHeadingLink(undefined);
        }
        if (node.type.name === 'codeBlock') {
          setCodeLanguage((node.attrs.language as string | null) ?? 'plaintext');
        }
      } else {
        currentRef.current = null;
        flushSync(() => setCurrentNodeType(null));
        setActiveTitle(undefined);
        setCodeLanguage('plaintext');
        setIsImageBlock(false);
        setHeadingLink(undefined);
      }
    },
    [editor]
  );

  let isHidden = !currentNodeType || HIDDEN_NODE_TYPES.has(currentNodeType);

  return (
    <>
      <DragHandle
        editor={editor}
        computePositionConfig={positionConfig}
        onElementDragStart={onElementDragStart}
        onElementDragEnd={onElementDragEnd}
        onNodeChange={onNodeChange}
      >
        {!isHidden && !menuOpen && (
          <HandleBtn
            type="button"
            data-block-handle="true"
            title="Drag to move · Click to change type"
            onMouseDown={handleMouseDown}
            onMouseUp={handleMouseUp}
            onMouseEnter={lock}
            onMouseLeave={() => {
              if (!menuOpenRef.current) unlock();
            }}
          >
            <IconGrip />
          </HandleBtn>
        )}
      </DragHandle>
      {menuOpen && pinnedHandleAnchor && (
        <PinnedHandle
          style={{
            left: pinnedHandleAnchor.left,
            top: pinnedHandleAnchor.top
          }}
          aria-hidden
        >
          <IconGrip />
        </PinnedHandle>
      )}
      <BlockMenu
        open={menuOpen}
        anchor={menuAnchor}
        isCodeBlock={currentNodeType === 'codeBlock'}
        isImageBlock={isImageBlock}
        headingLink={headingLink}
        codeLanguage={codeLanguage}
        activeTitle={activeTitle}
        onSelect={handleSelect}
        onCopyHeadingLink={copyHeadingLink}
        onCodeLanguageChange={updateCodeLanguage}
        onMoveUp={() => moveBlock(-1)}
        onMoveDown={() => moveBlock(1)}
        onInsertAbove={() => insertBlock('above')}
        onInsertBelow={() => insertBlock('below')}
        onDelete={deleteBlock}
        onClose={closeMenu}
      />
    </>
  );
}
