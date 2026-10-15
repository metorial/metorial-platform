import { Skeleton, Text, theme } from '@metorial/ui';
import React from 'react';
import styled from 'styled-components';

let Strip = styled.dl<{ $columns?: number }>`
  display: grid;
  grid-template-columns: ${({ $columns }) =>
    $columns ? `repeat(${$columns}, minmax(0, 1fr))` : 'repeat(auto-fit, minmax(160px, 1fr))'};
  gap: 1px;
  margin: 0;
  background: ${theme.colors.background};
  border: 1px solid ${theme.colors.gray400};
  border-radius: 8px;
  box-shadow: ${theme.shadows.small};
  overflow: hidden;

  ${({ $columns }) =>
    $columns
      ? `
    @media (max-width: 720px) {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  `
      : ''}
`;

let Item = styled.div`
  display: flex;
  flex-direction: column;
  gap: 3px;
  min-width: 0;
  padding: 15px;
  background: ${theme.colors.background};
  box-shadow: 0 0 0 1px ${theme.colors.gray400};
`;

let Term = styled.dt`
  margin: 0;
`;

let Detail = styled.dd`
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin: 0;
`;

export type MetricsSummaryItem = {
  id?: string;
  label: React.ReactNode;
  value: React.ReactNode;
  sub?: React.ReactNode;
};

export let MetricsSummary = ({
  items,
  loading,
  columns
}: {
  items: MetricsSummaryItem[];
  loading?: boolean;
  columns?: number;
}) => (
  <Strip $columns={columns} aria-busy={loading || undefined}>
    {items.map((item, i) => (
      <Item key={item.id ?? i}>
        <Term>
          <Text as="span" size="1" weight="bold">
            {item.label}
          </Text>
        </Term>

        <Detail>
          <Skeleton active={!!loading}>
            <Text as="span" size="4" weight="strong" truncate>
              {loading ? '0000' : item.value}
            </Text>
          </Skeleton>

          {item.sub || loading ? (
            <Skeleton active={!!loading}>
              <Text as="span" size="1" weight="medium" color="gray600" truncate>
                {loading ? '000 · 0000' : item.sub}
              </Text>
            </Skeleton>
          ) : null}
        </Detail>
      </Item>
    ))}
  </Strip>
);
