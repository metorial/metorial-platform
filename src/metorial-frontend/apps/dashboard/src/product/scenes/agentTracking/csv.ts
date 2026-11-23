import { dollarsOf } from './costFormat';
import { memberName } from './memberParts';
import {
  describeCoverageDays,
  growthPercentOf,
  growthSourceLabels,
  projectionEstimateNote,
  projectionMinDays,
  reportTotalLabel,
  unknownClientLabel,
  type ProjectionScenario,
  type ReportBreakdownGroup,
  type SpendReport
} from './reportSummary';
import { clientLabel, modelLabel, unknownModelLabel } from './sessionParts';
import { breakdownOthersCount, breakdownOthersLabel } from './spendParts';

let byteOrderMark = '\uFEFF';

let lineEnd = '\r\n';

let formulaStart = /^(?:[\t\r\n]|\s*[=+\-@\uFF1D\uFF0B\uFF0D\uFF20])/;

let needsQuotes = /[",\r\n]/;

let plainNumber = /^-?\d+(\.\d+)?$/;

let projectionStatusLabels: Record<SpendReport['projection']['status'], string> = {
  projected: 'Projected',
  insufficient_data: `Not Enough Data Yet (needs at least ${projectionMinDays} days)`,
  not_applicable: 'Not Applicable (past year)'
};

let breakdownTypes: { id: ReportBreakdownGroup; label: string }[] = [
  { id: 'model', label: 'Model' },
  { id: 'client', label: 'Client' },
  { id: 'member', label: 'Member' }
];

let monthlyNote =
  'In Monthly, Actual Cost is the cost recorded so far and Projected Remaining is the projected cost still to come. For the current month the two add up to its projected total.';

type NumericCell = { numeric: string };

export type CsvCell = string | number | null | undefined | NumericCell;

type BreakdownItem = NonNullable<SpendReport['breakdowns']['model']>[number];

export let numericCell = (value: string): NumericCell => ({ numeric: value });

export let dollarsCell = (micros: number | null | undefined) =>
  micros === null || micros === undefined ? null : numericCell(dollarsOf(micros));

let escapeText = (text: string) => {
  let safe = formulaStart.test(text) ? `'${text}` : text;
  return needsQuotes.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
};

export let formatCsvCell = (cell: CsvCell) => {
  if (cell === null || cell === undefined) return '';
  if (typeof cell == 'number') return Number.isFinite(cell) ? String(cell) : '';
  if (typeof cell == 'object') {
    return plainNumber.test(cell.numeric) ? cell.numeric : escapeText(cell.numeric);
  }

  return escapeText(cell);
};

export let serializeCsvExport = (rows: CsvCell[][]) =>
  byteOrderMark + rows.map(row => row.map(formatCsvCell).join(',')).join(lineEnd) + lineEnd;

export let spendReportCsvFileName = (year: number) => `agent-usage-report-${year}.csv`;

let yesNo = (value: boolean) => (value ? 'Yes' : 'No');

let percentCell = (rate: number) => numericCell(String(growthPercentOf(rate)));

let shareCell = (share: number | null) =>
  share === null ? null : numericCell((share * 100).toFixed(2));

let section = (title: string, header: string[], rows: CsvCell[][]): CsvCell[][] => [
  [title],
  header,
  ...rows
];

let summaryRows = (report: SpendReport, generatedAt: Date): CsvCell[][] => {
  let cost = report.total.cost;
  let scenarios = report.projection.scenarios;

  return [
    ['Year', report.year],
    ['Generated At', generatedAt.toISOString()],
    ['Time Zone', report.range.timeZone],
    [`${reportTotalLabel(report)} Cost (USD)`, dollarsCell(cost.totalMicros)],
    ['Billed Cost (USD)', dollarsCell(cost.billedMicros)],
    ['Estimated Cost (USD)', dollarsCell(cost.estimatedMicros)],
    ['List Price Cost (USD)', dollarsCell(cost.listPriceMicros)],
    ['Cost Includes Estimates', yesNo(cost.isEstimate)],
    ['Requests Without a Known Cost', cost.requestsWithoutCost],
    ['Model Requests', report.total.requests],
    ['Tokens', report.total.tokens.total],
    ['Sessions', report.counts?.sessions],
    ['Active Members', report.counts?.members],
    ['Individuals Hidden', yesNo(report.privacy.hideIndividuals)],
    ...(scenarios
      ? [
          [
            'Projected Year-End Total, Flat (USD)',
            dollarsCell(scenarios.flat.yearEndTotalMicros)
          ],
          [
            'Projected Year-End Total, With Growth (USD)',
            dollarsCell(scenarios.growth.yearEndTotalMicros)
          ],
          [
            `Projected ${report.year + 1} Total, Flat (USD)`,
            dollarsCell(scenarios.flat.nextYearTotalMicros)
          ],
          [
            `Projected ${report.year + 1} Total, With Growth (USD)`,
            dollarsCell(scenarios.growth.nextYearTotalMicros)
          ]
        ]
      : [])
  ];
};

let coverageRows = (report: SpendReport): CsvCell[][] => {
  let coverage = report.coverage;
  let { baseline, growth } = report.projection;
  let coverageDays = describeCoverageDays(report);

  return [
    ['First Day With Data', coverage.firstDay],
    ['Usage Before the Year Started', yesNo(coverage.startsBeforeYear)],
    ['Days With Data', coverage.daysWithData],
    ['Hidden Days', coverage.hiddenDays],
    ['Last Full Day', coverage.lastFullDay],
    ...(coverageDays ? [['Note', coverageDays]] : []),
    ['Year Starts Before Retention', yesNo(report.startsBeforeRetention)],
    ['Projection', projectionStatusLabels[report.projection.status]],
    ['Baseline From', baseline?.from],
    ['Baseline To', baseline?.to],
    ['Baseline Days', baseline?.days],
    ['Daily Rate (USD)', dollarsCell(baseline?.dailyRateMicros)],
    ['Growth Rate Per Month (%)', growth ? percentCell(growth.rate) : null],
    ['Growth Rate Source', growth ? growthSourceLabels[growth.source] : null],
    ['Note', projectionEstimateNote],
    ['Note', monthlyNote]
  ];
};

let projectedOf = (scenario: ProjectionScenario | undefined, month: string) =>
  dollarsCell(scenario?.months.find(item => item.month == month)?.projectedMicros);

let monthlyRows = (report: SpendReport): CsvCell[][] => {
  let scenarios = report.projection.scenarios;
  let flat = scenarios?.flat;
  let growth = scenarios?.growth;

  let actual = report.months.map(month => [
    month.month,
    dollarsCell(month.cost.totalMicros),
    projectedOf(flat, month.month),
    projectedOf(growth, month.month),
    month.requests,
    month.tokens.total,
    month.counts?.sessions,
    month.counts?.members
  ]);

  let known = new Set(report.months.map(month => month.month));
  let rest = (flat?.months ?? [])
    .filter(month => month.month.startsWith(`${report.year}-`) && !known.has(month.month))
    .map(month => [
      month.month,
      null,
      projectedOf(flat, month.month),
      projectedOf(growth, month.month),
      null,
      null,
      null,
      null
    ]);

  return [...actual, ...rest];
};

let nextYearRows = (
  report: SpendReport,
  scenarios: { flat: ProjectionScenario; growth: ProjectionScenario }
) =>
  scenarios.flat.months
    .filter(month => month.month.startsWith(`${report.year + 1}-`))
    .map(month => [
      month.month,
      dollarsCell(month.totalMicros),
      dollarsCell(scenarios.growth.months.find(item => item.month == month.month)?.totalMicros)
    ]);

let breakdownName = (
  item: BreakdownItem,
  group: ReportBreakdownGroup,
  others: number | null
) => {
  if (item.kind == 'other') return breakdownOthersLabel(group, others);
  if (group == 'member') return memberName(item.member);
  if (group == 'client') return item.client ? clientLabel(item.client) : unknownClientLabel;
  return item.model ? modelLabel(item.model) : unknownModelLabel;
};

let breakdownRows = (report: SpendReport): CsvCell[][] =>
  breakdownTypes.flatMap(type => {
    let items = report.breakdowns[type.id] ?? [];
    let others = breakdownOthersCount(report.counts, items);

    return items.map(item => [
      type.label,
      breakdownName(item, type.id, others),
      item.key,
      item.requests,
      dollarsCell(item.cost.totalMicros),
      yesNo(item.cost.isEstimate),
      shareCell(item.share)
    ]);
  });

export let buildSpendReportCsv = (report: SpendReport, options: { generatedAt: Date }) => {
  let scenarios = report.projection.scenarios;
  let hasBreakdowns = breakdownTypes.some(type => report.breakdowns[type.id] !== null);

  let sections = [
    section('Summary', ['Field', 'Value'], summaryRows(report, options.generatedAt)),
    section('Coverage and Method', ['Field', 'Value'], coverageRows(report)),
    section(
      'Monthly',
      [
        'Month',
        'Actual Cost (USD)',
        'Projected Remaining Flat (USD)',
        'Projected Remaining With Growth (USD)',
        'Requests',
        'Tokens',
        'Sessions',
        'Active Members'
      ],
      monthlyRows(report)
    ),
    ...(scenarios
      ? [
          section(
            `Next Year Projection (${report.year + 1})`,
            ['Month', 'Flat (USD)', 'With Growth (USD)'],
            nextYearRows(report, scenarios)
          )
        ]
      : []),
    ...(hasBreakdowns
      ? [
          section(
            'Breakdowns',
            [
              'Type',
              'Name',
              'ID',
              'Requests',
              'Cost (USD)',
              'Cost Includes Estimates',
              'Share (%)'
            ],
            breakdownRows(report)
          )
        ]
      : [])
  ];

  return serializeCsvExport(sections.flatMap((rows, index) => (index ? [[], ...rows] : rows)));
};
