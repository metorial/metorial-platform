import type { DragEvent, MouseEvent } from 'react';

interface CornerProps {
  onSelect: () => void;
  onStartDrag: () => void;
}

interface ColGutterProps {
  widths: number[];
  onSelect: (col: number) => void;
  onMoveStart: (col: number) => void;
  onMoveOver: (col: number) => void;
  onMoveDrop: (col: number) => void;
  onMoveEnd: () => void;
  dragFrom: number | null;
  dragOver: number | null;
}

interface RowGutterProps {
  heights: number[];
  onSelect: (row: number) => void;
  onMoveStart: (row: number) => void;
  onMoveOver: (row: number) => void;
  onMoveDrop: (row: number) => void;
  onMoveEnd: () => void;
  dragFrom: number | null;
  dragOver: number | null;
}

let stop = (e: MouseEvent) => {
  e.preventDefault();
  e.stopPropagation();
};

export function CornerHandle({ onSelect, onStartDrag }: CornerProps) {
  return (
    <button
      type="button"
      className="pm-table-corner"
      draggable
      title="Select or drag entire table"
      aria-label="Select or drag entire table"
      onMouseDown={e => {
        e.stopPropagation();
      }}
      onClick={e => {
        stop(e);
        onSelect();
      }}
      onDragStartCapture={(e: DragEvent<HTMLButtonElement>) => {
        onStartDrag();
        if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move';
      }}
    >
      <span className="pm-table-corner__grip" aria-hidden />
    </button>
  );
}

export function ColGutter({
  widths,
  onSelect,
  onMoveStart,
  onMoveOver,
  onMoveDrop,
  onMoveEnd,
  dragFrom,
  dragOver
}: ColGutterProps) {
  let dragSpan =
    dragFrom != null && dragFrom >= 0 && dragFrom < widths.length ? widths[dragFrom] : 0;

  return (
    <>
      {widths.map((w, i) => {
        let shiftsLeft =
          dragFrom != null &&
          dragOver != null &&
          dragFrom < dragOver &&
          i > dragFrom &&
          i <= dragOver;
        let shiftsRight =
          dragFrom != null &&
          dragOver != null &&
          dragFrom > dragOver &&
          i >= dragOver &&
          i < dragFrom;
        let shift = shiftsLeft ? -dragSpan : shiftsRight ? dragSpan : 0;
        let isSource = dragFrom === i;
        let isTarget = dragOver === i && dragFrom !== i;

        return (
          <button
            key={i}
            type="button"
            className="pm-table-col-handle"
            style={{
              width: `${w}px`,
              transform: shift === 0 ? undefined : `translateX(${shift}px)`
            }}
            data-drag-source={isSource ? 'true' : undefined}
            data-drop-target={isTarget ? 'true' : undefined}
            draggable
            title="Select column"
            aria-label={`Select column ${i + 1}`}
            onMouseDown={e => {
              e.stopPropagation();
            }}
            onClick={e => {
              stop(e);
              onSelect(i);
            }}
            onDragStartCapture={(e: DragEvent<HTMLButtonElement>) => {
              onMoveStart(i);
              if (e.dataTransfer) {
                e.dataTransfer.effectAllowed = 'move';
                e.dataTransfer.setData('text/plain', `column:${i}`);
              }
            }}
            onDragOverCapture={(e: DragEvent<HTMLButtonElement>) => {
              e.preventDefault();
              e.stopPropagation();
              onMoveOver(i);
            }}
            onDropCapture={(e: DragEvent<HTMLButtonElement>) => {
              e.preventDefault();
              e.stopPropagation();
              onMoveDrop(i);
            }}
            onDragEndCapture={() => {
              onMoveEnd();
            }}
          >
            <span className="pm-table-col-handle__grip" aria-hidden />
          </button>
        );
      })}
    </>
  );
}

export function RowGutter({
  heights,
  onSelect,
  onMoveStart,
  onMoveOver,
  onMoveDrop,
  onMoveEnd,
  dragFrom,
  dragOver
}: RowGutterProps) {
  let dragSpan =
    dragFrom != null && dragFrom >= 0 && dragFrom < heights.length ? heights[dragFrom] : 0;

  return (
    <>
      {heights.map((h, i) => {
        let shiftsUp =
          dragFrom != null &&
          dragOver != null &&
          dragFrom < dragOver &&
          i > dragFrom &&
          i <= dragOver;
        let shiftsDown =
          dragFrom != null &&
          dragOver != null &&
          dragFrom > dragOver &&
          i >= dragOver &&
          i < dragFrom;
        let shift = shiftsUp ? -dragSpan : shiftsDown ? dragSpan : 0;
        let isSource = dragFrom === i;
        let isTarget = dragOver === i && dragFrom !== i;
        let canMove = i > 0;

        return (
          <button
            key={i}
            type="button"
            className="pm-table-row-handle"
            style={{
              height: `${h}px`,
              transform: shift === 0 ? undefined : `translateY(${shift}px)`
            }}
            data-drag-source={isSource ? 'true' : undefined}
            data-drop-target={isTarget ? 'true' : undefined}
            draggable={canMove}
            title={canMove ? 'Select row' : 'Header row'}
            aria-label={`Select row ${i + 1}`}
            onMouseDown={e => {
              e.stopPropagation();
            }}
            onClick={e => {
              stop(e);
              onSelect(i);
            }}
            onDragStartCapture={(e: DragEvent<HTMLButtonElement>) => {
              if (!canMove) {
                e.preventDefault();
                return;
              }
              onMoveStart(i);
              if (e.dataTransfer) {
                e.dataTransfer.effectAllowed = 'move';
                e.dataTransfer.setData('text/plain', `row:${i}`);
              }
            }}
            onDragOverCapture={(e: DragEvent<HTMLButtonElement>) => {
              e.preventDefault();
              e.stopPropagation();
              onMoveOver(i);
            }}
            onDropCapture={(e: DragEvent<HTMLButtonElement>) => {
              e.preventDefault();
              e.stopPropagation();
              onMoveDrop(i);
            }}
            onDragEndCapture={() => {
              onMoveEnd();
            }}
          >
            <span className="pm-table-row-handle__grip" aria-hidden />
          </button>
        );
      })}
    </>
  );
}
