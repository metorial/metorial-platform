import { GOOD_SCORE, MIN_IMAGE_SIDE } from './limits';

export type RankableCandidate = Pick<
  PrismaJson.WebImageCandidate,
  'source' | 'format' | 'width' | 'height' | 'declaredWidth' | 'declaredHeight'
>;

export type ScoreResult =
  | { score: number; rejectedReason: null }
  | { score: null; rejectedReason: string };

let sourceWeights: Record<PrismaJson.WebImageCandidate['source'], number> = {
  svg_icon: 40,
  apple_touch_icon: 38,
  manifest_icon: 36,
  jsonld_logo: 32,
  icon: 28,
  well_known: 22,
  mask_icon: 10,
  og_image: 12,
  twitter_image: 12
};

let formatPoints: Record<NonNullable<PrismaJson.WebImageCandidate['format']>, number> = {
  svg: 10,
  png: 8,
  webp: 7,
  jpeg: 4,
  gif: 3,
  ico: 2
};

let unknownFormatPoints = 5;
let unknownSizePoints = 10;
let unknownSquarenessPoints = 10;
let specificityBonusMax = 3;

let sizePoints = (shortestSide: number) => {
  if (shortestSide >= 256) return 30;
  if (shortestSide >= 128) return 26;
  if (shortestSide >= 96) return 20;
  if (shortestSide >= 64) return 14;
  if (shortestSide >= 48) return 8;
  return 3;
};

let squarenessPoints = (ratio: number) => {
  if (ratio >= 0.9) return 20;
  if (ratio >= 0.85) return 14;
  if (ratio >= 0.6) return 4;
  return 0;
};

export let scoreCandidate = (c: RankableCandidate): ScoreResult => {
  let width = c.width ?? c.declaredWidth;
  let height = c.height ?? c.declaredHeight;
  let isVector = c.format == 'svg' || c.source == 'svg_icon';
  let hasSize = width !== null && height !== null;

  if (hasSize && !isVector && Math.min(width!, height!) < MIN_IMAGE_SIDE) {
    return { score: null, rejectedReason: 'too_small' };
  }

  let size = isVector
    ? 30
    : hasSize
      ? sizePoints(Math.min(width!, height!))
      : unknownSizePoints;

  let squareness = hasSize
    ? squarenessPoints(Math.min(width!, height!) / Math.max(width!, height!))
    : isVector
      ? 20
      : unknownSquarenessPoints;

  let format = c.format ? formatPoints[c.format] : unknownFormatPoints;

  return { score: sourceWeights[c.source] + size + squareness + format, rejectedReason: null };
};

export let specificityBonus = (pageIndex: number) =>
  Math.max(0, specificityBonusMax - pageIndex);

export let isGoodScore = (score: number) => score >= GOOD_SCORE;

export type RankedCandidate = {
  pageIndex: number;
  candidate: PrismaJson.WebImageCandidate;
};

export let pickBestCandidate = <T extends RankedCandidate>(entries: T[]) => {
  let best: T | null = null;
  let bestRank = -Infinity;

  for (let entry of entries) {
    if (entry.candidate.score === null || entry.candidate.rejectedReason) continue;
    if (entry.candidate.format === null) continue;

    let rank = entry.candidate.score + specificityBonus(entry.pageIndex);
    if (rank > bestRank) {
      best = entry;
      bestRank = rank;
    }
  }

  return best;
};
