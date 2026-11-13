import type { BuildResult } from './build';

export let maxRepricedShare = 0.1;
export let maxLiveOfferingDrop = 0.1;
export let maxNewPriceOutliers = 50;

export type GateCheckId =
  'previous-catalog' | 'repriced-offerings' | 'live-offering-drop' | 'new-price-outliers';

export interface GateCheck {
  id: GateCheckId;
  label: string;
  unit: 'presence' | 'share' | 'count';
  value: number | null;
  threshold: number;
  detail: string;
  passed: boolean;
  overridden: boolean;
}

export interface DeployGate {
  checks: GateCheck[];
  passed: boolean;
  allowUnsafe: boolean;
  deploy: boolean;
}

type GateInput = Pick<BuildResult, 'diff' | 'newPriceOutliers'>;

interface Comparison {
  id: GateCheckId;
  label: string;
  unit: 'share' | 'count';
  threshold: number;
  measure: (input: GateInput) => { value: number; detail: string };
}

let share = (part: number, total: number) => (total ? part / total : 0);

let comparisons: Comparison[] = [
  {
    id: 'repriced-offerings',
    label: 'Priced offerings with changed text rates',
    unit: 'share',
    threshold: maxRepricedShare,
    measure: ({ diff }) => ({
      value: share(diff.repricedOfferings, diff.previousPricedOfferings),
      detail: `${diff.repricedOfferings} of ${diff.previousPricedOfferings}`
    })
  },
  {
    id: 'live-offering-drop',
    label: 'Drop in live offerings',
    unit: 'share',
    threshold: maxLiveOfferingDrop,
    measure: ({ diff }) => ({
      value: share(
        Math.max(0, diff.previousLiveOfferings - diff.liveOfferings),
        diff.previousLiveOfferings
      ),
      detail: `${diff.previousLiveOfferings} → ${diff.liveOfferings}`
    })
  },
  {
    id: 'new-price-outliers',
    label: 'New price outliers',
    unit: 'count',
    threshold: maxNewPriceOutliers,
    measure: ({ newPriceOutliers }) => ({
      value: newPriceOutliers.length,
      detail: `${newPriceOutliers.length} not in the previous catalog`
    })
  }
];

export let evaluateDeployGate = (
  input: GateInput,
  opts: { allowUnsafe: boolean }
): DeployGate => {
  let { hasPrevious, previousLiveOfferings } = input.diff;

  let checks: Omit<GateCheck, 'overridden'>[] = [
    {
      id: 'previous-catalog',
      label: 'Previous catalog',
      unit: 'presence',
      value: hasPrevious ? 1 : 0,
      threshold: 1,
      detail: hasPrevious
        ? `${previousLiveOfferings} live offerings`
        : 'not in the Actions cache or on the live site',
      passed: hasPrevious
    },
    ...comparisons.map(({ measure, ...check }) => {
      if (!hasPrevious)
        return { ...check, value: null, detail: 'nothing to compare with', passed: true };

      let { value, detail } = measure(input);
      return { ...check, value, detail, passed: value <= check.threshold };
    })
  ];

  let passed = checks.every(check => check.passed);

  return {
    checks: checks.map(check => ({ ...check, overridden: !check.passed && opts.allowUnsafe })),
    passed,
    allowUnsafe: opts.allowUnsafe,
    deploy: passed || opts.allowUnsafe
  };
};
