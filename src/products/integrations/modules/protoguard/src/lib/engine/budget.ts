import type { SizeTier } from './types';

export let TIER_S_MAX_CHARS = 256 * 1024;
export let TIER_M_MAX_CHARS = 4 * 1024 * 1024;
export let TIER_L_MAX_CHARS = 32 * 1024 * 1024;

export let WINDOW_CHARS = 16 * 1024;
export let WINDOW_OVERLAP_CHARS = 512;

export let L_EXPENSIVE_EDGE_CHARS = 1024 * 1024;
export let XL_SCANNED_EDGE_CHARS = 4 * 1024 * 1024;
export let STRATIFIED_SAMPLE_COUNT = 32;

export let TIME_BUDGET_MS: Record<SizeTier, number> = {
  S: 250,
  M: 250,
  L: 1000,
  XL: 1000
};

export let MAX_MATCHES_PER_RULE_PER_WINDOW = 8;
export let MAX_FINDINGS = 500;
export let MAX_SEGMENTS = 100_000;
export let MAX_DEPTH = 64;

export let BINARY_BASE64_MIN_CHARS = 64 * 1024;

export let DECODE_MAX_DEPTH = 2;
export let DECODE_BUDGET_CHARS_PER_WINDOW = 64 * 1024;
export let DECODE_MIN_CANDIDATE_CHARS = 24;
export let DECODE_MAX_CANDIDATE_CHARS = 64 * 1024;

export let MATCHED_TEXT_MAX_CHARS = 2000;
export let CONTEXT_CHARS = 200;

export let getSizeTier = (totalChars: number): SizeTier => {
  if (totalChars <= TIER_S_MAX_CHARS) return 'S';
  if (totalChars <= TIER_M_MAX_CHARS) return 'M';
  if (totalChars <= TIER_L_MAX_CHARS) return 'L';
  return 'XL';
};

let getStratifiedPoints = (totalChars: number) => {
  let points: number[] = [];
  let step = totalChars / (STRATIFIED_SAMPLE_COUNT + 1);

  for (let i = 1; i <= STRATIFIED_SAMPLE_COUNT; i++) {
    points.push(Math.floor(step * i));
  }

  return points;
};

let overlapsRange = (start: number, end: number, rangeStart: number, rangeEnd: number) =>
  start < rangeEnd && end > rangeStart;

let containsStratifiedPoint = (start: number, end: number, points: number[]) =>
  points.some(point => point >= start && point < end);

export interface WindowPlan {
  start: number;
  end: number;
  ownedEnd: number;
  runExpensive: boolean;
}

export interface SegmentWindowPlan {
  windows: WindowPlan[];
  plannedChars: number;
}

// Windows are planned against the virtual concatenation of all text segments so that head/tail
// and stratified sampling are stable for the payload as a whole, not per string.
export let planSegmentWindows = (d: {
  segmentLength: number;
  globalOffset: number;
  totalChars: number;
  tier: SizeTier;
}): SegmentWindowPlan => {
  let windows: WindowPlan[] = [];
  let points = d.tier == 'L' || d.tier == 'XL' ? getStratifiedPoints(d.totalChars) : [];
  let plannedChars = 0;

  if (d.segmentLength == 0) return { windows, plannedChars };

  let stride = WINDOW_CHARS - WINDOW_OVERLAP_CHARS;

  for (let start = 0; start < d.segmentLength; start += stride) {
    let end = Math.min(start + WINDOW_CHARS, d.segmentLength);
    let isLast = end == d.segmentLength;

    // XL skips windows, so a match starting in the overlap may have no following window to own it.
    let ownedEnd = isLast || d.tier == 'XL' ? end : start + stride;

    let globalStart = d.globalOffset + start;
    let globalEnd = d.globalOffset + end;

    let edgeChars = d.tier == 'XL' ? XL_SCANNED_EDGE_CHARS : L_EXPENSIVE_EDGE_CHARS;
    let isEdge =
      overlapsRange(globalStart, globalEnd, 0, edgeChars) ||
      overlapsRange(globalStart, globalEnd, d.totalChars - edgeChars, d.totalChars);
    let isSampled = isEdge || containsStratifiedPoint(globalStart, globalEnd, points);

    if (d.tier == 'XL' && !isSampled) {
      if (isLast) break;
      continue;
    }

    let runExpensive = d.tier == 'S' || d.tier == 'M' ? true : isSampled;

    windows.push({ start, end, ownedEnd, runExpensive });
    plannedChars += (isLast ? end : Math.min(end, start + stride)) - start;

    if (isLast) break;
  }

  return { windows, plannedChars };
};
