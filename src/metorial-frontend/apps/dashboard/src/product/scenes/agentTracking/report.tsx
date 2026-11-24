import { Chart, formatNumber } from '@metorial/chart';
import type { DashboardInstanceAgentTrackingSpendReportQuery } from '@metorial/dashboard-sdk';
import { renderWithLoader } from '@metorial/data-hooks';
import { EmptyState } from '@metorial/empty-state';
import { saveBlob } from '@metorial/file-browser';
import { MetricsSummary } from '@metorial/metrics-page';
import { useAgentTrackingSpendReport } from '@metorial/state';
import { Button, Callout, Flex, OptionToggle, Spacer, Text } from '@metorial/ui';
import { Box } from '@metorial/ui-product';
import { RiDownload2Line } from '@remixicon/react';
import styled from 'styled-components';
import { CommitNumberInput } from './commitInput';
import { CostValue } from './cost';
import { formatAmount, fractionToPercent } from './costFormat';
import { buildSpendReportCsv, spendReportCsvFileName } from './csv';
import { agentTrackingErrorFor, PrivacySettingsButton } from './errorState';
import { WithInfo } from './info';
import { useAgentTrackingPrivacy } from './privacy';
import { formatAgentTrackingRange, getBrowserTimeZone } from './range';
import {
  currentYearIn,
  describeCoverage,
  foldBreakdownRows,
  formatDay,
  formatMonth,
  growthPercentBounds,
  growthSourceLabels,
  growthSourceText,
  hasReportCost,
  isEmptyReport,
  isPastYear,
  parseGrowthPercent,
  projectionMinDays,
  reportChartMonths,
  reportMemberRowsShown,
  reportTotalLabel,
  type ProjectionScenario,
  type SpendReport
} from './reportSummary';
import { useSearchParamOption, useSearchParamWriter } from './searchParams';
import {
  BreakdownTable,
  costChartProps,
  CostSplit,
  SpendCountsSummary,
  UnpricedNotice
} from './spendParts';
import {
  breakdownOthersCount,
  hasUsage,
  hiddenCountsNotice,
  isLoadedFor
} from './spendSummary';

let growthParam = 'growth';

let years = [
  { id: 'this', label: 'This Year' },
  { id: 'last', label: 'Last Year' }
] as const;

let scenarios = [
  { id: 'flat', label: 'Flat' },
  { id: 'growth', label: 'With Growth' }
] as const;

let breakdownGroups = [
  { id: 'model', label: 'Model' },
  { id: 'client', label: 'Client' },
  { id: 'member', label: 'Member' }
] as const;

let yearIds = years.map(item => item.id);

let scenarioIds = scenarios.map(item => item.id);

let breakdownGroupIds = breakdownGroups.map(item => item.id);

let projectionPadding = { vertical: 12, horizontal: 17 };

type YearOption = (typeof years)[number]['id'];

type ScenarioId = (typeof scenarios)[number]['id'];

type BreakdownGroup = (typeof breakdownGroups)[number]['id'];

type ReportView = {
  input: unknown;
  data: SpendReport | null;
  error: ReturnType<typeof useAgentTrackingSpendReport>['error'];
  isLoading: boolean;
  refetch: () => void;
};

let ProjectionNote = styled.div`
  padding: ${projectionPadding.vertical}px ${projectionPadding.horizontal}px;
`;

// A loader whose input turns null keeps its old data, so check it was loaded for this query.
let useCurrentReport = (
  instanceId: string,
  query: DashboardInstanceAgentTrackingSpendReportQuery | null
): ReportView => {
  let loader = useAgentTrackingSpendReport(instanceId, query);
  let current = isLoadedFor(loader, query && { instanceId, ...query });

  return {
    input: loader.input,
    data: current ? loader.data : null,
    error: current ? loader.error : null,
    isLoading: !current || loader.isLoading,
    refetch: loader.refetch
  };
};

let useGrowthPercent = () => {
  let [params, setParam] = useSearchParamWriter();
  let percent = parseGrowthPercent(params.get(growthParam));

  let setPercent = (next: number | undefined) =>
    setParam(growthParam, next === undefined ? undefined : String(next));

  return [percent, setPercent] as const;
};

let YearToDate = ({ report }: { report: SpendReport }) => {
  let cost = report.total.cost;
  let coverage = describeCoverage(report);

  let range = `${formatAgentTrackingRange(report.range)} · ${report.range.timeZone}.`;
  let coverageText = coverage.sentences.join(' ');
  let title = (info: string) => <WithInfo info={info}>{reportTotalLabel(report)}</WithInfo>;

  if (!hasUsage(report.total)) {
    return (
      <Box title={title(range)}>
        <Text size="2" color="gray700">
          {coverageText}
        </Text>
      </Box>
    );
  }

  return (
    <Box title={title(`${range} ${coverageText}`)}>
      <Flex justify="space-between" align="end" gap={20} wrap="wrap">
        <Text as="span" size="8" weight="bold">
          <CostValue cost={cost} />
        </Text>

        <SpendCountsSummary requests={report.total.requests} counts={report.counts} />
      </Flex>

      {report.counts ? null : (
        <>
          <Spacer height={10} />

          <Text size="2" color="gray700">
            {hiddenCountsNotice}
          </Text>
        </>
      )}

      <UnpricedNotice cost={cost} requests={report.total.requests} />

      <Spacer height={18} />

      <CostSplit cost={cost} />
    </Box>
  );
};

let GrowthControl = ({
  percent,
  setPercent,
  defaultGrowth
}: {
  percent: number | undefined;
  setPercent: (next: number | undefined) => void;
  defaultGrowth: SpendReport['projection']['growth'];
}) => {
  let defaultPercent = defaultGrowth ? fractionToPercent(defaultGrowth.rate) : 0;
  let defaultText = defaultGrowth ? `Default: ${growthSourceText(defaultGrowth)}.` : null;

  return (
    <Flex align="end" gap={12} wrap="wrap">
      <CommitNumberInput
        label={
          <WithInfo
            info={percent === undefined ? defaultText : `Set by you. ${defaultText ?? ''}`}
          >
            Monthly Growth
          </WithInfo>
        }
        size="2"
        unit="%"
        min={growthPercentBounds.min}
        max={growthPercentBounds.max}
        step={1}
        format={{ maximumFractionDigits: 2 }}
        value={percent ?? defaultPercent}
        onCommit={setPercent}
        style={{ width: 160 }}
      />

      {percent !== undefined ? (
        <Button size="2" variant="outline" onClick={() => setPercent(undefined)}>
          Use Default
        </Button>
      ) : null}
    </Flex>
  );
};

let MonthlyChart = ({
  report,
  scenario
}: {
  report: SpendReport;
  scenario: ProjectionScenario | null;
}) => {
  let months = reportChartMonths(report, scenario);
  let chart = costChartProps({
    rows: months,
    key: month => formatMonth(month.month),
    billed: month => month.billedMicros,
    estimated: month => month.estimatedMicros,
    projected: scenario ? month => month.projectedMicros : undefined
  });

  return (
    <Chart
      type="bar"
      xAxis="category"
      height={240}
      yMin={0}
      stacked
      {...chart}
      series={hasReportCost(months) ? chart.series : []}
      emptyText={`No cost in ${report.year}.`}
    />
  );
};

let Monthly = ({
  base,
  projected,
  scenario,
  setScenario,
  growthPercent,
  setGrowthPercent
}: {
  base: SpendReport;
  projected: ReportView;
  scenario: ScenarioId;
  setScenario: (next: ScenarioId) => void;
  growthPercent: number | undefined;
  setGrowthPercent: (next: number | undefined) => void;
}) => {
  let canProject = base.projection.status == 'projected';

  return (
    <Box
      title={
        <WithInfo
          info={
            canProject
              ? `Cost per month in ${base.year}, and the projection through ${base.year + 1}.`
              : `Cost per month in ${base.year}.`
          }
        >
          By Month
        </WithInfo>
      }
      rightActions={
        canProject ? (
          <OptionToggle
            size="2"
            ariaLabel="Projection"
            items={scenarios.map(item => ({ id: item.id, label: item.label }))}
            value={scenario}
            onChange={value => setScenario(value as ScenarioId)}
          />
        ) : undefined
      }
    >
      {canProject && scenario == 'growth' ? (
        <>
          <GrowthControl
            percent={growthPercent}
            setPercent={setGrowthPercent}
            defaultGrowth={base.projection.growth}
          />

          <Spacer height={16} />
        </>
      ) : null}

      {canProject ? (
        renderWithLoader(
          { projected },
          { error: agentTrackingErrorFor(projected) }
        )(({ projected }) => (
          <MonthlyChart
            report={projected.data}
            scenario={projected.data.projection.scenarios?.[scenario] ?? null}
          />
        ))
      ) : (
        <MonthlyChart report={base} scenario={null} />
      )}
    </Box>
  );
};

let projectionMethod = (report: SpendReport, scenario: ScenarioId) => {
  let { baseline, growth } = report.projection;
  if (!baseline || baseline.dailyRateMicros === null) return null;

  let scenarioText =
    scenario == 'growth' && growth
      ? `With Growth, the cost per day grows ${fractionToPercent(growth.rate)}% each month after this one, compounding (${growthSourceLabels[growth.source]}).`
      : 'Flat assumes every coming day costs that much.';

  return `Projections are estimates, based on the average cost per day over the ${formatNumber(baseline.days)} days from ${formatDay(baseline.from)} to ${formatDay(baseline.to)}: ${formatAmount(baseline.dailyRateMicros, { estimate: true })} per day. ${scenarioText} The year-end total adds the projected months to the cost so far.`;
};

let Projection = ({
  base,
  projected,
  scenario
}: {
  base: SpendReport;
  projected: ReportView;
  scenario: ScenarioId;
}) => {
  if (isPastYear(base)) return null;

  if (base.projection.status == 'insufficient_data') {
    let baseline = base.projection.baseline;

    return (
      <Box title="Projection">
        <Flex direction="column" gap={6}>
          <Text size="3" weight="strong">
            Not Enough Data Yet
          </Text>

          <Text size="2" color="gray700">
            {`A projection needs ${projectionMinDays} complete days after the first day with usage. ${
              baseline
                ? `There ${baseline.days == 1 ? 'is 1 complete day' : `are ${formatNumber(baseline.days)} complete days`} since ${formatDay(baseline.from)} so far.`
                : 'There is no complete day after the first day with usage yet.'
            }`}
          </Text>
        </Flex>
      </Box>
    );
  }

  let scenarioLabel = scenarios.find(item => item.id == scenario)!.label;
  return (
    <Box title={<WithInfo info={`${scenarioLabel} scenario.`}>Projection</WithInfo>} noPadding>
      {renderWithLoader(
        { projected },
        {
          spaceTop: projectionPadding.vertical,
          spaceBottom: projectionPadding.vertical,
          error: () => (
            <ProjectionNote>
              <Text size="2" color="gray600">
                The projection could not be loaded. Retry under By Month.
              </Text>
            </ProjectionNote>
          )
        }
      )(({ projected }) => {
        let report = projected.data;
        let figures = report.projection.scenarios?.[scenario];
        if (!figures) return null;

        return (
          <MetricsSummary
            frameless
            columns={2}
            items={[
              {
                id: 'yearEnd',
                label: (
                  <WithInfo info={projectionMethod(report, scenario)}>
                    {`Projected ${report.year} Total`}
                  </WithInfo>
                ),
                value: formatAmount(figures.yearEndTotalMicros, { estimate: true })
              },
              {
                id: 'nextYear',
                label: `Projected ${report.year + 1} Total`,
                value: formatAmount(figures.nextYearTotalMicros, { estimate: true })
              }
            ]}
          />
        );
      })}
    </Box>
  );
};

let Breakdowns = ({ report }: { report: SpendReport }) => {
  let [group, setGroup] = useSearchParamOption('group', breakdownGroupIds, 'model');
  let items = report.breakdowns[group];

  if (!items) {
    return (
      <Box title="Cost By">
        <Callout color="gray" action={<PrivacySettingsButton />}>
          Cost by model, client and member would show individual people, which this
          organization hides in Agent Usage.
        </Callout>
      </Box>
    );
  }

  let rows = group == 'member' ? foldBreakdownRows(items, reportMemberRowsShown) : items;
  let others = breakdownOthersCount(report.counts, rows);

  return (
    <Box
      title={
        <WithInfo
          info={`${report.year}${isPastYear(report) ? '' : ' so far'}. Share is of the total.`}
        >
          Cost By
        </WithInfo>
      }
      rightActions={
        <OptionToggle
          size="2"
          ariaLabel="Cost By"
          items={breakdownGroups.map(item => ({ id: item.id, label: item.label }))}
          value={group}
          onChange={value => setGroup(value as BreakdownGroup)}
        />
      }
    >
      {rows.length ? (
        <BreakdownTable items={rows} group={group} others={others} />
      ) : (
        <Text size="2" color="gray600">
          No usage in {report.year}.
        </Text>
      )}
    </Box>
  );
};

let ReportPage = ({
  instanceId,
  individualsHidden
}: {
  instanceId: string;
  individualsHidden: boolean;
}) => {
  let timeZone = individualsHidden ? 'UTC' : getBrowserTimeZone();
  let [yearOption, setYearOption] = useSearchParamOption('year', yearIds, 'this');
  let [scenario, setScenario] = useSearchParamOption('scenario', scenarioIds, 'growth');
  let [growthPercent, setGrowthPercent] = useGrowthPercent();

  let baseQuery: DashboardInstanceAgentTrackingSpendReportQuery =
    yearOption == 'last' ? { year: currentYearIn(timeZone) - 1, timeZone } : { timeZone };
  let base = useCurrentReport(instanceId, baseQuery);

  // Wait for the base report: the service allows only four concurrent queries.
  let projectedQuery =
    yearOption == 'last' || growthPercent === undefined
      ? baseQuery
      : !base.data
        ? null
        : base.data.projection.status == 'projected'
          ? { ...baseQuery, growthRate: growthPercent / 100 }
          : baseQuery;
  let projected = useCurrentReport(instanceId, projectedQuery);
  let empty = !!base.data && isEmptyReport(base.data);

  let exportCsv = () => {
    let report = projected.data;
    if (!report) return;

    saveBlob(
      new Blob([buildSpendReportCsv(report, { generatedAt: new Date() })], {
        type: 'text/csv;charset=utf-8'
      }),
      spendReportCsvFileName(report.year)
    );
  };

  return (
    <Flex direction="column" gap={20}>
      <Flex justify="space-between" align="center" gap={12} wrap="wrap">
        <div>
          <OptionToggle
            size="2"
            ariaLabel="Year"
            items={years.map(item => ({ id: item.id, label: item.label }))}
            value={yearOption}
            onChange={value => setYearOption(value as YearOption)}
          />
        </div>

        {empty ? null : (
          <Button
            size="2"
            variant="outline"
            iconLeft={<RiDownload2Line />}
            disabled={!projected.data}
            onClick={exportCsv}
          >
            Export CSV
          </Button>
        )}
      </Flex>

      {renderWithLoader(
        { base },
        { error: agentTrackingErrorFor(base) }
      )(({ base }) =>
        isEmptyReport(base.data) ? (
          <EmptyState
            title={`No Usage in ${base.data.year}`}
            description={
              isPastYear(base.data)
                ? 'Nothing was recorded for this year.'
                : 'Nothing has been recorded this year yet.'
            }
          />
        ) : (
          <>
            <YearToDate report={base.data} />

            <Monthly
              base={base.data}
              projected={projected}
              scenario={scenario}
              setScenario={setScenario}
              growthPercent={growthPercent}
              setGrowthPercent={setGrowthPercent}
            />

            <Projection base={base.data} projected={projected} scenario={scenario} />

            <Breakdowns report={base.data} />
          </>
        )
      )}
    </Flex>
  );
};

export let AgentTrackingReport = ({ instanceId }: { instanceId: string }) => {
  let settings = useAgentTrackingPrivacy();

  return renderWithLoader(
    { settings },
    { error: agentTrackingErrorFor(settings) }
  )(({ settings }) => (
    <ReportPage
      instanceId={instanceId}
      individualsHidden={settings.data.privacy.hideIndividuals}
    />
  ));
};
