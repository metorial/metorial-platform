import { describe, expect, it } from 'vitest';
import {
  buildSpendReportCsv,
  dollarsCell,
  formatCsvCell,
  numericCell,
  serializeCsvExport,
  spendReportCsvFileName
} from './csv';
import type { SpendReport } from './reportSummary';

let cost = (totalMicros: number | null, isEstimate = false) => ({
  currency: 'usd' as const,
  totalMicros,
  billedMicros: totalMicros,
  estimatedMicros: 0,
  isEstimate,
  reportedByClientMicros: null,
  listPriceMicros: totalMicros,
  requestsWithoutCost: 0,
  requestsWithoutListPrice: 0
});

let tokens = (total: number) => ({
  input: total,
  cacheRead: 0,
  cacheWrite: 0,
  output: 0,
  reasoning: 0,
  total
});

let monthCosts = [1_500_000, 2_250_001, 333];

let scenarioMonths = (rate: number) =>
  Array.from({ length: 22 }, (_, offset) => {
    let month = `${2026 + Math.floor((offset + 2) / 12)}-${String(((offset + 2) % 12) + 1).padStart(2, '0')}`;
    let projectedMicros = Math.round(1_000_000 * (1 + rate) ** offset * 30);
    let actualMicros = offset == 0 ? 333 : 0;
    return {
      month,
      actualMicros,
      projectedMicros,
      totalMicros: actualMicros + projectedMicros
    };
  });

let scenario = (rate: number) => {
  let months = scenarioMonths(rate);
  let sum = (items: typeof months, key: 'projectedMicros' | 'totalMicros') =>
    items.reduce((total, item) => total + item[key], 0);

  return {
    growthRate: rate,
    months,
    yearEndTotalMicros: 3_750_334 + sum(months.slice(0, 10), 'projectedMicros'),
    nextYearTotalMicros: sum(months.slice(10), 'totalMicros')
  };
};

let breakdownItem = (d: {
  kind: 'model' | 'client' | 'member' | 'unknown' | 'other';
  key: string;
  costMicros: number;
  share: number | null;
  model?: { id: string; name: string | null };
  client?: { family: string; name: string | null };
  member?: { name: string | null; email: string | null };
}) => ({
  kind: d.kind,
  key: d.key,
  member: d.member
    ? {
        object: 'agent_tracking.member' as const,
        id: d.key,
        name: d.member.name,
        email: d.member.email,
        emails: [],
        matched: true,
        consumer: null,
        needsReview: false
      }
    : null,
  model: d.model ?? null,
  client: d.client ?? null,
  unknownModelNames: [],
  share: d.share,
  cost: cost(d.costMicros),
  requests: 4,
  tokens: tokens(40)
});

let makeReport = (overrides: Partial<SpendReport> = {}): SpendReport => ({
  object: 'agent_tracking.spend_report',
  year: 2026,
  range: {
    preset: null,
    from: new Date('2026-01-01T00:00:00Z'),
    to: new Date('2026-03-15T12:00:00Z'),
    timeZone: 'Europe/Berlin'
  },
  total: { cost: cost(3_750_334, true), requests: 30, tokens: tokens(3000) },
  counts: { sessions: 12, members: 3, capped: false },
  startsBeforeRetention: false,
  privacy: { hideIndividuals: false, minGroupUsers: 5, hiddenGroups: false },
  coverage: {
    firstDay: '2026-01-05',
    daysWithData: 60,
    hiddenDays: 0,
    startsBeforeYear: false,
    lastFullDay: '2026-03-14'
  },
  months: monthCosts.map((micros, index) => ({
    month: `2026-0${index + 1}`,
    startsAt: new Date(`2026-0${index + 1}-01T00:00:00Z`),
    hiddenDays: 0,
    cost: cost(micros),
    requests: 10,
    tokens: tokens(1000),
    counts: { sessions: 4, members: 2 }
  })),
  breakdowns: {
    model: [
      breakdownItem({
        kind: 'model',
        key: 'claude-sonnet-4-5',
        costMicros: 3_000_000,
        share: 0.8,
        model: { id: 'claude-sonnet-4-5', name: 'Claude Sonnet 4.5' }
      }),
      breakdownItem({ kind: 'other', key: 'other', costMicros: 750_334, share: 0.2 })
    ],
    client: [
      breakdownItem({
        kind: 'client',
        key: 'claude_code',
        costMicros: 3_750_334,
        share: 1,
        client: { family: 'claude_code', name: 'Claude Code' }
      })
    ],
    member: [
      breakdownItem({
        kind: 'member',
        key: 'aten_1',
        costMicros: 3_750_334,
        share: 1,
        member: { name: '=HYPERLINK("http://x")', email: 'a@example.com' }
      })
    ]
  },
  projection: {
    status: 'projected',
    baseline: { from: '2026-02-13', to: '2026-03-14', days: 30, dailyRateMicros: 1_000_000 },
    growth: { rate: 0.05, source: 'observed' },
    scenarios: { flat: scenario(0), growth: scenario(0.05) }
  },
  ...overrides
});

let lines = (csv: string) => csv.slice(1).split('\r\n');

let sectionRows = (csv: string, title: string) => {
  let all = lines(csv);
  let start = all.findIndex(line => line == title || line.startsWith(`${title},`));
  if (start < 0) return null;

  let end = all.indexOf('', start);
  return all.slice(start + 2, end < 0 ? undefined : end);
};

let microsOf = (dollars: string) => BigInt(dollars.replace('.', ''));

describe('formatCsvCell', () => {
  it('quotes commas, quotes and line breaks', () => {
    expect(formatCsvCell('plain')).toBe('plain');
    expect(formatCsvCell('a,b')).toBe('"a,b"');
    expect(formatCsvCell('say "hi"')).toBe('"say ""hi"""');
    expect(formatCsvCell('line\nbreak')).toBe('"line\nbreak"');
    expect(formatCsvCell('line\r\nbreak')).toBe('"line\r\nbreak"');
  });

  it('defuses text that a spreadsheet would read as a formula', () => {
    expect(formatCsvCell('=SUM(A1:A2)')).toBe("'=SUM(A1:A2)");
    expect(formatCsvCell('+1')).toBe("'+1");
    expect(formatCsvCell('-2')).toBe("'-2");
    expect(formatCsvCell('@cmd')).toBe("'@cmd");
    expect(formatCsvCell('\tTab')).toBe("'\tTab");
    expect(formatCsvCell('\rReturn')).toBe('"\'\rReturn"');
    expect(formatCsvCell('=1,2')).toBe('"\'=1,2"');
    expect(formatCsvCell('  =1+1')).toBe("'  =1+1");
    expect(formatCsvCell(' @cmd')).toBe("' @cmd");
    expect(formatCsvCell('\n=1')).toBe('"\'\n=1"');
    expect(formatCsvCell('\nText')).toBe('"\'\nText"');
    expect(formatCsvCell('\uFF1D1+1')).toBe("'\uFF1D1+1");
    expect(formatCsvCell('\uFF0B1')).toBe("'\uFF0B1");
    expect(formatCsvCell('\uFF0D1')).toBe("'\uFF0D1");
    expect(formatCsvCell('\uFF20cmd')).toBe("'\uFF20cmd");
    expect(formatCsvCell('a=b')).toBe('a=b');
    expect(formatCsvCell('Claude Code')).toBe('Claude Code');
  });

  it('keeps numeric cells numeric, negatives included', () => {
    expect(formatCsvCell(-5)).toBe('-5');
    expect(formatCsvCell(0)).toBe('0');
    expect(formatCsvCell(numericCell('-1.500000'))).toBe('-1.500000');
    expect(formatCsvCell(numericCell('=1+1'))).toBe("'=1+1");
    expect(formatCsvCell(Number.NaN)).toBe('');
    expect(formatCsvCell(null)).toBe('');
    expect(formatCsvCell(undefined)).toBe('');
  });
});

describe('dollarsCell', () => {
  it('converts micros to exact decimal dollars', () => {
    expect(formatCsvCell(dollarsCell(123_456_789))).toBe('123.456789');
    expect(formatCsvCell(dollarsCell(1))).toBe('0.000001');
    expect(formatCsvCell(dollarsCell(-1_500_000))).toBe('-1.500000');
    expect(formatCsvCell(dollarsCell(9_007_199_254_740_991))).toBe('9007199254.740991');
    expect(formatCsvCell(dollarsCell(300_000 + 600_000))).toBe('0.900000');
  });

  it('leaves an unknown cost empty rather than zero', () => {
    expect(dollarsCell(null)).toBeNull();
    expect(dollarsCell(undefined)).toBeNull();
  });
});

describe('serializeCsvExport', () => {
  it('writes a BOM, CRLF line endings and a final line break', () => {
    expect(
      serializeCsvExport([
        ['a', 1],
        ['b', null]
      ])
    ).toBe('﻿a,1\r\nb,\r\n');
  });
});

describe('buildSpendReportCsv', () => {
  let generatedAt = new Date('2026-03-15T12:34:56Z');

  it('writes the sections in order', () => {
    let csv = buildSpendReportCsv(makeReport(), { generatedAt });
    let titles = lines(csv).filter((line, index, all) => index == 0 || all[index - 1] == '');

    expect(csv.startsWith('﻿Summary\r\nField,Value\r\nYear,2026\r\n')).toBe(true);
    expect(titles).toEqual([
      'Summary',
      'Coverage and Method',
      'Monthly',
      'Next Year Projection (2027)',
      'Breakdowns'
    ]);
    expect(lines(csv)).toContain('Generated At,2026-03-15T12:34:56.000Z');
    expect(lines(csv)).toContain('Time Zone,Europe/Berlin');
    expect(lines(csv)).toContain('Year to Date Cost (USD),3.750334');
    expect(lines(csv)).toContain('Growth Rate Per Month (%),5');
    expect(lines(csv)).toContain('Growth Rate Source,observed trend');
    expect(lines(csv)).toContain('Baseline From,2026-02-13');
  });

  it('explains the days with data as the report page does', () => {
    let coverage = (report: SpendReport) =>
      sectionRows(buildSpendReportCsv(report, { generatedAt }), 'Coverage and Method');

    expect(coverage(makeReport())).toContain(
      'Note,"60 days with usage through today (Mar 15, 2026), which is still in progress."'
    );
    expect(
      coverage(
        makeReport({
          privacy: { hideIndividuals: true, minGroupUsers: 5, hiddenGroups: false }
        })
      )
    ).toContain('Note,"60 days with usage through Mar 14, 2026, not counting today."');
    expect(
      coverage(
        makeReport({
          year: 2025,
          coverage: { ...makeReport().coverage, lastFullDay: '2025-12-31' },
          projection: {
            status: 'not_applicable',
            baseline: null,
            growth: null,
            scenarios: null
          }
        })
      )
    ).toContain('Note,60 days with usage in 2025.');
    expect(
      coverage(
        makeReport({ coverage: { ...makeReport().coverage, firstDay: null, daysWithData: 0 } })
      )?.some(line => line.includes('days with usage'))
    ).toBe(false);
  });

  it('has monthly actual costs that add up to the year-to-date total', () => {
    let report = makeReport();
    let monthly = sectionRows(buildSpendReportCsv(report, { generatedAt }), 'Monthly')!;
    let actual = monthly.map(row => row.split(',')[1]).filter(Boolean) as string[];

    expect(actual).toEqual(['1.500000', '2.250001', '0.000333']);
    expect(actual.reduce((sum, value) => sum + microsOf(value), 0n)).toBe(
      BigInt(report.total.cost.totalMicros!)
    );
  });

  it('lists the rest of the year as projected months and next year in its own section', () => {
    let csv = buildSpendReportCsv(makeReport(), { generatedAt });
    let monthly = sectionRows(csv, 'Monthly')!;
    let nextYear = sectionRows(csv, 'Next Year Projection (2027)')!;

    expect(monthly).toHaveLength(12);
    expect(monthly[2]).toBe('2026-03,0.000333,30.000000,30.000000,10,1000,4,2');
    expect(monthly[3]).toBe('2026-04,,30.000000,31.500000,,,,');
    expect(monthly[11]!.startsWith('2026-12,')).toBe(true);
    expect(nextYear).toHaveLength(12);
    expect(nextYear[0]!.startsWith('2027-01,30.000000,')).toBe(true);
  });

  it('writes breakdown rows with safe names and shares in percent', () => {
    let breakdowns = sectionRows(
      buildSpendReportCsv(makeReport(), { generatedAt }),
      'Breakdowns'
    )!;

    expect(breakdowns).toContain(
      'Model,Claude Sonnet 4.5,claude-sonnet-4-5,4,3.000000,No,80.00'
    );
    expect(breakdowns).toContain('Model,Other Models,other,4,0.750334,No,20.00');
    expect(breakdowns).toContain('Client,Claude Code,claude_code,4,3.750334,No,100.00');
    expect(breakdowns).toContain(
      'Member,"\'=HYPERLINK(""http://x"")",aten_1,4,3.750334,No,100.00'
    );
  });

  it('names the rest of the members and unnamed members as the page does', () => {
    let base = makeReport();
    let report = makeReport({
      breakdowns: {
        ...base.breakdowns,
        member: [
          breakdownItem({
            kind: 'member',
            key: 'aten_2',
            costMicros: 3_000_000,
            share: 0.8,
            member: { name: null, email: null }
          }),
          breakdownItem({ kind: 'unknown', key: 'unknown', costMicros: 500_000, share: 0.13 }),
          breakdownItem({ kind: 'other', key: 'other', costMicros: 250_334, share: 0.07 })
        ]
      }
    });
    let breakdowns = sectionRows(buildSpendReportCsv(report, { generatedAt }), 'Breakdowns')!;

    expect(breakdowns).toContain('Member,Unknown Member,aten_2,4,3.000000,No,80.00');
    expect(breakdowns).toContain('Member,Unknown Member,unknown,4,0.500000,No,13.00');
    expect(breakdowns).toContain('Member,2 Others,other,4,0.250334,No,7.00');
  });

  it('leaves out breakdowns and counts when individuals are hidden', () => {
    let report = makeReport({
      counts: null,
      privacy: { hideIndividuals: true, minGroupUsers: 5, hiddenGroups: true },
      breakdowns: { model: null, client: null, member: null }
    });
    let csv = buildSpendReportCsv(report, { generatedAt });

    expect(sectionRows(csv, 'Breakdowns')).toBeNull();
    expect(lines(csv)).toContain('Sessions,');
    expect(lines(csv)).toContain('Active Members,');
    expect(lines(csv)).toContain('Individuals Hidden,Yes');
  });

  it('has no projection figures for a past year', () => {
    let report = makeReport({
      year: 2025,
      projection: { status: 'not_applicable', baseline: null, growth: null, scenarios: null }
    });
    let csv = buildSpendReportCsv(report, { generatedAt });

    expect(sectionRows(csv, 'Next Year Projection (2026)')).toBeNull();
    expect(lines(csv)).toContain('Projection,Not Applicable (past year)');
    expect(lines(csv)).toContain('2025 Total Cost (USD),3.750334');
    expect(lines(csv).some(line => line.startsWith('Year to Date'))).toBe(false);
    expect(lines(csv).some(line => line.startsWith('Projected Year-End'))).toBe(false);
    expect(sectionRows(csv, 'Monthly')).toHaveLength(3);
  });

  it('names the file after the year', () => {
    expect(spendReportCsvFileName(2026)).toBe('agent-usage-report-2026.csv');
  });
});
