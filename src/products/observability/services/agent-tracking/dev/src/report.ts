import type { BenchmarkReport } from './bench/runner';
import type { ExplainResult } from './bench/explain';
import { round, type Summary } from './lib/stats';
import type { DryRunReport } from './load/dryRun';
import type { Knee } from './load/knee';
import type { ProbeReport } from './load/probe';
import type { LaneStepResult, StepResult } from './load/run';

let ms = (value: number | null) => (value === null ? '-' : `${Math.round(value)}`);

let pct = (value: number) => `${(value * 100).toFixed(2)}%`;

let pad = (value: string, width: number) => value.padStart(width);

let latency = (summary: Summary) => `${ms(summary.p50)}/${ms(summary.p95)}/${ms(summary.p99)}`;

let laneRow = (label: string, step: StepResult, lane: LaneStepResult, target: number) =>
  [
    pad(String(step.step + 1), 4),
    pad(label, 8),
    pad(String(target), 8),
    pad(String(lane.offeredRecordsPerSecond), 9),
    pad(String(lane.achievedRecordsPerSecond), 9),
    pad(latency(lane.latencyFromScheduleMs), 16),
    pad(pct(lane.busyRate), 8),
    pad(String(lane.retriedDeliveries), 7),
    pad(String(lane.failedDeliveries), 6),
    pad(ms(lane.clientWaitMs.p95), 10)
  ].join(' ');

export let formatLoad = (d: {
  steps: StepResult[];
  knees: Knee[];
  ingestTasks: number;
  undelivered: number;
}) => {
  let lines = [
    'step     lane   target   offered  achieved  p50/p95/p99 ms     busy retried failed  client wait p95',
    '  (latency counts from the scheduled send time; achieved counts requests scheduled in the step)',
    ...d.steps.flatMap(step => [
      ...(step.live ? [laneRow('live', step, step.live, step.targetRecordsPerSecond)] : []),
      ...(step.backfill
        ? [laneRow('backfill', step, step.backfill, step.backfillRecordsPerSecond ?? 0)]
        : [])
    ]),
    ''
  ];

  for (let knee of d.knees) {
    lines.push(
      knee.knee
        ? `Knee (${knee.lane}): ${knee.knee.targetRecordsPerSecond} records/s target, ${knee.knee.achievedRecordsPerSecond} achieved; ${round(knee.knee.achievedRecordsPerSecond / d.ingestTasks, 0)} per ingest task with ${d.ingestTasks} task(s)`
        : `Knee (${knee.lane}): no step passed`
    );
    if (knee.firstFailure) {
      lines.push(
        `  first failing step ${knee.firstFailure.step + 1} (${knee.firstFailure.limitedBy == 'client' ? 'limited by the generator, not the service: the knee is at least this high' : 'limited by the service'}): ${knee.firstFailure.reasons.join('; ')}`
      );
    }
    if (knee.passedAfterFailure.length) {
      lines.push(
        `  steps passing after the first failure (noisy run?): ${knee.passedAfterFailure.map(step => step + 1).join(', ')}`
      );
    }
    lines.push(
      `  thresholds (assumptions, override with flags): p95 <= ${knee.thresholds.maxP95Ms} ms, p99 <= ${knee.thresholds.maxP99Ms} ms, client wait p95 <= ${knee.thresholds.maxClientWaitP95Ms} ms, busy <= ${pct(knee.thresholds.maxBusyRate)}, errors after retries <= ${pct(knee.thresholds.maxErrorRate)}, achieved >= ${Math.round(knee.thresholds.minAchievedRatio * 100)}% of target`
    );
  }

  let busy = d.steps.some(
    step => (step.live?.busyResponses ?? 0) + (step.backfill?.busyResponses ?? 0) > 0
  );
  let failed = d.steps.some(
    step => (step.live?.failedDeliveries ?? 0) + (step.backfill?.failedDeliveries ?? 0) > 0
  );

  lines.push(
    '',
    `Retry signal: ${busy ? 'the service answered busy' : 'no busy answers'}; ${failed ? 'some requests still failed after retries' : 'every request was delivered after honouring Retry-After'}${d.undelivered ? `; ${d.undelivered} requests were still in flight at the end` : ''}`
  );

  return lines.join('\n');
};

export let formatDryRun = (report: DryRunReport) =>
  [
    `Dry run: ${report.ok ? 'OK' : 'FAILED'}`,
    `  live: ${report.live.requests} requests, ${report.live.records} records sent, ${report.live.stored} stored`,
    ...Object.entries(report.live.byType).map(
      ([type, counts]) => `    ${type}: ${counts.expected} sent, ${counts.stored} stored`
    ),
    `  tokens stored: ${Object.entries(report.live.tokens.stored)
      .map(([key, value]) => `${key} ${value}`)
      .join(', ')}`,
    `  cost stored: $${report.live.costUsd.stored.toFixed(6)} (sent $${report.live.costUsd.expected.toFixed(6)})`,
    `  backfill: ${report.backfill.items} items, ${report.backfill.accepted} accepted, ${report.backfill.stored} stored`,
    `  body bytes p50/p95: ${ms(report.live.bodyBytes.p50)}/${ms(report.live.bodyBytes.p95)}; stored document bytes mean ${ms(report.documentBytes.all.mean)}`,
    `  in process: ${report.inProcess.recordsPerSecond} records/s (${report.inProcess.note})`,
    ...report.problems.map(problem => `  problem: ${problem}`)
  ].join('\n');

export let formatBenchmark = (report: BenchmarkReport) => {
  let lines = [
    `Query benchmark: ${report.organizations} organization(s), ${report.repeats} warm repeats per query; data anchored ${report.anchor} (${report.ageDays} days ago)`,
    `Pacing: ${report.pacing}`,
    '',
    'query                                 cold p50/p95   warm p50/p95/p99   server p95   budget  result',
    ...report.queries.map(query =>
      [
        query.name.padEnd(36),
        pad(`${ms(query.coldMs.p50)}/${ms(query.coldMs.p95)}`, 14),
        pad(latency(query.warmMs), 18),
        pad(ms(query.serverWarmMs.p95), 12),
        pad(query.budgetP95Ms ? `${query.budgetP95Ms}` : '-', 8),
        pad(
          query.errors.count
            ? `${query.errors.count} errors`
            : query.rateLimited
              ? `${query.rateLimited} 429s`
              : query.pass === null
                ? '-'
                : query.pass
                  ? 'pass'
                  : 'FAIL',
          8
        )
      ].join(' ')
    ),
    '',
    `Budgets (doc 11 §15): ${report.pass ? 'all within budget' : 'NOT all within budget'}`
  ];

  return lines.join('\n');
};

export let formatExplain = (results: ExplainResult[]) =>
  [
    'shape                                          index                                                sort  keys    docs  returned',
    ...results.map(result =>
      [
        result.name.padEnd(46),
        (result.indexes.join(',') || (result.collectionScan ? 'COLLSCAN' : '-')).padEnd(52),
        pad(result.blockingSort ? 'SORT' : 'no', 5),
        pad(String(result.keysExamined ?? '-'), 6),
        pad(String(result.docsExamined ?? '-'), 7),
        pad(String(result.returned ?? '-'), 9)
      ].join(' ')
    )
  ].join('\n');

export let formatProbe = (report: ProbeReport) =>
  [
    `Freshness probe: ${report.pass ? 'within budget' : 'NOT within budget'} over ${report.samples.length} samples`,
    `  listed:     p50 ${ms(report.listedMs.p50)} ms, max ${ms(report.listedMs.max)} ms (budget ${report.budgets.listedMs} ms)`,
    `  summarized: p50 ${ms(report.summarizedMs.p50)} ms, max ${ms(report.summarizedMs.max)} ms (budget ${report.budgets.summarizedMs} ms)`,
    `  queryable:  p50 ${ms(report.queryableMs.p50)} ms, max ${ms(report.queryableMs.max)} ms (budget ${report.budgets.queryableMs} ms)`,
    ...report.samples
      .filter(sample => sample.sentStatus != 200)
      .map(sample => `  sample ${sample.sample}: ingest answered ${sample.sentStatus}`),
    `  ${report.note}`
  ].join('\n');
