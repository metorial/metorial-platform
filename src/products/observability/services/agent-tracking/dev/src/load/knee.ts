import type { Lane, LaneStepResult, StepResult } from './run';

// None of these is set by the design docs ("Performance and scale": thresholds the docs do not
// give are set from the baseline). They are starting assumptions to override with flags.
export let defaultKneeThresholds = {
  maxP95Ms: 1_000,
  maxP99Ms: 2_500,
  maxClientWaitP95Ms: 100,
  maxBusyRate: 0.01,
  maxErrorRate: 0,
  minAchievedRatio: 0.95
};

type KneeThresholds = typeof defaultKneeThresholds;

type StepVerdict = {
  step: number;
  targetRecordsPerSecond: number;
  pass: boolean;
  limitedBy: 'client' | 'service' | null;
  reasons: string[];
};

export type Knee = {
  lane: Lane;
  thresholds: KneeThresholds;
  verdicts: StepVerdict[];
  knee: {
    step: number;
    targetRecordsPerSecond: number;
    achievedRecordsPerSecond: number;
  } | null;
  firstFailure: StepVerdict | null;
  passedAfterFailure: number[];
};

let laneOf = (step: StepResult, lane: Lane): LaneStepResult | null =>
  lane == 'live' ? step.live : step.backfill;

let targetOf = (step: StepResult, lane: Lane) =>
  lane == 'live' ? step.targetRecordsPerSecond : (step.backfillRecordsPerSecond ?? 0);

let judgeStep = (step: StepResult, lane: Lane, thresholds: KneeThresholds): StepVerdict => {
  let result = laneOf(step, lane);
  let target = targetOf(step, lane);
  let clientReasons: string[] = [];
  let serviceReasons: string[] = [];

  if (!result || result.attempts == 0) {
    clientReasons.push('no requests were measured');
  } else {
    let p95 = result.latencyFromScheduleMs.p95 ?? Infinity;
    let p99 = result.latencyFromScheduleMs.p99 ?? Infinity;
    let wait = result.clientWaitMs.p95 ?? 0;

    // Latency counts from the slot the request was scheduled for, so time spent queued in the
    // generator is not hidden; when that queueing itself is large, the generator was the limit.
    if (wait > thresholds.maxClientWaitP95Ms) {
      clientReasons.push(
        `the generator could not keep the rate: client wait p95 ${Math.round(wait)} ms > ${thresholds.maxClientWaitP95Ms} ms (client-limited, not a service limit; raise --concurrency or --max-outstanding, or run more generators)`
      );
    }

    if (p95 > thresholds.maxP95Ms) {
      serviceReasons.push(`p95 ${Math.round(p95)} ms > ${thresholds.maxP95Ms} ms`);
    }
    if (p99 > thresholds.maxP99Ms) {
      serviceReasons.push(`p99 ${Math.round(p99)} ms > ${thresholds.maxP99Ms} ms`);
    }
    if (result.busyRate > thresholds.maxBusyRate) {
      serviceReasons.push(
        `busy rate ${(result.busyRate * 100).toFixed(2)}% > ${(thresholds.maxBusyRate * 100).toFixed(2)}%`
      );
    }
    if (result.errorRate > thresholds.maxErrorRate) {
      serviceReasons.push(`error rate ${(result.errorRate * 100).toFixed(2)}% after retries`);
    }
    if (result.achievedRecordsPerSecond < target * thresholds.minAchievedRatio) {
      serviceReasons.push(
        `achieved ${result.achievedRecordsPerSecond}/s < ${Math.round(thresholds.minAchievedRatio * 100)}% of ${target}/s`
      );
    }
  }

  let reasons = [...clientReasons, ...serviceReasons];

  return {
    step: step.step,
    targetRecordsPerSecond: target,
    pass: reasons.length == 0,
    limitedBy: clientReasons.length ? 'client' : serviceReasons.length ? 'service' : null,
    reasons
  };
};

// The knee is the last passing step before the first failing one. A step that passes again after
// a failure is reported but does not move the knee, since it usually means a noisy run.
export let findKnee = (
  steps: StepResult[],
  lane: Lane,
  thresholds: KneeThresholds = defaultKneeThresholds
): Knee => {
  let ordered = [...steps].sort((a, b) => targetOf(a, lane) - targetOf(b, lane));
  let verdicts = ordered.map(step => judgeStep(step, lane, thresholds));
  let failureIndex = verdicts.findIndex(verdict => !verdict.pass);
  let passing = failureIndex == -1 ? verdicts : verdicts.slice(0, failureIndex);
  let last = passing[passing.length - 1];
  let kneeStep = last ? ordered[verdicts.indexOf(last)] : undefined;

  return {
    lane,
    thresholds,
    verdicts,
    knee:
      last && kneeStep
        ? {
            step: last.step,
            targetRecordsPerSecond: last.targetRecordsPerSecond,
            achievedRecordsPerSecond: laneOf(kneeStep, lane)?.achievedRecordsPerSecond ?? 0
          }
        : null,
    firstFailure: failureIndex == -1 ? null : verdicts[failureIndex]!,
    passedAfterFailure:
      failureIndex == -1
        ? []
        : verdicts
            .slice(failureIndex + 1)
            .filter(verdict => verdict.pass)
            .map(verdict => verdict.step)
  };
};
