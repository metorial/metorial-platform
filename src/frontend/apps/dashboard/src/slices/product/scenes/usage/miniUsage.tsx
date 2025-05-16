import { theme } from '@metorial/ui';
import { useMemo } from 'react';
import { useMeasure } from 'react-use';
import { styled } from 'styled-components';
import { useUsageState } from './state';

// @ts-ignore
import Trend from 'react-trend';

let Wrapper = styled.div``;

export let MiniUsageScene = ({
  entities
}: {
  entities: {
    type: string;
    id: string;
  }[];
}) => {
  let [ref, { width }] = useMeasure();

  let [usage] = useUsageState({
    entities,
    from: -7,
    interval: {
      unit: 'hour',
      count: 6
    }
  });

  let hasNonZero = useMemo(
    () => !!usage.data?.[0]?.entries.some(e => e.count > 0),
    [usage.data]
  );

  return (
    <Wrapper ref={ref as any}>
      <Trend
        data={usage.data?.[0]?.entries.map(e => e.count) ?? [0, 0]}
        smooth
        gradient={
          hasNonZero ? [theme.colors.primary, theme.colors.pink600] : [theme.colors.gray200]
        }
        radius={10}
        strokeWidth={1.5}
        strokeLinecap="round"
        width={width}
        height={60}
      />
    </Wrapper>
  );
};
