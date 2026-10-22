import { theme } from '@metorial/ui';
import type ApexCharts from 'apexcharts';
import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import styled from 'styled-components';
import { resolveSeriesColors } from './colors';
import type { ValueFormatter } from './format';
import { ChartSeries, ChartXAxis, getSmallestTimeStep } from './series';
import { ChartTime, formatBucketRange, formatBucketTime, toTimestamp } from './time';

export type ChartTooltipVariant = 'card' | 'chip';

export type ChartSelectionRange = { from: Date; to: Date };

export type ChartSelection = {
  range: { from: ChartTime; to: ChartTime } | null;
  formatLabel?: (range: ChartSelectionRange) => string;
  onChange?: (range: ChartSelectionRange) => void;
  onClear?: () => void;
};

export type TimelineBarClick = {
  dataPointIndex: number;
  seriesIndex: number | null;
  from: Date;
  to: Date;
};

type ApexGlobals = {
  gridWidth: number;
  gridHeight: number;
  translateX: number;
  translateY: number;
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  minYArr?: number[];
  maxYArr?: number[];
};

type PlotGeometry = {
  left: number;
  top: number;
  width: number;
  height: number;
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  wrapper: DOMRect;
};

type TooltipRow = {
  id: string;
  name: string;
  color: string;
  value: number | null;
};

type HoverState = {
  index: number;
  segment: number | null;
  centerX: number;
  anchorY: number;
  plotTop: number;
  plotBottom: number;
  band: { left: number; width: number; top: number; height: number };
  dots: { x: number; y: number; color: string }[];
};

type SelectionDrag = {
  kind: 'start' | 'end' | 'move' | 'create';
  originX: number;
  originTime: number;
  range: { from: number; to: number };
  active: boolean;
};

let VIEWPORT_MARGIN = 8;
let DRAG_THRESHOLD_PX = 4;
let HANDLE_HIT_WIDTH = 7;
let ANCHOR_GAP = 12;
let MAX_ANCHOR_DEPTH = 0.4;

let getPlotGeometry = (
  chart: ApexCharts | null,
  wrapper: HTMLElement
): PlotGeometry | null => {
  let globals = (chart as unknown as { w?: { globals?: ApexGlobals } } | null)?.w?.globals;
  let svg = wrapper.querySelector('svg');
  if (!globals || !svg || !globals.gridWidth || !globals.gridHeight) return null;

  let svgRect = svg.getBoundingClientRect();

  return {
    left: svgRect.left + globals.translateX,
    top: svgRect.top + globals.translateY,
    width: globals.gridWidth,
    height: globals.gridHeight,
    minX: globals.minX,
    maxX: globals.maxX,
    minY: globals.minYArr?.[0] ?? globals.minY,
    maxY: globals.maxYArr?.[0] ?? globals.maxY,
    wrapper: wrapper.getBoundingClientRect()
  };
};

let isFiniteValue = (value: number | null | undefined): value is number =>
  value !== null && value !== undefined && Number.isFinite(value);

let useSeriesLookup = (series: ChartSeries[], xAxis: ChartXAxis) =>
  useMemo(() => {
    let reference = series.reduce<ChartSeries | undefined>(
      (longest, item) =>
        !longest || item.entries.length > longest.entries.length ? item : longest,
      undefined
    );

    let keys = reference?.entries.map(entry => entry.key) ?? [];
    let stamps = xAxis == 'time' ? keys.map(toTimestamp) : keys.map((_, i) => i);
    let colors = resolveSeriesColors(series).map(String);

    let values = series.map(item => {
      let byStamp = new Map<number, number | null>();
      item.entries.forEach((entry, i) =>
        byStamp.set(xAxis == 'time' ? toTimestamp(entry.key) : i, entry.value)
      );
      return byStamp;
    });

    let stepMs = xAxis == 'time' ? getSmallestTimeStep(series) : 1;

    return { keys, stamps, colors, values, stepMs: Number.isFinite(stepMs) ? stepMs : 0 };
  }, [series, xAxis]);

export let ChartHoverLayer = ({
  chart,
  series,
  xAxis,
  variant,
  mode,
  stacked,
  intervalMs,
  totalLabel,
  clickHint,
  formatValue,
  onBarClick,
  selection,
  renderedRef,
  children
}: {
  chart: React.RefObject<ApexCharts | null>;
  series: ChartSeries[];
  xAxis: ChartXAxis;
  variant: ChartTooltipVariant;
  mode: 'line' | 'bar';
  stacked?: boolean;
  intervalMs?: number;
  totalLabel?: string;
  clickHint?: string;
  formatValue: ValueFormatter;
  onBarClick?: (click: TimelineBarClick) => void;
  selection?: ChartSelection;
  renderedRef?: React.MutableRefObject<(() => void) | undefined>;
  children: React.ReactNode;
}) => {
  let wrapperRef = useRef<HTMLDivElement>(null);
  let [plotBox, setPlotBox] = useState<PlotBox | null>(null);

  useEffect(() => {
    let wrapper = wrapperRef.current;
    if (!wrapper || !selection) return;

    let frame = 0;
    let measure = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        let plot = wrapperRef.current
          ? getPlotGeometry(chart.current, wrapperRef.current)
          : null;
        setPlotBox(current => {
          let next = plot ? toPlotBox(plot) : null;
          return JSON.stringify(current) == JSON.stringify(next) ? current : next;
        });
      });
    };

    if (renderedRef) renderedRef.current = measure;
    let observer = new ResizeObserver(measure);
    observer.observe(wrapper);
    measure();

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      if (renderedRef) renderedRef.current = undefined;
    };
  }, [!!selection]);
  let [hover, setHover] = useState<HoverState | null>(null);
  let lookup = useSeriesLookup(series, xAxis);
  let stepMs = intervalMs ?? lookup.stepMs;

  let [draft, setDraft] = useState<{ from: number; to: number } | null>(null);
  let dragRef = useRef<SelectionDrag | null>(null);
  let suppressClickRef = useRef(false);

  let editable =
    !!selection?.onChange && xAxis == 'time' && mode == 'bar' && stepMs > 0 && !!plotBox;
  let domainStart = lookup.stamps[0] ?? 0;
  let domainEnd = (lookup.stamps[lookup.stamps.length - 1] ?? 0) + stepMs;

  let committedFrom = selection?.range ? toTimestamp(selection.range.from) : null;
  let committedTo = selection?.range ? toTimestamp(selection.range.to) : null;

  useEffect(() => {
    if (!dragRef.current) setDraft(null);
  }, [committedFrom, committedTo]);

  let getTimeAt = (clientX: number) => {
    let wrapper = wrapperRef.current;
    if (!wrapper || !plotBox) return domainStart;

    let x = clientX - wrapper.getBoundingClientRect().left - plotBox.left;
    let time = plotBox.minX + (x / plotBox.width) * (plotBox.maxX - plotBox.minX) + stepMs / 2;
    return Math.min(Math.max(time, domainStart), domainEnd);
  };

  let snapToBoundary = (time: number) =>
    domainStart + Math.round((time - domainStart) / stepMs) * stepMs;
  let floorToBucket = (time: number) =>
    Math.min(
      domainStart + Math.floor((time - domainStart) / stepMs) * stepMs,
      domainEnd - stepMs
    );

  let getDragRange = (drag: SelectionDrag, clientX: number) => {
    let time = getTimeAt(clientX);
    let { from, to } = drag.range;

    if (drag.kind == 'start') {
      return { from: Math.min(Math.max(snapToBoundary(time), domainStart), to - stepMs), to };
    }

    if (drag.kind == 'end') {
      return { from, to: Math.max(Math.min(snapToBoundary(time), domainEnd), from + stepMs) };
    }

    if (drag.kind == 'move') {
      let shift = Math.round((time - drag.originTime) / stepMs) * stepMs;
      shift = Math.min(Math.max(shift, domainStart - from), domainEnd - to);
      return { from: from + shift, to: to + shift };
    }

    let anchor = floorToBucket(drag.originTime);
    let current = floorToBucket(time);
    return { from: Math.min(anchor, current), to: Math.max(anchor, current) + stepMs };
  };

  let startDrag = (kind: SelectionDrag['kind'], event: React.PointerEvent) => {
    if (!editable || event.button != 0) return;
    event.stopPropagation();

    let range =
      committedFrom !== null && committedTo !== null
        ? { from: committedFrom, to: committedTo }
        : { from: domainStart, to: domainStart + stepMs };

    dragRef.current = {
      kind,
      originX: event.clientX,
      originTime: getTimeAt(event.clientX),
      range,
      active: false
    };

    let latest: { from: number; to: number } | null = null;

    let finish = (commit: boolean) => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onCancel);
      window.removeEventListener('keydown', onKey);

      let drag = dragRef.current;
      dragRef.current = null;
      if (!drag?.active) return;

      suppressClickRef.current = true;
      setTimeout(() => (suppressClickRef.current = false), 0);

      let next = commit ? latest : null;
      let changed = next && (next.from != committedFrom || next.to != committedTo);
      if (next && changed) {
        selection?.onChange?.({ from: new Date(next.from), to: new Date(next.to) });
      } else {
        setDraft(null);
      }
    };

    let onMove = (moveEvent: PointerEvent) => {
      let drag = dragRef.current;
      if (!drag) return;

      if (!drag.active) {
        if (Math.abs(moveEvent.clientX - drag.originX) < DRAG_THRESHOLD_PX) return;
        drag.active = true;
        setHover(null);
      }

      latest = getDragRange(drag, moveEvent.clientX);
      setDraft(latest);
    };
    let onUp = () => finish(true);
    let onCancel = () => finish(false);
    let onKey = (keyEvent: KeyboardEvent) => {
      if (keyEvent.key == 'Escape') finish(false);
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onCancel);
    window.addEventListener('keydown', onKey);
  };

  let getRows = (index: number): TooltipRow[] =>
    series.map((item, i) => ({
      id: item.id,
      name: item.name,
      color: lookup.colors[i] ?? String(theme.colors.gray600),
      value: lookup.values[i]?.get(lookup.stamps[index]!) ?? null
    }));

  useEffect(() => {
    if (!hover) return;

    let clear = () => setHover(null);
    window.addEventListener('scroll', clear, true);
    window.addEventListener('resize', clear);

    return () => {
      window.removeEventListener('scroll', clear, true);
      window.removeEventListener('resize', clear);
    };
  }, [!!hover]);

  let onMouseMove = (event: React.MouseEvent) => {
    if (dragRef.current?.active) return;

    let wrapper = wrapperRef.current;
    let plot = wrapper ? getPlotGeometry(chart.current, wrapper) : null;
    let count = lookup.stamps.length;

    if (!plot || !count) return setHover(null);

    let relX = event.clientX - plot.left;
    let outside =
      relX < -4 ||
      relX > plot.width + 4 ||
      event.clientY < plot.top - 4 ||
      event.clientY > plot.top + plot.height + 4;
    if (outside) return setHover(null);

    let spanX = plot.maxX - plot.minX;
    let slotWidth =
      xAxis == 'time'
        ? spanX > 0
          ? (stepMs / spanX) * plot.width
          : plot.width
        : plot.width / (mode == 'bar' ? count : Math.max(count - 1, 1));

    let toX = (index: number) => {
      if (xAxis == 'category') {
        return mode == 'bar' ? (index + 0.5) * slotWidth : index * slotWidth;
      }
      return spanX > 0 ? ((lookup.stamps[index]! - plot.minX) / spanX) * plot.width : 0;
    };

    let index = 0;
    let bestDistance = Infinity;
    for (let i = 0; i < count; i++) {
      let distance = Math.abs(toX(i) - relX);
      if (distance < bestDistance) {
        bestDistance = distance;
        index = i;
      }
    }

    if (mode == 'bar' && bestDistance > Math.max(slotWidth / 2, 4)) return setHover(null);

    let spanY = plot.maxY - plot.minY || 1;
    let toY = (value: number) =>
      plot.top +
      plot.height *
        (1 - (Math.min(Math.max(value, plot.minY), plot.maxY) - plot.minY) / spanY);

    let rows = getRows(index);
    let finite = rows.map(row => (isFiniteValue(row.value) ? row.value : 0));
    let topValue =
      mode == 'bar' && stacked
        ? finite.reduce((sum, value) => sum + value, 0)
        : Math.max(
            ...rows.filter(row => isFiniteValue(row.value)).map(row => row.value!),
            plot.minY
          );

    let segment: number | null = null;
    if (mode == 'bar' && stacked) {
      let cursorValue =
        plot.minY + ((plot.top + plot.height - event.clientY) / plot.height) * spanY;
      let cumulative = 0;
      for (let i = 0; i < finite.length; i++) {
        if (finite[i]! <= 0) continue;
        cumulative += finite[i]!;
        if (cursorValue <= cumulative) {
          segment = i;
          break;
        }
      }
    } else if (mode == 'bar' && series.length == 1) {
      segment = 0;
    }

    let centerX = plot.left + toX(index);
    let offsetX = plot.left - plot.wrapper.left;
    let offsetY = plot.top - plot.wrapper.top;
    let bandWidth = mode == 'bar' ? Math.max(slotWidth * 0.92, 3) : 1;
    let bandLeft = Math.max(toX(index) - bandWidth / 2, 0);
    let bandRight = Math.min(toX(index) + bandWidth / 2, plot.width);

    let next: HoverState = {
      index,
      segment,
      centerX,
      anchorY: Math.min(toY(topValue), plot.top + plot.height * MAX_ANCHOR_DEPTH),
      plotTop: plot.top,
      plotBottom: plot.top + plot.height,
      band: {
        left: offsetX + bandLeft,
        width: Math.max(bandRight - bandLeft, 1),
        top: offsetY,
        height: plot.height
      },
      dots:
        mode == 'line'
          ? rows
              .filter(row => isFiniteValue(row.value))
              .map(row => ({
                x: centerX - plot.wrapper.left,
                y: toY(row.value!) - plot.wrapper.top,
                color: row.color
              }))
          : []
    };

    setHover(current =>
      current &&
      current.index == next.index &&
      current.segment == next.segment &&
      current.centerX == next.centerX &&
      current.anchorY == next.anchorY
        ? current
        : next
    );
  };

  let clickable = !!onBarClick && !!hover;

  return (
    <Wrapper
      ref={wrapperRef}
      onMouseMove={onMouseMove}
      onMouseLeave={() => setHover(null)}
      onPointerDown={event => startDrag('create', event)}
      onClick={() => {
        if (suppressClickRef.current) {
          suppressClickRef.current = false;
          return;
        }

        if (hover && onBarClick) {
          let from = xAxis == 'time' ? lookup.stamps[hover.index]! : hover.index;
          onBarClick({
            dataPointIndex: hover.index,
            seriesIndex: hover.segment,
            from: new Date(from),
            to: new Date(from + stepMs)
          });
        }
      }}
      style={{
        cursor: clickable ? 'pointer' : undefined,
        userSelect: editable ? 'none' : undefined
      }}
    >
      {hover && mode == 'bar' && <Band style={hover.band} />}

      <Plot>{children}</Plot>

      {selection && plotBox && (draft || selection.range) && (
        <SelectionOverlay
          selection={selection}
          range={
            draft ?? {
              from: toTimestamp(selection.range!.from),
              to: toTimestamp(selection.range!.to)
            }
          }
          pending={!!draft}
          editable={editable}
          plot={plotBox}
          mode={mode}
          stepMs={xAxis == 'time' ? stepMs : 0}
          countLabel={totalLabel ?? 'total'}
          series={series}
          formatValue={formatValue}
          onDragStart={startDrag}
        />
      )}

      {hover && mode == 'line' && (
        <>
          <Guide style={hover.band} />
          {hover.dots.map((dot, i) => (
            <Dot key={i} style={{ left: dot.x, top: dot.y, background: dot.color }} />
          ))}
        </>
      )}

      {hover &&
        createPortal(
          <FloatingTooltip
            variant={variant}
            centerX={hover.centerX}
            anchorY={variant == 'chip' ? hover.plotTop : hover.anchorY}
            fallbackY={hover.plotBottom}
            hasFooter={variant == 'card' && !!onBarClick && !!clickHint}
          >
            {variant == 'chip' ? (
              <ChipContent
                time={
                  xAxis == 'time'
                    ? formatBucketTime(lookup.keys[hover.index]!, stepMs)
                    : undefined
                }
                rows={getRows(hover.index)}
                formatValue={formatValue}
              />
            ) : (
              <CardContent
                time={
                  xAxis == 'time'
                    ? formatBucketRange(lookup.keys[hover.index]!, stepMs)
                    : String(lookup.keys[hover.index] ?? '')
                }
                rows={getRows(hover.index)}
                showTotal={mode == 'bar' && !!stacked}
                totalLabel={totalLabel}
                highlight={hover.segment}
                clickHint={onBarClick ? clickHint : undefined}
                formatValue={formatValue}
              />
            )}
          </FloatingTooltip>,
          document.body
        )}
    </Wrapper>
  );
};

type PlotBox = {
  left: number;
  top: number;
  width: number;
  height: number;
  minX: number;
  maxX: number;
};

let toPlotBox = (plot: PlotGeometry): PlotBox => ({
  left: plot.left - plot.wrapper.left,
  top: plot.top - plot.wrapper.top,
  width: plot.width,
  height: plot.height,
  minX: plot.minX,
  maxX: plot.maxX
});

let getSelectionCount = (series: ChartSeries[], range: { from: number; to: number }) => {
  let { from, to } = range;
  let count = 0;

  for (let item of series) {
    for (let entry of item.entries) {
      let stamp = toTimestamp(entry.key);
      if (stamp >= from && stamp < to && isFiniteValue(entry.value)) count += entry.value;
    }
  }

  return count;
};

let SelectionOverlay = ({
  selection,
  range,
  pending,
  editable,
  plot,
  mode,
  stepMs,
  countLabel,
  series,
  formatValue,
  onDragStart
}: {
  selection: ChartSelection;
  range: { from: number; to: number };
  pending: boolean;
  editable: boolean;
  plot: PlotBox;
  mode: 'line' | 'bar';
  stepMs: number;
  countLabel: string;
  series: ChartSeries[];
  formatValue: ValueFormatter;
  onDragStart: (kind: SelectionDrag['kind'], event: React.PointerEvent) => void;
}) => {
  let span = plot.maxX - plot.minX;
  if (!(span > 0)) return null;

  let offset = mode == 'bar' ? stepMs / 2 : 0;
  let toX = (time: number) =>
    Math.min(Math.max(((time - offset - plot.minX) / span) * plot.width, 0), plot.width);

  let start = toX(range.from);
  let end = toX(range.to);
  if (end - start < 1) {
    if (start >= plot.width || end <= 0) return null;
    end = start + 2;
  }

  let base = { top: plot.top, height: plot.height };
  let center = plot.left + Math.min(Math.max((start + end) / 2, 80), plot.width - 80);
  let label = selection.formatLabel?.({ from: new Date(range.from), to: new Date(range.to) });

  return (
    <>
      <SelectionMask style={{ ...base, left: plot.left, width: start }} />
      <SelectionMask
        style={{ ...base, left: plot.left + end, width: Math.max(plot.width - end, 0) }}
      />

      <SelectionGroup
        data-active={pending}
        style={{
          ...base,
          left: plot.left + start - HANDLE_HIT_WIDTH,
          width: end - start + HANDLE_HIT_WIDTH * 2
        }}
      >
        <SelectionBrush
          $editable={editable}
          $pending={pending}
          onPointerDown={event => onDragStart('move', event)}
        />

        {editable && (
          <>
            <SelectionEdge
              style={{ left: 0 }}
              onPointerDown={event => onDragStart('start', event)}
            >
              <SelectionHandle />
            </SelectionEdge>
            <SelectionEdge
              style={{ right: 0 }}
              onPointerDown={event => onDragStart('end', event)}
            >
              <SelectionHandle />
            </SelectionEdge>
          </>
        )}
      </SelectionGroup>

      <SelectionLabel
        $pending={pending}
        style={{ top: plot.top >= 28 ? plot.top - 26 : plot.top + 4, left: center }}
        onPointerDown={event => event.stopPropagation()}
        onClick={event => event.stopPropagation()}
      >
        {label ? <span>{label}</span> : null}
        <SelectionCount>
          {formatValue(getSelectionCount(series, range))} {countLabel}
        </SelectionCount>
        {selection.onClear && !pending ? (
          <SelectionClear
            type="button"
            aria-label="Clear time selection"
            onClick={() => selection.onClear?.()}
          >
            ×
          </SelectionClear>
        ) : null}
      </SelectionLabel>
    </>
  );
};

let FloatingTooltip = ({
  variant,
  centerX,
  anchorY,
  fallbackY,
  hasFooter,
  children
}: {
  variant: ChartTooltipVariant;
  centerX: number;
  anchorY: number;
  fallbackY: number;
  hasFooter: boolean;
  children: React.ReactNode;
}) => {
  let ref = useRef<HTMLDivElement>(null);
  let caretRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    let element = ref.current;
    if (!element) return;

    let { width, height } = element.getBoundingClientRect();
    let gap = variant == 'chip' ? 6 : ANCHOR_GAP;

    let top = anchorY - gap - height;
    let below = top < VIEWPORT_MARGIN;
    if (below) top = Math.min(fallbackY + gap, window.innerHeight - height - VIEWPORT_MARGIN);

    let left = Math.min(
      Math.max(centerX - width / 2, VIEWPORT_MARGIN),
      window.innerWidth - width - VIEWPORT_MARGIN
    );

    element.style.transform = `translate(${Math.round(left)}px, ${Math.round(top)}px)`;
    element.style.visibility = 'visible';

    let caret = caretRef.current;
    if (caret) {
      let caretX = Math.min(Math.max(centerX - left, 14), width - 14);
      caret.style.left = `${caretX - 5}px`;
      caret.style.top = below ? '-6px' : '';
      caret.style.bottom = below ? '' : '-6px';
      caret.style.transform = below ? 'rotate(225deg)' : 'rotate(45deg)';
      caret.style.background = !below && hasFooter ? String(theme.colors.gray100) : 'white';
    }
  });

  return (
    <Floating ref={ref} role="tooltip">
      {children}
      {variant == 'card' && <Caret ref={caretRef} />}
    </Floating>
  );
};

let MAX_CARD_ROWS = 4;
let MAX_CHIP_ROWS = 3;

let formatRowValue = (value: number | null, formatValue: ValueFormatter) =>
  isFiniteValue(value) ? formatValue(value) : '—';

let pickRows = (rows: TooltipRow[], max: number) => {
  if (rows.length <= max) return { visible: rows, hidden: 0 };

  let sorted = rows
    .filter(row => isFiniteValue(row.value) && row.value != 0)
    .sort((a, b) => b.value! - a.value!);

  return { visible: sorted.slice(0, max), hidden: Math.max(sorted.length - max, 0) };
};

let CardContent = ({
  time,
  rows,
  showTotal,
  totalLabel,
  highlight,
  clickHint,
  formatValue
}: {
  time: string;
  rows: TooltipRow[];
  showTotal: boolean;
  totalLabel?: string;
  highlight: number | null;
  clickHint?: string;
  formatValue: ValueFormatter;
}) => {
  let total = rows.reduce((sum, row) => sum + (isFiniteValue(row.value) ? row.value : 0), 0);
  let single = rows.length == 1 ? rows[0] : undefined;
  let { visible, hidden } = pickRows(rows, MAX_CARD_ROWS);
  let highlightedId = highlight === null ? undefined : rows[highlight]?.id;

  return (
    <Card>
      <CardBody>
        <CardTime>{time}</CardTime>

        {(showTotal || single) && (
          <CardTotal>
            <CardTotalValue>
              {single ? formatRowValue(single.value, formatValue) : formatValue(total)}
            </CardTotalValue>
            <CardTotalLabel>{single ? single.name : (totalLabel ?? 'total')}</CardTotalLabel>
          </CardTotal>
        )}

        {showTotal && rows.length > 1 && total > 0 && (
          <ShareBar>
            {rows.map(row =>
              isFiniteValue(row.value) && row.value > 0 ? (
                <ShareSegment
                  key={row.id}
                  style={{ flexGrow: row.value, background: row.color }}
                />
              ) : null
            )}
          </ShareBar>
        )}

        {!single && (
          <CardRows>
            {visible.map(row => (
              <CardRow key={row.id} $active={row.id == highlightedId}>
                <Swatch style={{ background: row.color }} />
                <CardRowName>{row.name}</CardRowName>
                <CardRowValue>{formatRowValue(row.value, formatValue)}</CardRowValue>
              </CardRow>
            ))}
            {hidden > 0 && <CardMore>+{hidden} more</CardMore>}
            {!visible.length && <CardMore>No activity</CardMore>}
          </CardRows>
        )}
      </CardBody>

      {clickHint && <CardFooter>{clickHint} ↗</CardFooter>}
    </Card>
  );
};

let ChipContent = ({
  time,
  rows,
  formatValue
}: {
  time?: string;
  rows: TooltipRow[];
  formatValue: ValueFormatter;
}) => {
  let { visible, hidden } = pickRows(rows, MAX_CHIP_ROWS);

  return (
    <Chip>
      {time && <ChipTime>{time}</ChipTime>}
      {visible.map(row => (
        <ChipValue key={row.id}>
          {rows.length > 1 && <Swatch style={{ background: row.color }} />}
          {formatRowValue(row.value, formatValue)}
        </ChipValue>
      ))}
      {hidden > 0 && <ChipTime>+{hidden}</ChipTime>}
      {!visible.length && <ChipValue>0</ChipValue>}
    </Chip>
  );
};

let Wrapper = styled.div`
  position: relative;
`;

let Plot = styled.div`
  position: relative;
  z-index: 1;
`;

let Band = styled.div`
  position: absolute;
  z-index: 0;
  background: ${theme.colors.gray300};
  border-radius: 3px;
  pointer-events: none;
`;

let Guide = styled.div`
  position: absolute;
  z-index: 2;
  background: ${theme.colors.gray400};
  pointer-events: none;
`;

let Dot = styled.div`
  position: absolute;
  z-index: 3;
  width: 8px;
  height: 8px;
  margin: -4px 0 0 -4px;
  border-radius: 50%;
  border: 2px solid white;
  box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.08);
  pointer-events: none;
`;

let SelectionMask = styled.div`
  position: absolute;
  z-index: 2;
  background: rgba(255, 255, 255, 0.62);
  pointer-events: none;
`;

let SelectionGroup = styled.div`
  position: absolute;
  z-index: 3;
  pointer-events: none;
`;

let SelectionBrush = styled.div<{ $editable: boolean; $pending: boolean }>`
  position: absolute;
  top: 0;
  bottom: 0;
  left: ${HANDLE_HIT_WIDTH}px;
  right: ${HANDLE_HIT_WIDTH}px;
  background: ${p => (p.$pending ? 'rgba(94, 177, 239, 0.16)' : 'rgba(94, 177, 239, 0.1)')};
  border-left: 1.5px solid ${theme.colors.blue800};
  border-right: 1.5px solid ${theme.colors.blue800};
  pointer-events: ${p => (p.$editable ? 'auto' : 'none')};
  cursor: ${p => (p.$editable ? (p.$pending ? 'grabbing' : 'grab') : 'default')};
  transition: background 0.12s;

  ${SelectionGroup}:hover & {
    background: rgba(94, 177, 239, 0.16);
  }
`;

let SelectionEdge = styled.div`
  position: absolute;
  top: 0;
  bottom: 0;
  width: ${HANDLE_HIT_WIDTH * 2}px;
  pointer-events: auto;
  cursor: ew-resize;
`;

let SelectionHandle = styled.div`
  position: absolute;
  top: 50%;
  left: 50%;
  width: 10px;
  height: 24px;
  transform: translate(-50%, -50%);
  border: 1.5px solid ${theme.colors.blue800};
  border-radius: 5px;
  background: white;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.15);
  opacity: 0;
  transition: opacity 0.12s;
  pointer-events: none;

  &::before {
    content: '';
    position: absolute;
    left: 2px;
    right: 2px;
    top: 7px;
    bottom: 7px;
    border-top: 1px solid ${theme.colors.blue800};
    border-bottom: 1px solid ${theme.colors.blue800};
  }

  ${SelectionGroup}:hover &,
  ${SelectionGroup}[data-active='true'] & {
    opacity: 1;
  }
`;

let SelectionLabel = styled.div<{ $pending: boolean }>`
  position: absolute;
  z-index: 4;
  transform: translateX(-50%);
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 22px;
  padding: 0 4px 0 8px;
  border-radius: 6px;
  background: ${p => (p.$pending ? theme.colors.blue800 : theme.colors.gray900)};
  color: white;
  font-size: 11px;
  font-weight: 500;
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.16);
`;

let SelectionCount = styled.span`
  color: rgba(255, 255, 255, 0.65);
`;

let SelectionClear = styled.button`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  padding: 0;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: rgba(255, 255, 255, 0.75);
  font: inherit;
  font-size: 13px;
  line-height: 1;
  cursor: pointer;

  &:hover {
    background: rgba(255, 255, 255, 0.16);
    color: white;
  }
`;

let Floating = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  z-index: 10000;
  visibility: hidden;
  pointer-events: none;
  font-family: inherit;
`;

let Caret = styled.div`
  position: absolute;
  width: 10px;
  height: 10px;
  background: white;
  border-right: 1px solid ${theme.colors.gray400};
  border-bottom: 1px solid ${theme.colors.gray400};
`;

let Card = styled.div`
  width: 232px;
  background: white;
  border: 1px solid ${theme.colors.gray400};
  border-radius: 10px;
  box-shadow:
    0 4px 16px rgba(0, 0, 0, 0.1),
    0 1px 3px rgba(0, 0, 0, 0.06);
  overflow: hidden;
`;

let CardBody = styled.div`
  padding: 10px 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

let CardTime = styled.div`
  font-size: 11px;
  color: ${theme.colors.gray600};
  font-variant-numeric: tabular-nums;
`;

let CardTotal = styled.div`
  display: flex;
  align-items: baseline;
  gap: 6px;
  min-width: 0;
`;

let CardTotalValue = styled.div`
  font-size: 18px;
  font-weight: 600;
  color: ${theme.colors.gray900};
  font-variant-numeric: tabular-nums;
`;

let CardTotalLabel = styled.div`
  font-size: 12px;
  color: ${theme.colors.gray700};
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

let ShareBar = styled.div`
  display: flex;
  gap: 2px;
  height: 6px;
  border-radius: 3px;
  overflow: hidden;
`;

let ShareSegment = styled.div`
  flex-basis: 0;
  min-width: 2px;
`;

let CardRows = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
`;

let CardRow = styled.div<{ $active: boolean }>`
  display: flex;
  align-items: center;
  gap: 7px;
  font-size: 12px;
  color: ${p => (p.$active ? theme.colors.gray900 : theme.colors.gray700)};
  font-weight: ${p => (p.$active ? 600 : 400)};
`;

let CardRowName = styled.div`
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

let CardRowValue = styled.div`
  font-variant-numeric: tabular-nums;
  color: ${theme.colors.gray900};
`;

let CardMore = styled.div`
  font-size: 11px;
  color: ${theme.colors.gray600};
`;

let CardFooter = styled.div`
  padding: 7px 12px;
  background: ${theme.colors.gray100};
  border-top: 1px solid ${theme.colors.gray300};
  font-size: 11px;
  color: ${theme.colors.gray700};
`;

let Swatch = styled.span`
  flex: none;
  width: 8px;
  height: 8px;
  border-radius: 2px;
`;

let Chip = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  height: 28px;
  padding: 0 10px;
  border-radius: 7px;
  background: ${theme.colors.gray900};
  color: white;
  font-size: 12px;
  font-weight: 500;
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.18);
`;

let ChipTime = styled.span`
  color: rgba(255, 255, 255, 0.6);
`;

let ChipValue = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 5px;
`;
