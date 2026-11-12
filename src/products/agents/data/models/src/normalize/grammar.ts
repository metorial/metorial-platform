import { titleCase } from '../lib/util';
import {
  getLabProfile,
  globalCasing,
  globalModifiers,
  globalTiers
} from '../registry/labProfiles';
import type { ModelSize } from '../types';
import { extractTrailingDate } from './parseName';

let sizePattern = /^(e?\d+(?:\.\d+)?[bmkt]|a\d+(?:\.\d+)?b|\d+x\d+(?:\.\d+)?b|\d+e)$/;
let dateTokenPattern = /^(\d{4}|\d{6}|\d{8})$/;
let versionPattern = /^([a-z])?(\d+(?:\.\d+)*)([a-z])?$/;
let gluedPattern = /^([a-z]+?)(\d+(?:\.\d+)*[a-z]?)$/;

let modifierSet = new Set(globalModifiers);

export interface ModelGrammar {
  series: string;
  line: string | null;
  version: string | null;
  versionSort: number[];
  size: ModelSize | null;
  modifiers: string[];
  date: string | null;
}

let unitScale: Record<string, number> = { k: 1e3, m: 1e6, b: 1e9, t: 1e12 };

export let parseSize = (tokens: string[]): ModelSize | null => {
  if (!tokens.length) return null;

  let totalParams: number | null = null;
  let activeParams: number | null = null;

  for (let token of tokens) {
    let moe = token.match(/^(\d+)x(\d+(?:\.\d+)?)b$/);
    let active = token.match(/^a(\d+(?:\.\d+)?)b$/);
    let total = token.match(/^(\d+(?:\.\d+)?)([bmkt])$/);

    if (moe) totalParams = totalParams ?? Number(moe[1]) * Number(moe[2]) * 1e9;
    else if (active) activeParams = activeParams ?? Number(active[1]) * 1e9;
    else if (total) totalParams = totalParams ?? Number(total[1]) * unitScale[total[2]!]!;
  }

  return { totalParams, activeParams, label: tokens.join('-') };
};

export let versionSortOf = (version: string | null) => {
  let match = version?.match(/\d+(?:\.\d+)*/);
  return match ? match[0].split('.').map(Number) : [];
};

let mergeMultiwordTiers = (tokens: string[], multiword: string[][]) => {
  let result: string[] = [];

  for (let i = 0; i < tokens.length; i++) {
    let hit = multiword.find(parts => parts.every((part, j) => tokens[i + j] === part));
    if (hit) {
      result.push(hit.join('-'));
      i += hit.length - 1;
    } else result.push(tokens[i]!);
  }

  return result;
};

export let parseModelSlug = (slug: string, labId: string): ModelGrammar => {
  let profile = getLabProfile(labId);
  let tiers = new Set([...globalTiers, ...profile.tiers]);
  let multiword = [...tiers].filter(tier => tier.includes('-')).map(tier => tier.split('-'));

  let trailing = extractTrailingDate(slug);
  let stem = trailing?.stem ?? slug;
  let tokens = mergeMultiwordTiers(stem.split('-').filter(Boolean), multiword);

  let series: string[] = [];
  let sizes: string[] = [];
  let modifiers: string[] = [];
  let version: string | null = null;
  let date = trailing?.date ?? null;

  for (let [i, token] of tokens.entries()) {
    let glued = i === 0 && !sizePattern.test(token) ? token.match(gluedPattern) : null;
    let versioned = token.match(versionPattern);

    if (glued && !tiers.has(token)) {
      series.push(glued[1]!);
      version = glued[2]!;
    } else if (
      !version &&
      versioned &&
      !sizePattern.test(token) &&
      !dateTokenPattern.test(token)
    ) {
      let [, prefix, digits, suffix] = versioned;

      if (prefix && prefix !== 'v' && !series.length) {
        series.push(token);
        continue;
      }

      if (prefix && profile.letterSeries) series.push(prefix);

      if (suffix && profile.versionLetterTiers.includes(suffix)) {
        version = prefix && prefix !== 'v' ? `${prefix}${digits}` : digits!;
        series.push(suffix);
      } else {
        version =
          prefix && prefix !== 'v' && !profile.letterSeries
            ? token
            : `${digits}${suffix ?? ''}`;
      }
    } else if (sizePattern.test(token)) sizes.push(token);
    else if (tiers.has(token)) series.push(token);
    else if (modifierSet.has(token)) modifiers.push(token);
    else if (dateTokenPattern.test(token)) date = date ?? token;
    else if (version && /^v?\d+(\.\d+)*$/.test(token)) modifiers.push(token);
    else series.push(token);
  }

  let seriesSlug = series.join('-') || stem;

  return {
    series: seriesSlug,
    line: series[0] ?? null,
    version,
    versionSort: versionSortOf(version),
    size: parseSize(sizes),
    modifiers,
    date
  };
};

export let familyDisplayName = (series: string, labId: string) => {
  let profile = getLabProfile(labId);
  return (
    profile.familyNames[series] ?? titleCase(series, { ...globalCasing, ...profile.casing })
  );
};
