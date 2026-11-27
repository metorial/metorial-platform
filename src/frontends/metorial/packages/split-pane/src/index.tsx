import { theme } from '@metorial/ui';
import { RiArrowLeftSLine, RiArrowRightSLine } from '@remixicon/react';
import { useEffect, useMemo, useRef, useState } from 'react';
import styled from 'styled-components';

let Wrapper = styled.div`
  position: relative;
  display: flex;
  flex: 1;
  width: 100%;
  min-height: 0;
  height: 100%;
  overflow: hidden;
  background: ${theme.colors.background};
`;

let Pane = styled.div`
  min-width: 0;
  min-height: 0;
  height: 100%;
  background: ${theme.colors.background};
`;

let Divider = styled.div`
  width: 1px;
  cursor: col-resize;
  flex-shrink: 0;
  position: relative;
  background: ${theme.colors.gray300};
  transition: background 0.18s ease;

  &::before {
    content: '';
    position: absolute;
    top: 50%;
    left: 50%;
    width: 3px;
    height: 36px;
    transform: translate(-50%, -50%);
    border-radius: 999px;
    background: ${theme.colors.gray400};
    transition:
      width 0.18s ease,
      background 0.18s ease;
  }

  &:hover {
    background: ${theme.colors.gray400};
  }

  &:hover::before {
    width: 6px;
    background: ${theme.colors.blue700};
  }
`;

let DragOverlay = styled.div`
  position: absolute;
  inset: 0;
  z-index: 1000;
  cursor: col-resize;
  background: transparent;
`;

let CollapsedGutter = styled.button`
  width: 40px;
  min-width: 40px;
  height: 100%;
  flex-shrink: 0;
  border: 0;
  padding: 0;
  margin: 0;
  background: ${theme.colors.background};
  color: ${theme.colors.gray700};
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition:
    background 0.18s ease,
    color 0.18s ease;

  &[data-side='left'] {
    border-right: 1px solid ${theme.colors.gray300};
  }

  &[data-side='right'] {
    border-left: 1px solid ${theme.colors.gray300};
  }

  svg {
    width: 22px;
    height: 22px;
  }

  &:hover {
    background: ${theme.colors.gray100};
    color: ${theme.colors.foreground};
  }
`;

type CollapsedSide = 'left' | 'right' | null;

type PersistedState = {
  leftSize: number;
  collapsedSide: CollapsedSide;
};

let readPersistedState = (storageKey: string | undefined): PersistedState | null => {
  if (!storageKey) return null;
  if (typeof window === 'undefined') return null;

  try {
    let raw = window.localStorage.getItem(storageKey);
    if (!raw) return null;
    let parsed = JSON.parse(raw) as Partial<PersistedState>;
    let leftSize = typeof parsed.leftSize === 'number' ? parsed.leftSize : null;
    let collapsedSide =
      parsed.collapsedSide === 'left' ||
      parsed.collapsedSide === 'right' ||
      parsed.collapsedSide === null
        ? parsed.collapsedSide
        : null;
    if (leftSize === null) return null;
    return { leftSize, collapsedSide };
  } catch {
    return null;
  }
};

let writePersistedState = (storageKey: string | undefined, state: PersistedState) => {
  if (!storageKey) return;
  if (typeof window === 'undefined') return;

  try {
    window.localStorage.setItem(storageKey, JSON.stringify(state));
  } catch {}
};

export let DraggableSplitPane = ({
  left,
  right,
  initialLeftSize = 360,
  minLeftSize = 260,
  minRightSize = 360,
  collapseThreshold = 200,
  storageKey
}: {
  left: React.ReactNode;
  right: React.ReactNode;
  initialLeftSize?: number;
  minLeftSize?: number;
  minRightSize?: number;
  collapseThreshold?: number;
  storageKey?: string;
}) => {
  let collapsedGutterWidth = 40;
  let wrapperRef = useRef<HTMLDivElement>(null);
  let [leftSize, setLeftSize] = useState(() => {
    let persisted = readPersistedState(storageKey);
    return persisted?.leftSize ?? initialLeftSize;
  });
  let [collapsedSide, setCollapsedSide] = useState<CollapsedSide>(() => {
    let persisted = readPersistedState(storageKey);
    return persisted?.collapsedSide ?? null;
  });
  let [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    writePersistedState(storageKey, { leftSize, collapsedSide });
  }, [storageKey, leftSize, collapsedSide]);

  let openLeft = () => {
    setCollapsedSide(null);
    setLeftSize(initialLeftSize);
  };

  let openRight = () => {
    let containerWidth = wrapperRef.current?.clientWidth ?? initialLeftSize + minRightSize;
    setCollapsedSide(null);
    setLeftSize(Math.max(containerWidth - initialLeftSize, minLeftSize));
  };

  let startResize = (event: React.PointerEvent<HTMLDivElement>) => {
    let wrapper = wrapperRef.current;
    if (!wrapper) return;

    event.preventDefault();
    setIsDragging(true);

    let startX = event.clientX;
    let { left: wrapperLeft, width } = wrapper.getBoundingClientRect();
    let startSize = leftSize;

    let handleMove = (moveEvent: PointerEvent) => {
      let pointerOffset = moveEvent.clientX - startX;
      let rawLeft = startSize + pointerOffset;
      let absoluteLeft = moveEvent.clientX - wrapperLeft;

      if (absoluteLeft <= collapseThreshold || rawLeft <= collapseThreshold) {
        setCollapsedSide('left');
        return;
      }

      if (width - absoluteLeft <= collapseThreshold || width - rawLeft <= collapseThreshold) {
        setCollapsedSide('right');
        return;
      }

      setCollapsedSide(null);
      setLeftSize(Math.min(Math.max(rawLeft, minLeftSize), width - minRightSize));
    };

    let handleUp = () => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
      setIsDragging(false);
    };

    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp);
  };

  let layout = useMemo(() => {
    if (collapsedSide === 'left') {
      return {
        showLeft: false,
        showRight: true,
        leftWidth: 0 as const,
        rightWidth: `calc(100% - ${collapsedGutterWidth}px)`
      };
    }

    if (collapsedSide === 'right') {
      return {
        showLeft: true,
        showRight: false,
        leftWidth: `calc(100% - ${collapsedGutterWidth}px)`,
        rightWidth: 0 as const
      };
    }

    return {
      showLeft: true,
      showRight: true,
      leftWidth: leftSize,
      rightWidth: `calc(100% - ${leftSize}px - 1px)`
    };
  }, [collapsedSide, leftSize]);

  return (
    <Wrapper ref={wrapperRef}>
      {collapsedSide === 'left' && (
        <CollapsedGutter
          data-side="left"
          type="button"
          onClick={openLeft}
          aria-label="Show left panel"
        >
          <RiArrowRightSLine />
        </CollapsedGutter>
      )}

      {layout.showLeft && <Pane style={{ width: layout.leftWidth }}>{left}</Pane>}
      {layout.showLeft && layout.showRight && <Divider onPointerDown={startResize} />}
      {layout.showRight && <Pane style={{ width: layout.rightWidth }}>{right}</Pane>}

      {collapsedSide === 'right' && (
        <CollapsedGutter
          data-side="right"
          type="button"
          onClick={openRight}
          aria-label="Show right panel"
        >
          <RiArrowLeftSLine />
        </CollapsedGutter>
      )}

      {isDragging && <DragOverlay />}
    </Wrapper>
  );
};
