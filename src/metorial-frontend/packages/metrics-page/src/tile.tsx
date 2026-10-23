import { Sparkline, SparklineProps } from '@metorial/chart';
import { getLink, Skeleton, Text, theme } from '@metorial/ui';
import React from 'react';
import styled from 'styled-components';

let defaultSparklineHeight = 40;

let TileGrid = styled.div<{ $columns: number }>`
  display: grid;
  grid-template-columns: repeat(${({ $columns }) => $columns}, minmax(0, 1fr));
  gap: 12px;

  @media (max-width: 720px) {
    grid-template-columns: minmax(0, 1fr);
  }
`;

let getTileColumns = (count: number) => {
  if (count <= 3) return Math.max(count, 1);
  if (count % 3 == 0) return 3;
  return 2;
};

let Tile = styled.div<{ $interactive: boolean }>`
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: 100%;
  min-width: 0;
  height: 100%;
  padding: 16px;
  font: inherit;
  text-align: left;
  border: 1px solid ${theme.colors.gray400};
  border-radius: 10px;
  background: ${theme.colors.background};
  box-shadow: ${theme.shadows.small};
  color: inherit;
  text-decoration: none;
  transition:
    background 0.15s ease,
    border-color 0.15s ease;

  ${({ $interactive }) =>
    $interactive
      ? `
    cursor: pointer;

    &:hover {
      background: ${theme.colors.gray200};
    }
  `
      : ''}
`;

let Headline = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 2px 8px;
  min-width: 0;
`;

let SparklineArea = styled.div<{ $height: number }>`
  position: relative;
  margin-top: auto;
  flex-shrink: 0;
  height: ${({ $height }) => $height}px;
  min-width: 0;
`;

let SparklineLayer = styled.div<{ $dimmed: boolean }>`
  height: 100%;
  opacity: ${({ $dimmed }) => ($dimmed ? 0.35 : 1)};
`;

let Overlay = styled.div`
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
`;

let OverlayLabel = styled.span`
  padding: 2px 8px;
  border: 1px solid ${theme.colors.gray300};
  border-radius: 6px;
  background: ${theme.colors.background};
  box-shadow: ${theme.shadows.small};
  color: ${theme.colors.gray700};
  font-size: 12px;
  font-weight: 500;
  white-space: nowrap;
`;

let SkeletonBlock = styled.div<{ $height: number }>`
  width: 100%;
  height: ${({ $height }) => $height}px;
`;

export type MetricTileProps = {
  title: React.ReactNode;
  value?: React.ReactNode;
  context?: React.ReactNode;
  sparkline?: SparklineProps;
  overlay?: React.ReactNode;
  href?: string;
  onClick?: () => void;
  loading?: boolean;
  error?: React.ReactNode;
};

export let MetricTileGrid = ({ children }: { children: React.ReactNode }) => (
  <TileGrid $columns={getTileColumns(React.Children.toArray(children).length)}>
    {children}
  </TileGrid>
);

export let MetricTile = ({
  title,
  value,
  context,
  sparkline,
  overlay,
  href,
  onClick,
  loading,
  error
}: MetricTileProps) => {
  let sparklineHeight = sparkline?.height ?? defaultSparklineHeight;
  let hasError = !!error && !loading;

  let body = (
    <Tile
      $interactive={!!(href || onClick)}
      as={onClick && !href ? 'button' : 'div'}
      type={onClick && !href ? 'button' : undefined}
      onClick={href ? undefined : onClick}
      aria-busy={loading || undefined}
    >
      <Text as="span" size="1" weight="medium" color="gray800">
        {title}
      </Text>

      <Headline>
        <Skeleton active={!!loading}>
          <Text as="span" size="6" weight="strong">
            {loading ? '0.00' : hasError ? '—' : (value ?? '—')}
          </Text>
        </Skeleton>

        {loading || context || hasError ? (
          <Skeleton active={!!loading}>
            <Text as="span" size="1" weight="medium" color="gray600">
              {loading ? 'of 0 · peak 0' : hasError ? error : context}
            </Text>
          </Skeleton>
        ) : null}
      </Headline>

      {sparkline || loading ? (
        <SparklineArea $height={sparklineHeight}>
          {loading ? (
            <Skeleton active style={{ width: '100%' }}>
              <SkeletonBlock $height={sparklineHeight} />
            </Skeleton>
          ) : sparkline ? (
            <>
              <SparklineLayer $dimmed={!!overlay || hasError}>
                <Sparkline
                  {...sparkline}
                  series={hasError ? [] : sparkline.series}
                  height={sparklineHeight}
                  tooltip={sparkline.tooltip ?? !overlay}
                />
              </SparklineLayer>

              {overlay ? (
                <Overlay>
                  <OverlayLabel>{overlay}</OverlayLabel>
                </Overlay>
              ) : null}
            </>
          ) : null}
        </SparklineArea>
      ) : null}
    </Tile>
  );

  if (!href) return body;

  let Link = getLink();

  return (
    <Link
      to={href}
      style={{ display: 'block', minWidth: 0, color: 'inherit', textDecoration: 'none' }}
    >
      {body}
    </Link>
  );
};
