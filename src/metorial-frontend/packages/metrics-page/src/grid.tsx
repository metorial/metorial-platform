import { Chart, ChartLegend, ChartProps } from '@metorial/chart';
import { Text, theme, Title } from '@metorial/ui';
import React from 'react';
import styled from 'styled-components';

let defaultHeights = {
  full: 280,
  half: 200
};

let GridContainer = styled.div`
  container-type: inline-size;
  width: 100%;
  min-width: 0;
`;

let Grid = styled.div`
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 20px;

  @container (max-width: 760px) {
    grid-template-columns: minmax(0, 1fr);
  }
`;

let Card = styled.section<{ $span: MetricChartCardSpan }>`
  grid-column: ${({ $span }) => ($span == 'full' ? '1 / -1' : 'auto')};
  display: flex;
  flex-direction: column;
  min-width: 0;
  border: 1px solid ${theme.colors.gray400};
  border-radius: 8px;
  background: ${theme.colors.gray100};
  box-shadow: ${theme.shadows.small};
`;

let Header = styled.header`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 6px 16px;
  margin-bottom: 10px;
  padding: 10px 18px 0 18px;
`;

let HeaderContent = styled.div`
  display: flex;
  flex-direction: column;
  min-width: 0;
`;

let HeaderEnd = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-end;
  gap: 8px 16px;
  margin-left: auto;

  & > * {
    flex: none;
    width: auto;
  }
`;

let Content = styled.div`
  flex: 1;
  margin: 0 -1px -1px -1px;
  padding: 12px 12px 4px 8px;
  border: 1px solid ${theme.colors.gray400};
  border-radius: 8px;
  background: ${theme.colors.background};
  overflow: hidden;
`;

export type MetricChartCardSpan = 'full' | 'half';

export type MetricChartCardProps = Omit<ChartProps, 'type' | 'legend'> & {
  title: React.ReactNode;
  description?: React.ReactNode;
  span?: MetricChartCardSpan;
  legend?: boolean;
  actions?: React.ReactNode;
  bare?: boolean;
};

let PanelRoot = styled.div`
  container-type: inline-size;
  display: flex;
  flex-direction: column;
  min-width: 0;
  border: 1px solid ${theme.colors.gray400};
  border-radius: 8px;
  background: ${theme.colors.background};
  box-shadow: ${theme.shadows.small};
  overflow: hidden;
`;

let PanelBar = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 8px 16px;
  padding: 8px 12px;
  border-bottom: 1px solid ${theme.colors.gray400};
  background: ${theme.colors.gray100};
`;

let PanelSections = styled.div`
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));

  & > * + * {
    border-left: 1px solid ${theme.colors.gray400};
  }

  @container (max-width: 760px) {
    grid-template-columns: minmax(0, 1fr);

    & > * + * {
      border-left: none;
      border-top: 1px solid ${theme.colors.gray400};
    }
  }
`;

export let MetricsPanel = ({
  title,
  description,
  toolbar,
  children
}: {
  title?: React.ReactNode;
  description?: React.ReactNode;
  toolbar?: React.ReactNode;
  children: React.ReactNode;
}) => (
  <PanelRoot>
    {title || toolbar ? (
      <PanelBar>
        <HeaderContent>
          {title ? (
            <Title as="h2" size="2" weight="strong">
              {title}
            </Title>
          ) : null}

          {description ? (
            <Text size="1" weight="strong" color="gray600">
              {description}
            </Text>
          ) : null}
        </HeaderContent>

        {toolbar}
      </PanelBar>
    ) : null}
    <PanelSections>{children}</PanelSections>
  </PanelRoot>
);

let BareCard = styled.section`
  display: flex;
  flex-direction: column;
  min-width: 0;
  padding: 14px 16px 8px 16px;

  & > header {
    padding: 0;
  }
`;

export let MetricsGrid = ({ children }: { children: React.ReactNode }) => (
  <GridContainer>
    <Grid>{children}</Grid>
  </GridContainer>
);

export let MetricChartCard = ({
  title,
  description,
  span = 'half',
  legend,
  actions,
  height,
  bare,
  ...chart
}: MetricChartCardProps) => {
  let showLegend = legend ?? (chart.series.length > 1 && !chart.error);

  let header = (
    <>
            <Header>
        <HeaderContent>
          <Title as="h2" size="2" weight="strong">
            {title}
          </Title>

          {description ? (
            <Text size="1" weight="strong" color="gray600">
              {description}
            </Text>
          ) : null}
        </HeaderContent>

        {showLegend || actions ? (
          <HeaderEnd>
            {showLegend ? <ChartLegend items={chart.series} /> : null}
            {actions}
          </HeaderEnd>
        ) : null}
      </Header>

    </>
  );

  if (bare) {
    return (
      <BareCard>
        {header}
        <Chart {...chart} height={height ?? defaultHeights[span]} legend={false} />
      </BareCard>
    );
  }

  return (
    <Card $span={span}>
      {header}
      <Content>
        <Chart {...chart} height={height ?? defaultHeights[span]} legend={false} />
      </Content>
    </Card>
  );
};
