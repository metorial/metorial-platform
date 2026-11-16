import type { DatePrecision, OfferingVariant, ParsedName } from '../types';

let earliestYear = 2019;
let latestYear = new Date().getUTCFullYear() + 1;

let bedrockRegions = ['us-gov', 'global', 'apac', 'us', 'eu', 'au', 'jp', 'ca'];

let wrapperPrefixes: [RegExp, string][] = [
  [/^@cf\//, '@cf/'],
  [/^accounts\/[^/]+\/(models|routers|deployedModels)\//, 'fireworks-accounts'],
  [/^models\//, 'models/'],
  [/^~/, '~']
];

let colonServing = new Set([
  'batch',
  'flex',
  'priority',
  'nitro',
  'exacto',
  'floor',
  'online',
  'extended',
  'beta',
  'fast'
]);

let quantizations = [
  'nvfp4',
  'mxfp4',
  'fp8',
  'fp4',
  'fp16',
  'bf16',
  'int8',
  'int4',
  'awq',
  'gguf',
  'mlx',
  'w8a8',
  'w4a16',
  '4bit',
  '8bit'
];

export interface VariantSuffixRule {
  suffix: string;
  variant: Partial<OfferingVariant>;
}

let globalVariantSuffixes: VariantSuffixRule[] = [
  { suffix: '-free', variant: { free: true } },
  { suffix: '-highspeed', variant: { serving: 'highspeed' } },
  { suffix: '-ultraspeed', variant: { serving: 'ultraspeed' } },
  { suffix: '-ultrafast', variant: { serving: 'ultrafast' } },
  { suffix: '-lightning', variant: { serving: 'lightning' } },
  { suffix: '-batch', variant: { serving: 'batch' } }
];

export interface ParseNameOptions {
  labHint?: string | null;
  stripDate?: boolean;
  resolveOrg?: (alias: string) => string | null;
  labVariantSuffixes?: (labId: string) => VariantSuffixRule[];
}

export let emptyVariant = (): OfferingVariant => ({
  serving: null,
  reasoning: null,
  quantization: null,
  free: false,
  region: null
});

export let normalizeKey = (value: string) =>
  value
    .toLowerCase()
    .replace(/[._\s:+]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

let validMonth = (m: number) => m >= 1 && m <= 12;
let validDay = (d: number) => d >= 1 && d <= 31;
let validYear = (y: number) => y >= earliestYear && y <= latestYear;
let pad = (n: number) => String(n).padStart(2, '0');

interface ExtractedDate {
  stem: string;
  date: string;
  precision: DatePrecision;
}

export let extractTrailingDate = (stem: string): ExtractedDate | null => {
  let match: RegExpMatchArray | null;

  if ((match = stem.match(/^(.+?)[-@_](\d{4})-(\d{2})-(\d{2})$/))) {
    let [y, m, d] = [Number(match[2]), Number(match[3]), Number(match[4])];
    if (validYear(y) && validMonth(m) && validDay(d))
      return { stem: match[1]!, date: `${y}-${pad(m)}-${pad(d)}`, precision: 'day' };
  }

  if ((match = stem.match(/^(.+?)[-@_](\d{4})(\d{2})(\d{2})$/))) {
    let [y, m, d] = [Number(match[2]), Number(match[3]), Number(match[4])];
    if (validYear(y) && validMonth(m) && validDay(d))
      return { stem: match[1]!, date: `${y}-${pad(m)}-${pad(d)}`, precision: 'day' };
  }

  if ((match = stem.match(/^(.+?)-(\d{2})-(\d{4})$/))) {
    let [m, y] = [Number(match[2]), Number(match[3])];
    if (validYear(y) && validMonth(m))
      return { stem: match[1]!, date: `${y}-${pad(m)}`, precision: 'month' };
  }

  if ((match = stem.match(/^(.+?)-(\d{2})-(\d{2})$/)) && !/-\d$/.test(match[1]!)) {
    let [m, d] = [Number(match[2]), Number(match[3])];
    if (validMonth(m) && validDay(d))
      return { stem: match[1]!, date: `${pad(m)}-${pad(d)}`, precision: 'month-day' };
  }

  if ((match = stem.match(/^(.+?)-(\d{2})(\d{2})(\d{2})$/))) {
    let [y, m, d] = [2000 + Number(match[2]), Number(match[3]), Number(match[4])];
    if (validYear(y) && validMonth(m) && validDay(d))
      return { stem: match[1]!, date: `${y}-${pad(m)}-${pad(d)}`, precision: 'day' };
  }

  // Four digits are ambiguous: YYMM (Mistral 2512, Qwen 2507) or MMDD (DeepSeek 0324, Kimi 0905).
  // A plausible model-era year wins; otherwise fall back to month-day.
  if ((match = stem.match(/^(.+?)-(\d{2})(\d{2})$/))) {
    let [a, b] = [Number(match[2]), Number(match[3])];
    if (validYear(2000 + a) && a >= 23 && validMonth(b))
      return { stem: match[1]!, date: `${2000 + a}-${pad(b)}`, precision: 'month' };
    if (validMonth(a) && validDay(b))
      return { stem: match[1]!, date: `${pad(a)}-${pad(b)}`, precision: 'month-day' };
  }

  return null;
};

export let parseName = (raw: string, opts: ParseNameOptions = {}): ParsedName => {
  let variant = emptyVariant();
  let wrapper: string | null = null;
  let region: string | null = null;
  let revision: string | null = null;
  let labHint: string | null = opts.labHint ?? null;
  let date: string | null = null;
  let datePrecision: DatePrecision | null = null;
  let isLatest = false;

  let s = raw.trim();

  for (let [pattern, label] of wrapperPrefixes) {
    if (pattern.test(s)) {
      wrapper = wrapper ?? label;
      s = s.replace(pattern, '');
    }
  }

  let segments = s.split('/');
  let name = segments.pop()!;
  for (let namespace of segments.reverse()) {
    if (labHint) break;
    let org = opts.resolveOrg?.(namespace.toLowerCase()) ?? null;
    if (org) {
      labHint = org;
      break;
    }
  }

  let changed = true;
  while (changed) {
    changed = false;

    let colon = name.match(/^(.+):([a-z0-9-]+)$/i);
    if (colon && !/^\d+$/.test(colon[2]!)) {
      let tag = colon[2]!.toLowerCase();
      if (tag === 'free') variant.free = true;
      else if (tag === 'thinking') variant.reasoning = 'on';
      else if (colonServing.has(tag)) variant.serving = variant.serving ?? tag;
      else variant.serving = variant.serving ?? tag;
      name = colon[1]!;
      changed = true;
      continue;
    }

    let at = name.match(/^(.+)@([a-z0-9-]+)$/i);
    if (at) {
      let tag = at[2]!.toLowerCase();
      if (/^\d{8}$/.test(tag)) name = `${at[1]}-${tag}`;
      else {
        if (tag === 'latest') isLatest = true;
        else if (tag !== 'default') region = region ?? tag;
        name = at[1]!;
      }
      changed = true;
    }
  }

  let lower = name.toLowerCase();

  let bedrock = lower.match(/^(?:([a-z-]+)\.)?([a-z0-9-]+)\.(.+)$/);
  if (bedrock) {
    let [, prefix, namespace, rest] = bedrock;
    let regionOk = !prefix || bedrockRegions.includes(prefix);
    let org = opts.resolveOrg?.(namespace!) ?? null;
    if (regionOk && org && /^[a-z]/.test(rest!)) {
      region = region ?? prefix ?? null;
      labHint = labHint ?? org;
      wrapper = wrapper ?? 'bedrock';
      lower = rest!;

      let rev = lower.match(/^(.+)-(v\d+(?::\d+)?)$/);
      if (rev) {
        revision = rev[2]!;
        lower = rev[1]!;
      }
    }
  }

  let colonRev = lower.match(/^(.+)-(v\d+:\d+)$/);
  if (colonRev) {
    revision = revision ?? colonRev[2]!;
    lower = colonRev[1]!;
  }

  let numberedRev = lower.match(/^(.+)-(0\d\d)$/);
  if (numberedRev) {
    revision = revision ?? numberedRev[2]!;
    lower = numberedRev[1]!;
  }

  let suffixRules = [
    ...globalVariantSuffixes,
    ...(labHint ? (opts.labVariantSuffixes?.(labHint) ?? []) : [])
  ];

  changed = true;
  while (changed) {
    changed = false;

    if (lower.endsWith('-maas')) {
      wrapper = wrapper ?? '-maas';
      lower = lower.slice(0, -'-maas'.length);
      changed = true;
    }

    for (let q of quantizations) {
      if (lower.endsWith(`-${q}`)) {
        variant.quantization = variant.quantization ?? q;
        lower = lower.slice(0, -(q.length + 1));
        changed = true;
      }
    }

    for (let rule of suffixRules) {
      if (lower.endsWith(rule.suffix) && lower.length > rule.suffix.length + 1) {
        for (let [key, value] of Object.entries(rule.variant)) {
          if ((variant as any)[key] === null || (variant as any)[key] === false)
            (variant as any)[key] = value;
        }
        lower = lower.slice(0, -rule.suffix.length);
        changed = true;
      }
    }

    if (lower.endsWith('-latest') && lower.length > '-latest'.length) {
      isLatest = true;
      lower = lower.slice(0, -'-latest'.length);
      changed = true;
    }

    if (!date && opts.stripDate !== false) {
      let extracted = extractTrailingDate(lower);
      if (extracted) {
        date = extracted.date;
        datePrecision = extracted.precision;
        lower = extracted.stem;
        changed = true;
      }
    }
  }

  if (lower === 'latest') isLatest = true;

  return {
    labHint,
    stem: normalizeKey(lower),
    slug: lower
      .replace(/[^a-z0-9.]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, ''),
    date,
    datePrecision,
    isLatest,
    region,
    revision,
    variant: { ...variant, region },
    wrapper
  };
};
