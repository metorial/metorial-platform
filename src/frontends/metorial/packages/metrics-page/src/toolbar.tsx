import { DatePicker, OptionToggle, Select, Text, Tooltip } from '@metorial/ui';
import { endOfDay, isSameDay, startOfDay } from 'date-fns';
import { RiCalendarLine } from '@remixicon/react';
import React, { useMemo } from 'react';
import styled from 'styled-components';
import {
  autoMetricsInterval,
  clampMetricsRange,
  defaultMetricsIntervals,
  defaultMetricsRangePresets,
  formatIntervalShort,
  getMetricsIntervalChoices,
  getMetricsPresetChoices,
  MetricsIntervalChoice,
  MetricsIntervalOption,
  MetricsQuery,
  MetricsRangePreset,
  pickAutoInterval,
  resolveMetricsRange
} from './range';

let Wrapper = styled.div<{ $justify: 'between' | 'end' }>`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: ${({ $justify }) => ($justify == 'end' ? 'flex-end' : 'space-between')};
  gap: 10px;
`;

let Group = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
  min-width: 0;
`;

let PresetSlot = styled.div`
  flex: 0 0 auto;
`;

let IntervalControl = styled.div`
  display: inline-flex;
  align-items: center;
  gap: 8px;
`;

let ReasonList = styled.ul`
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin: 0;
  padding: 0;
  list-style: none;
`;

export type MetricsToolbarProps = {
  value: MetricsQuery;
  onChange: (value: MetricsQuery) => void;
  presets?: MetricsRangePreset[];
  intervals?: MetricsIntervalOption[];
  hideInterval?: boolean;
  autoIntervalMs?: number;
  autoTargetPoints?: number;
  maxPoints?: number;
  retentionMs?: number;
  maxSpanMs?: number;
  start?: React.ReactNode;
  end?: React.ReactNode;
  size?: '1' | '2' | '3';
  justify?: 'between' | 'end';
  intervalInPicker?: boolean;
};

let groupDisabledReasons = (choices: MetricsIntervalChoice[]) => {
  let groups = new Map<string, string[]>();

  for (let choice of choices) {
    if (!choice.disabledReason) continue;
    groups.set(choice.disabledReason, [
      ...(groups.get(choice.disabledReason) ?? []),
      choice.label
    ]);
  }

  return [...groups.entries()].map(([reason, labels]) => ({ reason, labels }));
};

export let MetricsToolbar = ({
  value,
  onChange,
  presets = defaultMetricsRangePresets,
  intervals = defaultMetricsIntervals,
  hideInterval,
  autoIntervalMs,
  autoTargetPoints,
  maxPoints,
  retentionMs,
  maxSpanMs,
  start,
  end,
  size = '2',
  justify = 'between',
  intervalInPicker
}: MetricsToolbarProps) => {
  let now = new Date();
  let range = resolveMetricsRange(value.range, { now, presets, retentionMs, maxSpanMs });

  let presetChoices = getMetricsPresetChoices(presets, { retentionMs, maxSpanMs });
  let choices = getMetricsIntervalChoices(intervals, range, { now, maxPoints });
  let disabledReasons = groupDisabledReasons(choices);

  let autoMs =
    autoIntervalMs ??
    pickAutoInterval(intervals, range, { now, targetPoints: autoTargetPoints })?.durationMs;
  let autoLabel = autoMs ? `Auto (${formatIntervalShort(autoMs)})` : 'Auto';

  let customFrom = value.range.type == 'custom' ? value.range.from.getTime() : undefined;
  let customTo = value.range.type == 'custom' ? value.range.to.getTime() : undefined;
  let customValue = useMemo<[Date, Date] | undefined>(
    () =>
      customFrom === undefined || customTo === undefined
        ? undefined
        : [new Date(customFrom), new Date(customTo)],
    [customFrom, customTo]
  );

  let onCustomRange = ([from, to]: [Date, Date]) => {
    let previous = value.range.type == 'custom' ? value.range : undefined;
    let movedStart = !!previous && !isSameDay(from, previous.from);

    let clamped = clampMetricsRange(
      { from, to },
      { now: new Date(), retentionMs, maxSpanMs, anchor: movedStart ? 'from' : 'to' }
    );

    onChange({ ...value, range: { type: 'custom', ...clamped } });
  };

  let intervalSelect = (
    <IntervalControl>
      <Text as="span" size={size == '1' ? '1' : '2'} weight="medium" color="gray600">
        Interval
      </Text>

      <Select
        label="Interval"
        hideLabel
        size={size}
        value={value.interval}
        onChange={interval => {
          if (interval != value.interval) onChange({ ...value, interval });
        }}
        items={[
          { id: autoMetricsInterval, label: autoLabel },
          ...choices.map(choice => ({
            id: choice.id,
            label: choice.disabledHint
              ? `${choice.label} · ${choice.disabledHint}`
              : choice.label,
            disabled: choice.disabled
          }))
        ]}
      />
    </IntervalControl>
  );

  return (
    <Wrapper $justify={justify}>
      <Group>
        {start}

        <PresetSlot>
          <OptionToggle
            ariaLabel="Time Range"
            size={size}
            itemMinWidth={size == '1' ? 40 : 52}
            value={value.range.type == 'preset' ? value.range.preset : ''}
            onChange={preset => onChange({ ...value, range: { type: 'preset', preset } })}
            items={presetChoices.map(preset => ({
              id: preset.id,
              label: preset.label,
              disabled: preset.disabled,
              tooltip: preset.disabledReason
            }))}
          />
        </PresetSlot>

        <DatePicker
          label="Custom Range"
          hideLabel
          size={size}
          type="range"
          placeholder="Custom…"
          icon={intervalInPicker ? <RiCalendarLine size={16} /> : undefined}
          extra={intervalInPicker && !hideInterval ? intervalSelect : undefined}
          value={customValue}
          onChange={onCustomRange}
          minDate={
            retentionMs === undefined ? undefined : startOfDay(now.getTime() - retentionMs)
          }
          maxDate={endOfDay(now)}
        />
      </Group>

      {(hideInterval || intervalInPicker) && !end ? null : (
        <Group>
          {hideInterval || intervalInPicker ? null : disabledReasons.length ? (
            <Tooltip
              content={
                <ReasonList>
                  {disabledReasons.map(({ reason, labels }) => (
                    <li key={reason}>
                      {labels.join(', ')}: {reason}
                    </li>
                  ))}
                </ReasonList>
              }
            >
              {intervalSelect}
            </Tooltip>
          ) : (
            intervalSelect
          )}

          {end}
        </Group>
      )}
    </Wrapper>
  );
};
