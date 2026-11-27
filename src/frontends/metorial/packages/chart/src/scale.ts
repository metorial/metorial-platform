let niceMultipliers = [1, 2, 2.5, 5, 10];

let epsilon = 1e-9;

let extraIntervalsAllowed = 1;

export type ChartScale = {
  min: number;
  max: number;
  tickAmount: number;
};

let getStepCandidates = (rawStep: number) => {
  let magnitude = 10 ** Math.floor(Math.log10(rawStep));

  return [magnitude / 10, magnitude, magnitude * 10]
    .flatMap(base => niceMultipliers.map(multiplier => multiplier * base))
    .sort((a, b) => a - b);
};

let getBinaryUnit = (range: number) => {
  if (range < 1024) return 1;
  return 1024 ** Math.floor(Math.log(range) / Math.log(1024));
};

let roundStep = (value: number) => Number(value.toPrecision(12));

let fitStep = (min: number, max: number, step: number) => {
  let niceMin = roundStep(Math.floor(min / step + epsilon) * step);
  let niceMax = roundStep(Math.ceil(max / step - epsilon) * step);

  return {
    min: niceMin,
    max: niceMax,
    span: niceMax - niceMin,
    intervals: Math.max(Math.round((niceMax - niceMin) / step), 1)
  };
};

export let getNiceScale = (
  dataMin: number,
  dataMax: number,
  opts: { tickCount?: number; binary?: boolean; includeZero?: boolean } = {}
): ChartScale => {
  let tickCount = Math.max(opts.tickCount ?? 4, 1);

  if (!Number.isFinite(dataMin) || !Number.isFinite(dataMax)) {
    return { min: 0, max: 1, tickAmount: tickCount };
  }

  let includeZero = opts.includeZero ?? true;
  let min = includeZero ? Math.min(dataMin, 0) : dataMin;
  let max = includeZero ? Math.max(dataMax, 0) : dataMax;
  if (max == min) max = min + 1;

  let unit = opts.binary ? getBinaryUnit(max - min) : 1;
  let scaledMin = min / unit;
  let scaledMax = max / unit;

  let rawStep = (scaledMax - scaledMin) / tickCount;
  let candidates = getStepCandidates(rawStep);
  let upperIndex = Math.max(
    candidates.findIndex(candidate => candidate >= rawStep * (1 - epsilon)),
    0
  );

  let upper = fitStep(scaledMin, scaledMax, candidates[upperIndex]);
  let lower =
    upperIndex > 0 ? fitStep(scaledMin, scaledMax, candidates[upperIndex - 1]) : undefined;

  let fits =
    !!lower &&
    lower.intervals <= tickCount + extraIntervalsAllowed &&
    lower.span < upper.span - epsilon;
  let best = fits && lower ? lower : upper;

  return {
    min: best.min * unit,
    max: best.max * unit,
    tickAmount: best.intervals
  };
};
