import { type RefObject, useLayoutEffect, useRef, useState } from 'react';
import type { WorkspacePanelPosition } from './preferences';

export type WorkspaceSize = 'xs' | 'sm' | 'md' | 'lg';

export let PANEL_COLUMN_WIDTH = 304;
export let SIDEBAR_WIDTH = 280;
export let SIDEBAR_INSET = 12;
export let DOCK_WIDTH = 60;

let MIN_DOCUMENT_WIDTH = 520;
let DOCUMENT_PADDING = 64;
let SIDEBAR_USED = SIDEBAR_WIDTH + SIDEBAR_INSET;

let getSize = (width: number): WorkspaceSize =>
  width < 680 ? 'xs' : width < 900 ? 'sm' : width < 1200 ? 'md' : 'lg';

let getEffectivePosition = (
  position: WorkspacePanelPosition,
  width: number
): WorkspacePanelPosition => {
  if (!width || position == 'dock') return position;
  if (position == 'sidebar') {
    return width - SIDEBAR_USED - 32 < MIN_DOCUMENT_WIDTH ? 'dock' : 'sidebar';
  }

  let sides = position == 'split' ? 2 : 1;
  return width - sides * 300 - 64 < MIN_DOCUMENT_WIDTH ? 'dock' : position;
};

let parseContentWidth = (value: string | null | undefined) => {
  if (!value || value.endsWith('%')) return 0;
  let px = parseInt(value, 10);
  return Number.isFinite(px) ? px : 0;
};

export type WorkspaceLayoutInput = {
  rootRef: RefObject<HTMLElement | null>;
  navLeftRef: RefObject<HTMLElement | null>;
  navRightRef: RefObject<HTMLElement | null>;
  toolbarRef: RefObject<HTMLElement | null>;
  position: WorkspacePanelPosition;
  visibleSectionIds: string[];
  toolbarVisible: boolean;
  contentWidth: string | null;
  filePane: boolean;
  assistantSpace: number;
};

export let useWorkspaceLayout = (input: WorkspaceLayoutInput) => {
  let [width, setWidth] = useState(0);
  let [tight, setTight] = useState(false);
  let untightRightWidth = useRef<number | null>(null);
  let measureRef = useRef<() => void>(() => {});

  let size = getSize(width || 1280);
  let effectivePosition = getEffectivePosition(input.position, width);
  let centerShift = effectivePosition == 'sidebar' ? SIDEBAR_USED / 2 : 0;

  measureRef.current = () => {
    let root = input.rootRef.current;
    if (!root) return;

    let w = root.clientWidth;
    let navLeft = input.navLeftRef.current;
    let navRight = input.navRightRef.current;
    let toolbarWidth = input.toolbarVisible ? (input.toolbarRef.current?.scrollWidth ?? 0) : 0;
    let cx = w / 2 + centerShift;

    let leftEdge = navLeft ? navLeft.offsetLeft + navLeft.offsetWidth + 12 : 0;
    let rightOffset = navRight ? w - (navRight.offsetLeft + navRight.offsetWidth) : 14;
    let rightWidth = navRight?.offsetWidth ?? 0;
    if (!tight) untightRightWidth.current = rightWidth;

    let fitsWith = (navRightWidth: number) =>
      cx - toolbarWidth / 2 >= leftEdge &&
      cx + toolbarWidth / 2 <= w - rightOffset - navRightWidth - 12;

    let nextTight = input.toolbarVisible && !fitsWith(untightRightWidth.current ?? rightWidth);
    if (nextTight != tight) setTight(nextTight);

    let secondRow = input.toolbarVisible && nextTight && tight && !fitsWith(rightWidth);

    let ids = input.visibleSectionIds;
    let hasLeftPanels =
      (effectivePosition == 'left' && ids.length > 0) ||
      (effectivePosition == 'split' && ids.includes('files'));
    let hasRightPanels =
      (effectivePosition == 'right' && ids.length > 0) ||
      (effectivePosition == 'split' && ids.some(id => id != 'files'));

    let leftUsed =
      effectivePosition == 'sidebar'
        ? SIDEBAR_USED
        : hasLeftPanels
          ? PANEL_COLUMN_WIDTH
          : effectivePosition == 'dock' && ids.length
            ? DOCK_WIDTH
            : 0;
    let rightUsed = hasRightPanels ? PANEL_COLUMN_WIDTH : 0;

    let docWidth = input.filePane ? 0 : parseContentWidth(input.contentWidth);
    let gutter = w < 900 ? 20 : 48;
    let maxUsed = Math.max(leftUsed, rightUsed);
    let pl: number;
    let pr: number;

    if (docWidth && w - 2 * maxUsed - 32 >= docWidth) {
      pl = pr = Math.max(gutter, maxUsed + 16);
    } else {
      pl = Math.max(gutter, leftUsed + 16);
      pr = Math.max(gutter, rightUsed + 16);
    }

    if (input.filePane) {
      pl = leftUsed ? leftUsed + 4 : 14;
      pr = rightUsed ? rightUsed + 4 : 14;
    }

    let canvasTop = secondRow ? 140 : 104;
    let assistantH = input.assistantSpace ? input.assistantSpace + 12 : 14;
    let assistantWidth = Math.min(640, w - 32 - centerShift * 2);
    let assistantLeft = cx - assistantWidth / 2;
    let reserve = input.assistantSpace ? `${input.assistantSpace + 4}px` : '0px';

    let vars: Record<string, string> = {
      '--toolbar-top': secondRow ? '62px' : '14px',
      '--chrome-bottom': secondRow ? '116px' : '70px',
      '--canvas-top': `${canvasTop}px`,
      '--canvas-left': `${pl}px`,
      '--canvas-right': `${pr}px`,
      '--canvas-center-shift': `${centerShift}px`,
      '--assistant-h': `${assistantH}px`,
      '--pane-bottom': `${assistantH}px`,
      '--panels-left-bottom': assistantLeft < PANEL_COLUMN_WIDTH - 8 ? reserve : '0px',
      '--panels-right-bottom':
        w - (assistantLeft + assistantWidth) < PANEL_COLUMN_WIDTH - 8 ? reserve : '0px',
      '--docs-inset-top': `${canvasTop - 48}px`,
      '--docs-inset-left': `${Math.max(0, pl - DOCUMENT_PADDING)}px`,
      '--docs-inset-right': `${Math.max(0, pr - DOCUMENT_PADDING)}px`,
      '--docs-inset-bottom': `${Math.max(0, assistantH - 40)}px`
    };

    for (let [key, value] of Object.entries(vars)) {
      if (root.style.getPropertyValue(key) != value) root.style.setProperty(key, value);
    }
  };

  useLayoutEffect(() => {
    measureRef.current();
  });

  useLayoutEffect(() => {
    let root = input.rootRef.current;
    if (!root) return;

    setWidth(root.clientWidth);

    let observer = new ResizeObserver(() => {
      setWidth(root.clientWidth);
      measureRef.current();
    });
    observer.observe(root);
    if (input.navLeftRef.current) observer.observe(input.navLeftRef.current);
    if (input.navRightRef.current) observer.observe(input.navRightRef.current);

    return () => observer.disconnect();
  }, []);

  return {
    width,
    size,
    tight,
    effectivePosition,
    measure: () => measureRef.current()
  };
};
