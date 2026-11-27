import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { activeRuleset, getFamilyDefinition } from '../../definitions/rulesets';
import { benignSamples } from './__corpus__/benign';
import { maliciousSamples, type CorpusSample } from './__corpus__/malicious';
import { scanPayloadSync } from './scan';

let BASELINE_PATH = join(__dirname, '__corpus__', 'baseline.json');

interface SampleResult {
  families: string[];
  alerting: string[];
}

interface Baseline {
  metrics: Record<string, number>;
  samples: Record<string, SampleResult>;
}

let runSample = (sample: CorpusSample): SampleResult => {
  let { findings } = scanPayloadSync({
    ruleset: activeRuleset,
    payload: sample.payload,
    context: sample.context
  });
  let active = findings.filter(finding => finding.stage == 'active');

  let alerting = active.filter(
    finding =>
      finding.precision >= (getFamilyDefinition(finding.family)?.alertConfidenceThreshold ?? 1)
  );

  return {
    families: [...new Set(active.map(finding => finding.family))].sort(),
    alerting: [...new Set(alerting.map(finding => finding.family))].sort()
  };
};

let round = (value: number) => Math.round(value * 1000) / 1000;

let ratio = (numerator: number, denominator: number) =>
  denominator ? round(numerator / denominator) : 1;

// Detection counts any active finding of an intended family; alerting only counts findings at or
// above the family's alert threshold, which low-precision families never reach on their own.
let computeMetrics = (results: Record<string, SampleResult>) => {
  let malicious = maliciousSamples.map(sample => ({ sample, result: results[sample.id]! }));
  let benign = benignSamples.map(sample => results[sample.id]!);

  let detected = malicious.filter(({ sample, result }) =>
    sample.families!.some(family => result.families.includes(family))
  ).length;
  let alerted = malicious.filter(({ sample, result }) =>
    sample.families!.some(family => result.alerting.includes(family))
  ).length;

  let benignDetected = benign.filter(result => result.families.length).length;
  let benignAlerted = benign.filter(result => result.alerting.length).length;

  return {
    maliciousSamples: malicious.length,
    benignSamples: benign.length,
    detectionRecall: ratio(detected, malicious.length),
    detectionPrecision: ratio(detected, detected + benignDetected),
    alertRecall: ratio(alerted, malicious.length),
    alertPrecision: ratio(alerted, alerted + benignAlerted),
    benignDetectionRate: ratio(benignDetected, benign.length),
    benignAlertRate: ratio(benignAlerted, benign.length)
  };
};

describe('corpus', () => {
  let samples = [...maliciousSamples, ...benignSamples];
  let results = Object.fromEntries(samples.map(sample => [sample.id, runSample(sample)]));
  let current: Baseline = { metrics: computeMetrics(results), samples: results };

  if (process.env.UPDATE_PROTOGUARD_BASELINE == '1') {
    writeFileSync(BASELINE_PATH, `${JSON.stringify(current, null, 2)}\n`);
  }

  it('has unique sample ids', () => {
    expect(new Set(samples.map(sample => sample.id)).size).toBe(samples.length);
  });

  it('covers every scan-driven family in the active ruleset with three samples', () => {
    let scanFamilies = new Set(activeRuleset.rules.map(rule => rule.family));

    for (let family of scanFamilies) {
      let count = maliciousSamples.filter(sample => sample.families?.includes(family)).length;
      expect(count, family).toBeGreaterThanOrEqual(3);
    }
  });

  it('matches the baseline exactly', () => {
    let baseline = JSON.parse(readFileSync(BASELINE_PATH, 'utf8')) as Baseline;
    expect(current).toEqual(baseline);
  });
});
