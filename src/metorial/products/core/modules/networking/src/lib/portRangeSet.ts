export type PortRange = {
  from: number;
  to: number;
};

export let fullPortRange = (): PortRange => ({ from: 1, to: 65535 });

let normalizePortRanges = (ranges: PortRange[]) => {
  if (ranges.length === 0) return [];

  let sorted = [...ranges].sort((a, b) => a.from - b.from || a.to - b.to);
  let merged: PortRange[] = [{ ...sorted[0]! }];

  for (let i = 1; i < sorted.length; i++) {
    let current = sorted[i]!;
    let last = merged[merged.length - 1]!;

    if (current.from <= last.to + 1) {
      last.to = Math.max(last.to, current.to);
      continue;
    }

    merged.push({ ...current });
  }

  return merged;
};

let subtractPortRange = (base: PortRange, remove: PortRange): PortRange[] => {
  if (remove.to < base.from || remove.from > base.to) return [{ ...base }];

  let result: PortRange[] = [];

  if (base.from < remove.from) {
    result.push({ from: base.from, to: remove.from - 1 });
  }

  if (base.to > remove.to) {
    result.push({ from: remove.to + 1, to: base.to });
  }

  return result;
};

let intersectPortRange = (a: PortRange, b: PortRange): PortRange | null => {
  let from = Math.max(a.from, b.from);
  let to = Math.min(a.to, b.to);

  if (from > to) return null;
  return { from, to };
};

export let portRangeSetUnion = (ranges: PortRange[]) => normalizePortRanges(ranges);

export let portRangeSetSubtract = (base: PortRange[], remove: PortRange[]) => {
  let result = normalizePortRanges(base);

  for (let removeRange of normalizePortRanges(remove)) {
    result = result.flatMap(range => subtractPortRange(range, removeRange));
  }

  return normalizePortRanges(result);
};

export let portRangeSetIntersect = (a: PortRange[], b: PortRange[]) => {
  let result: PortRange[] = [];

  for (let left of normalizePortRanges(a)) {
    for (let right of normalizePortRanges(b)) {
      let overlap = intersectPortRange(left, right);
      if (overlap) result.push(overlap);
    }
  }

  return normalizePortRanges(result);
};

export let portRangeSetIsEmpty = (ranges: PortRange[]) => ranges.length === 0;

export let portRangeSetEqualsUniverse = (ranges: PortRange[]) => {
  let normalized = normalizePortRanges(ranges);
  return normalized.length === 1 && normalized[0]!.from === 1 && normalized[0]!.to === 65535;
};

export let portRangeSetNormalize = (ranges: PortRange[]) => normalizePortRanges(ranges);
