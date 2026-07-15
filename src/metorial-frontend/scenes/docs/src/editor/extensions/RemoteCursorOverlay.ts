import { Extension } from '@tiptap/core';
import { Plugin, PluginKey, type EditorState } from '@tiptap/pm/state';
import { Decoration, DecorationSet, type EditorView } from '@tiptap/pm/view';
import {
  absolutePositionToRelativePosition,
  relativePositionToAbsolutePosition,
  ySyncPluginKey
} from '@tiptap/y-tiptap';
import type { Awareness } from 'y-protocols/awareness';
import * as Y from 'yjs';

type RemoteCursorUser = {
  name?: string;
  color?: string;
};

type RemoteCursorState = {
  user?: RemoteCursorUser;
  cursor?: {
    anchor: unknown;
    head: unknown;
  } | null;
};

type RemoteCursorOverlayOptions = {
  awareness: Awareness;
  user: RemoteCursorUser;
};

type YSyncState = {
  doc: Y.Doc;
  type: Y.XmlFragment;
  binding: {
    mapping: Parameters<typeof relativePositionToAbsolutePosition>[3];
  };
  snapshot?: unknown;
  prevSnapshot?: unknown;
  isChangeOrigin?: boolean;
};

type VisibleCursor = {
  user: RemoteCursorUser;
  clientId: number;
  from: number;
  to: number;
  cursor: number;
};

let remoteCursorOverlayKey = new PluginKey<DecorationSet>('docsRemoteCursorOverlay');

let fallbackColor = '#2563eb';
let fallbackName = 'Collaborator';

let clampPosition = (pos: number, max: number) => Math.min(Math.max(pos, 0), max);

let getYSyncState = (state: EditorState) =>
  ySyncPluginKey.getState(state) as YSyncState | undefined;

let toRelativePosition = (value: unknown) => {
  try {
    return Y.createRelativePositionFromJSON(value as Y.RelativePosition);
  } catch {
    return null;
  }
};

let getVisibleCursors = (state: EditorState, awareness: Awareness) => {
  let ystate = getYSyncState(state);
  if (!ystate || ystate.snapshot != null || ystate.prevSnapshot != null) return [];
  if (ystate.binding.mapping.size === 0) return [];

  let cursors: VisibleCursor[] = [];
  let max = Math.max(state.doc.content.size - 1, 0);

  for (let [clientId, awarenessState] of awareness.getStates()) {
    if (clientId === awareness.clientID) continue;

    let cursorState = awarenessState as RemoteCursorState;
    let cursor = cursorState.cursor;
    if (!cursor) continue;

    let relativeAnchor = toRelativePosition(cursor.anchor);
    let relativeHead = toRelativePosition(cursor.head);
    if (!relativeAnchor || !relativeHead) continue;

    let anchor = relativePositionToAbsolutePosition(
      ystate.doc,
      ystate.type,
      relativeAnchor,
      ystate.binding.mapping
    );
    let head = relativePositionToAbsolutePosition(
      ystate.doc,
      ystate.type,
      relativeHead,
      ystate.binding.mapping
    );
    if (anchor == null || head == null) continue;

    cursors.push({
      user: cursorState.user ?? {},
      clientId,
      from: clampPosition(Math.min(anchor, head), max),
      to: clampPosition(Math.max(anchor, head), max),
      cursor: clampPosition(head, max)
    });
  }

  return cursors;
};

let buildSelectionDecorations = (state: EditorState, awareness: Awareness) => {
  let decorations: Decoration[] = [];

  for (let cursor of getVisibleCursors(state, awareness)) {
    if (cursor.from === cursor.to) continue;

    decorations.push(
      Decoration.inline(cursor.from, cursor.to, {
        class: 'docs-remote-selection',
        style: `background-color: ${cursor.user.color ?? fallbackColor}33;`
      })
    );
  }

  return DecorationSet.create(state.doc, decorations);
};

let createCursorElement = (cursor: VisibleCursor) => {
  let cursorEl = document.createElement('span');
  cursorEl.className = 'docs-remote-cursor docs-remote-cursor--overlay';
  cursorEl.dataset.clientId = String(cursor.clientId);

  let caret = document.createElement('span');
  caret.className = 'docs-remote-cursor-caret';
  cursorEl.appendChild(caret);

  let label = document.createElement('span');
  label.className = 'docs-remote-cursor-label';
  cursorEl.appendChild(label);

  updateCursorElement(cursorEl, cursor);
  return cursorEl;
};

let updateCursorElement = (cursorEl: HTMLElement, cursor: VisibleCursor) => {
  let color = cursor.user.color ?? fallbackColor;
  let name = cursor.user.name ?? fallbackName;
  let label = cursorEl.querySelector<HTMLElement>('.docs-remote-cursor-label');

  cursorEl.style.color = color;
  cursorEl.title = name;
  if (label) {
    label.style.backgroundColor = color;
    label.textContent = name;
  }
};

let getActiveRemoteClientIds = (awareness: Awareness) => {
  let active = new Set<number>();

  for (let [clientId, awarenessState] of awareness.getStates()) {
    if (clientId === awareness.clientID) continue;
    if ((awarenessState as RemoteCursorState).cursor) active.add(clientId);
  }

  return active;
};

let publishLocalCursor = (view: EditorView, awareness: Awareness) => {
  let ystate = getYSyncState(view.state);
  if (!ystate || ystate.binding.mapping.size === 0) return;

  if (!view.hasFocus()) {
    if ((awareness.getLocalState() as RemoteCursorState | null)?.cursor != null) {
      awareness.setLocalStateField('cursor', null);
    }
    return;
  }

  let selection = view.state.selection;
  let anchor = absolutePositionToRelativePosition(
    selection.anchor,
    ystate.type,
    ystate.binding.mapping
  );
  let head = absolutePositionToRelativePosition(selection.head, ystate.type, ystate.binding.mapping);
  let current = (awareness.getLocalState() as RemoteCursorState | null)?.cursor;
  let currentAnchor = current ? toRelativePosition(current.anchor) : null;
  let currentHead = current ? toRelativePosition(current.head) : null;

  if (
    currentAnchor &&
    currentHead &&
    Y.compareRelativePositions(currentAnchor, anchor) &&
    Y.compareRelativePositions(currentHead, head)
  ) {
    return;
  }

  awareness.setLocalStateField('cursor', { anchor, head });
};

let updateOverlay = (
  view: EditorView,
  overlay: HTMLElement,
  awareness: Awareness,
  cursorElements: Map<number, HTMLElement>
) => {
  let host = overlay.parentElement;
  if (!host) return;

  let hostRect = host.getBoundingClientRect();
  let visibleClientIds = new Set<number>();

  for (let cursor of getVisibleCursors(view.state, awareness)) {
    let coords: { left: number; top: number; bottom: number };
    try {
      coords = view.coordsAtPos(cursor.cursor);
    } catch {
      continue;
    }

    visibleClientIds.add(cursor.clientId);

    let cursorEl = cursorElements.get(cursor.clientId);
    if (!cursorEl) {
      cursorEl = createCursorElement(cursor);
      cursorElements.set(cursor.clientId, cursorEl);
      overlay.appendChild(cursorEl);
    } else {
      updateCursorElement(cursorEl, cursor);
    }

    let left = coords.left - hostRect.left + host.scrollLeft;
    let top = coords.top - hostRect.top + host.scrollTop;
    let height = Math.max(1, coords.bottom - coords.top);
    cursorEl.style.transform = `translate(${left}px, ${top}px)`;
    cursorEl.style.setProperty('--docs-remote-cursor-height', `${height}px`);
    cursorEl.style.opacity = '1';
  }

  let activeClientIds = getActiveRemoteClientIds(awareness);
  for (let [clientId, cursorEl] of cursorElements) {
    if (visibleClientIds.has(clientId)) continue;
    if (activeClientIds.has(clientId)) continue;

    cursorEl.remove();
    cursorElements.delete(clientId);
  }
};

export let RemoteCursorOverlay = (options: RemoteCursorOverlayOptions) =>
  Extension.create({
    name: 'remoteCursorOverlay',

    addProseMirrorPlugins() {
      let { awareness, user } = options;

      return [
        new Plugin({
          key: remoteCursorOverlayKey,
          state: {
            init: (_config, state) => buildSelectionDecorations(state, awareness),
            apply: (tr, previous, _oldState, newState) => {
              let ystate = getYSyncState(newState);
              let shouldRebuild =
                tr.getMeta(remoteCursorOverlayKey) || (ystate && ystate.isChangeOrigin);

              if (shouldRebuild) {
                return buildSelectionDecorations(newState, awareness);
              }

              return previous.map(tr.mapping, tr.doc);
            }
          },
          props: {
            decorations: state => remoteCursorOverlayKey.getState(state)
          },
          view: view => {
            awareness.setLocalStateField('user', user);

            let host = view.dom.parentElement ?? view.dom;
            let previousPosition = host.style.position;
            if (getComputedStyle(host).position === 'static') {
              host.style.position = 'relative';
            }

            let overlay = document.createElement('div');
            overlay.className = 'docs-remote-cursor-overlay';
            host.appendChild(overlay);

            let raf = 0;
            let currentView = view;
            let cursorElements = new Map<number, HTMLElement>();
            let scheduleOverlayUpdate = () => {
              cancelAnimationFrame(raf);
              raf = requestAnimationFrame(() =>
                updateOverlay(currentView, overlay, awareness, cursorElements)
              );
            };
            let refresh = () => {
              currentView.dispatch(currentView.state.tr.setMeta(remoteCursorOverlayKey, true));
              scheduleOverlayUpdate();
            };
            let handleFocusChange = () => {
              overlay.classList.toggle('docs-remote-cursor-overlay--focused', currentView.hasFocus());
              publishLocalCursor(currentView, awareness);
              scheduleOverlayUpdate();
            };

            awareness.on('update', refresh);
            view.dom.addEventListener('focusin', handleFocusChange);
            view.dom.addEventListener('focusout', handleFocusChange);
            window.addEventListener('resize', scheduleOverlayUpdate);
            window.addEventListener('scroll', scheduleOverlayUpdate, true);

            handleFocusChange();
            scheduleOverlayUpdate();

            return {
              update: nextView => {
                currentView = nextView;
                publishLocalCursor(nextView, awareness);
                scheduleOverlayUpdate();
              },
              destroy: () => {
                cancelAnimationFrame(raf);
                awareness.off('update', refresh);
                awareness.setLocalStateField('cursor', null);
                view.dom.removeEventListener('focusin', handleFocusChange);
                view.dom.removeEventListener('focusout', handleFocusChange);
                window.removeEventListener('resize', scheduleOverlayUpdate);
                window.removeEventListener('scroll', scheduleOverlayUpdate, true);
                overlay.remove();
                cursorElements.clear();
                host.style.position = previousPosition;
              }
            };
          }
        })
      ];
    }
  });
