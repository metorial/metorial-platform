import React, { useMemo, useReducer } from 'react';
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

export let RenderDate = ({ date }: { date: string | Date | undefined }) => {
  let [retriggerIndex, doRetrigger] = useReducer(s => s + 1, 0);

  let result = useMemo(() => {
    if (!date) return { date: null, utc: '', local: '', pretty: '', timeZone: '' };

    let parsed = typeof date == 'string' ? new Date(date) : date;
    let utc = new Date(parsed.toUTCString().replace('GMT', ''));

    let humanOffset = shleemy(parsed).forHumans;

    return {
      date: parsed,
      humanOffset,
      utc: utc.toLocaleString(),
      local: parsed.toLocaleString(),
      pretty: parsed.toLocaleString(),
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
    };
  }, [date, retriggerIndex]);

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
      <div style={{ width: 'fit-content', height: 'fit-content' }} onMouseEnter={doRetrigger}>
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
      </div>
    </Tooltip>
  );
};
