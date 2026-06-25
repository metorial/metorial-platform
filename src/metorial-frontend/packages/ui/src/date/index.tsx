import React, { useLayoutEffect, useMemo, useReducer, useRef, useState } from 'react';
import { useInterval } from 'react-use';
import { shleemy } from 'shleemy';
import { styled } from 'styled-components';
import { theme } from '../theme';
import { Tooltip } from '../tooltip';

let Header = styled('h1')`
  font-size: 14px;
  font-weight: 600;
`;

let Description = styled('p')`
  font-size: 13px;
  margin-top: 5px;
  opacity: 0.6;
  font-weight: 500;

  strong {
    font-weight: 700;
  }
`;

let normalizeDate = (date: string | Date | undefined) => {
  if (!date) return null;
  return typeof date == 'string' ? new Date(date) : date;
};

let useStaticDate = (date: string | Date | undefined) => {
  let [currentDate, setCurrentDate] = useState<Date | null>(() => normalizeDate(date));
  let currentDateIdentifier = useRef<string>(!date ? 'none' : String(date));
  let inputDateIdentifier = !date ? 'none' : String(date);

  useLayoutEffect(() => {
    if (currentDateIdentifier.current === inputDateIdentifier) return;

    currentDateIdentifier.current = inputDateIdentifier;
    setCurrentDate(normalizeDate(date));
  }, [inputDateIdentifier]);

  return currentDate;
};

type RenderDateFormat = 'full' | 'time' | 'date';

export let RenderDate = ({
  date,
  format = 'full'
}: {
  date: string | Date | undefined;
  format?: RenderDateFormat;
}) => {
  let [retriggerIndex, doRetrigger] = useReducer(s => s + 1, 0);

  let normalizedDate = useStaticDate(date);

  let result = useMemo(() => {
    if (!normalizedDate) return { date: null, utc: '', local: '', pretty: '', timeZone: '' };

    let parsed = normalizedDate;
    let utc = new Date(parsed.toUTCString().replace('GMT', ''));

    let humanOffset = shleemy(parsed).forHumans;
    let pretty =
      format == 'date'
        ? parsed.toLocaleDateString()
        : format == 'time'
          ? parsed.toLocaleTimeString()
          : parsed.toLocaleString();

    return {
      date: parsed,
      humanOffset,
      utc: utc.toLocaleString(),
      local: parsed.toLocaleString(),
      pretty,
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
    };
  }, [format, normalizedDate, retriggerIndex]);

  useInterval(() => doRetrigger(), 60 * 1000);

  if (!result.date)
    return (
      <time
        style={{
          cursor: 'pointer'
        }}
      >
        No date
      </time>
    );

  return (
    <Tooltip
      content={
        <div style={{ padding: 5 }}>
          <Header>Time</Header>
          <Description>
            <strong>UTC</strong>: <time>{result.utc}</time>
          </Description>
          <Description>
            <strong>Local</strong>: <time>{result.local}</time> ({result.timeZone})
          </Description>
          <Description>
            <strong>Offset</strong>: <time>{result.humanOffset}</time>
          </Description>
        </div>
      }
    >
      <span
        style={{ display: 'inline-block', width: 'fit-content', height: 'fit-content' }}
        onMouseEnter={doRetrigger}
      >
        <span
          style={{
            cursor: 'pointer',
            borderBottom: `1px dashed ${theme.colors.gray500}`,
            margin: 0,
            padding: 0,
            whiteSpace: 'nowrap',
            lineHeight: undefined
          }}
        >
          {result.pretty}
        </span>
      </span>
    </Tooltip>
  );
};
