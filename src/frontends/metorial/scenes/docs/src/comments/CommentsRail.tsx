import type { DocumentCommentThread } from '@metorial/state';
import type { Editor as TiptapEditor } from '@tiptap/react';
import { useEffect, useLayoutEffect, useRef, useState, type ComponentType } from 'react';
import styled from 'styled-components';
import { layoutRailItems, type RailItem } from '../editor/commentsLayout';
import {
  getCommentThreadAnchors,
  getPendingCommentRange
} from '../editor/extensions/CommentHighlights';
import { CommentComposer } from './CommentComposer';
import { CommentThreadCard, type CommentsAccess } from './CommentThreadCard';

export let COMMENTS_RAIL_WIDTH = 300;

let PENDING_ID = '__pending__';
let FALLBACK_CARD_HEIGHT = 96;
let SETTLE_MS = 320;

let RailRoot = styled.div`
  position: absolute;
  top: 0;
  right: 16px;
  width: ${COMMENTS_RAIL_WIDTH - 32}px;
  height: 100%;
  pointer-events: none;

  & > * {
    pointer-events: auto;
  }
`;

let Positioned = styled.div<{ $placed: boolean; $animateTop: boolean }>`
  position: absolute;
  left: 0;
  right: 0;
  opacity: ${({ $placed }) => ($placed ? 1 : 0)};
  pointer-events: ${({ $placed }) => ($placed ? 'auto' : 'none')};
  transition: ${({ $animateTop, theme }) =>
    `opacity ${theme.motion.base}${$animateTop ? ', top 160ms ease' : ''}`};
`;

let PendingCard = styled.div`
  padding: 12px;
  border: 1px solid ${({ theme }) => theme.color.borderStrong};
  border-radius: ${({ theme }) => theme.size.radiusLg};
  background: ${({ theme }) => theme.color.bgElevated};
  box-shadow: ${({ theme }) => theme.shadow.sm};
`;

let areTopsEqual = (a: Map<string, number>, b: Map<string, number>) =>
  a.size === b.size && [...a].every(([id, top]) => Math.abs((b.get(id) ?? NaN) - top) < 0.5);

let getTopAt = (editor: TiptapEditor, pos: number, base: number) => {
  try {
    return editor.view.coordsAtPos(pos).top - base;
  } catch {
    return null;
  }
};

export let CommentsRail = ({
  editor,
  access,
  threads,
  activeThreadId,
  onActivate,
  onClose,
  pending,
  creating,
  createSucceeded,
  CreateError,
  onSubmitPending,
  onCancelPending
}: {
  editor: TiptapEditor;
  access: CommentsAccess;
  threads: DocumentCommentThread[];
  activeThreadId: string | null;
  onActivate: (threadId: string) => void;
  onClose: (threadId: string) => void;
  pending: boolean;
  creating?: boolean;
  createSucceeded?: boolean;
  CreateError?: ComponentType;
  onSubmitPending: (body: string) => Promise<boolean>;
  onCancelPending: () => void;
}) => {
  let rootRef = useRef<HTMLDivElement | null>(null);
  let cardRefs = useRef(new Map<string, HTMLDivElement>());
  let [tops, setTops] = useState(() => new Map<string, number>());
  let [, setLayoutTick] = useState(0);
  let [settling, setSettling] = useState(true);
  let placedIds = useRef(new Set<string>());

  useEffect(() => {
    let start = performance.now();
    let frame = 0;
    let step = () => {
      setLayoutTick(tick => tick + 1);
      if (performance.now() - start < SETTLE_MS) frame = requestAnimationFrame(step);
      else setSettling(false);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    let bump = () => setLayoutTick(tick => tick + 1);
    let observer = new ResizeObserver(bump);
    if (rootRef.current) observer.observe(rootRef.current);
    for (let card of cardRefs.current.values()) observer.observe(card);

    editor.on('transaction', bump);
    window.addEventListener('resize', bump);
    return () => {
      observer.disconnect();
      editor.off('transaction', bump);
      window.removeEventListener('resize', bump);
    };
  }, [editor, threads, pending]);

  useLayoutEffect(() => {
    let root = rootRef.current;
    if (!root) return;

    let base = root.getBoundingClientRect().top;
    let anchors = getCommentThreadAnchors(editor.state);
    let items: RailItem[] = [];

    for (let thread of threads) {
      let anchor = anchors.get(thread.id);
      let top = anchor ? getTopAt(editor, anchor.from, base) : null;
      if (top === null) continue;

      items.push({
        id: thread.id,
        desiredTop: top,
        height: cardRefs.current.get(thread.id)?.offsetHeight ?? FALLBACK_CARD_HEIGHT
      });
    }

    let pendingRange = pending ? getPendingCommentRange(editor.state) : null;
    let pendingTop = pendingRange ? getTopAt(editor, pendingRange.from, base) : null;
    if (pendingTop !== null) {
      items.push({
        id: PENDING_ID,
        desiredTop: pendingTop,
        height: cardRefs.current.get(PENDING_ID)?.offsetHeight ?? FALLBACK_CARD_HEIGHT
      });
    }

    let next = layoutRailItems(items, pendingTop !== null ? PENDING_ID : activeThreadId);
    setTops(current => (areTopsEqual(current, next) ? current : next));
  });

  let setCardRef = (id: string) => (element: HTMLDivElement | null) => {
    if (element) cardRefs.current.set(id, element);
    else cardRefs.current.delete(id);
  };

  let placement = (id: string) => {
    let top = tops.get(id);
    let placed = top !== undefined;
    let animateTop = placed && !settling && placedIds.current.has(id);
    if (placed) placedIds.current.add(id);

    return { style: { top: top ?? 0 }, $placed: placed, $animateTop: animateTop };
  };

  return (
    <RailRoot ref={rootRef}>
      {threads.map(thread => (
        <Positioned key={thread.id} {...placement(thread.id)}>
          <CommentThreadCard
            ref={setCardRef(thread.id)}
            access={access}
            thread={thread}
            active={thread.id === activeThreadId}
            floating
            onActivate={onActivate}
            onClose={onClose}
          />
        </Positioned>
      ))}

      {pending && (
        <Positioned {...placement(PENDING_ID)}>
          <PendingCard ref={setCardRef(PENDING_ID)}>
            <CommentComposer
              label="Add a comment"
              submitLabel="Comment"
              autoFocus
              bare
              loading={creating}
              success={createSucceeded}
              RenderError={CreateError}
              onSubmit={onSubmitPending}
              onCancel={onCancelPending}
            />
          </PendingCard>
        </Positioned>
      )}
    </RailRoot>
  );
};
