import {
  CONTEXT_CHARS,
  getSizeTier,
  MATCHED_TEXT_MAX_CHARS,
  MAX_FINDINGS,
  MAX_MATCHES_PER_RULE_PER_WINDOW,
  planSegmentWindows,
  type WindowPlan
} from './budget';
import { findRegexMatches, lintRegex, PhraseMatcher } from './matchers';
import { canonicalize, decodeView, type TextView } from './normalize';
import { walkSegments, type SegmentWalkStats } from './segment';
import type {
  EngineFinding,
  RawMatch,
  RuleDefinition,
  Ruleset,
  ScanBudget,
  ScanContext,
  ScanCoverage,
  ScanDirection,
  ScanPayload,
  ScanResult,
  ScanView,
  Segment
} from './types';

let DECODED_SAMPLE_MAX_CHARS = 500;

let VIEW_PRIORITY: Record<ScanView, number> = { raw: 0, canonical: 1, decoded: 2 };

let SCAN_VIEWS: ScanView[] = ['raw', 'canonical', 'decoded'];

interface PhraseGroup {
  matcher: PhraseMatcher;
  owners: RuleDefinition[];
}

interface ViewPlan {
  phrases: PhraseGroup | null;
  others: RuleDefinition[];
}

interface DirectionPlan {
  cheap: Record<ScanView, ViewPlan>;
  all: Record<ScanView, ViewPlan>;
  isEmpty: boolean;
}

interface RuleMatch {
  rule: RuleDefinition;
  match: RawMatch;
}

let createPhraseGroup = (rules: RuleDefinition[]): PhraseGroup | null => {
  let phrases: string[] = [];
  let owners: RuleDefinition[] = [];

  for (let rule of rules) {
    if (rule.matcher.type != 'phrases') continue;

    for (let phrase of rule.matcher.phrases) {
      phrases.push(phrase);
      owners.push(rule);
    }
  }

  return phrases.length ? { matcher: new PhraseMatcher(phrases), owners } : null;
};

let createViewPlan = (rules: RuleDefinition[], view: ScanView): ViewPlan => {
  let viewRules = rules.filter(rule => rule.views.includes(view));

  return {
    phrases: createPhraseGroup(viewRules),
    others: viewRules.filter(rule => rule.matcher.type != 'phrases')
  };
};

let createViewPlans = (rules: RuleDefinition[]) =>
  Object.fromEntries(SCAN_VIEWS.map(view => [view, createViewPlan(rules, view)])) as Record<
    ScanView,
    ViewPlan
  >;

let createDirectionPlan = (
  rules: RuleDefinition[],
  direction: ScanDirection
): DirectionPlan => {
  let applicable = rules.filter(rule => rule.appliesTo[direction] !== undefined);

  return {
    cheap: createViewPlans(applicable.filter(rule => rule.cost == 'cheap')),
    all: createViewPlans(applicable),
    isEmpty: !applicable.length
  };
};

let isViewPlanEmpty = (plan: ViewPlan) => !plan.phrases && !plan.others.length;

export let validateRuleset = (ruleset: Ruleset) => {
  let familyKeys = new Set(ruleset.families.map(family => family.key));
  let ruleKeys = new Set<string>();

  for (let rule of ruleset.rules) {
    if (ruleKeys.has(rule.key)) throw new Error(`Duplicate rule key ${rule.key}`);
    if (!familyKeys.has(rule.family)) throw new Error(`Rule ${rule.key} has unknown family`);
    if (!rule.key.startsWith(`${rule.family}.`)) {
      throw new Error(`Rule ${rule.key} is not namespaced by its family`);
    }
    ruleKeys.add(rule.key);

    for (let precision of Object.values(rule.appliesTo)) {
      if (!(precision > 0 && precision <= 1)) {
        throw new Error(`Rule ${rule.key} has a precision outside (0, 1]`);
      }
    }

    if (rule.matcher.type == 'regex') {
      let issues = lintRegex(rule.matcher.pattern.source);
      if (issues.length) throw new Error(`Rule ${rule.key} regex: ${issues.join(', ')}`);
    }

    if (rule.matcher.type == 'phrases') new PhraseMatcher(rule.matcher.phrases);
  }
};

let runViewPlan = (
  plan: ViewPlan,
  d: {
    text: string;
    until: number;
    view: ScanView;
    direction: ScanDirection;
    context: ScanContext;
  }
) => {
  let results: RuleMatch[] = [];
  let limit = MAX_MATCHES_PER_RULE_PER_WINDOW;

  if (plan.phrases) {
    let counts = new Map<RuleDefinition, number>();
    let group = plan.phrases;

    for (let match of group.matcher.find(d.text, {
      limit: limit * group.owners.length,
      until: d.until
    })) {
      let rule = group.owners[match.phraseIndex]!;
      let count = counts.get(rule) ?? 0;
      if (count >= limit) continue;

      counts.set(rule, count + 1);
      results.push({ rule, match });
    }
  }

  for (let rule of plan.others) {
    let matches =
      rule.matcher.type == 'regex'
        ? findRegexMatches(rule.matcher.pattern, d.text, { limit, until: d.until })
        : rule.matcher.type == 'custom'
          ? rule.matcher
              .detect({
                text: d.text,
                view: d.view,
                direction: d.direction,
                context: d.context
              })
              .filter(match => match.start < d.until)
              .slice(0, limit)
          : [];

    for (let match of matches) results.push({ rule, match });
  }

  return results;
};

let canonicalUntil = (view: TextView, rawUntil: number) => {
  let low = 0;
  let high = view.text.length;

  while (low < high) {
    let mid = (low + high) >> 1;
    if (view.offsets[mid]! < rawUntil) low = mid + 1;
    else high = mid;
  }

  return low;
};

let canonicalRawEnd = (raw: string, view: TextView, end: number) => {
  if (end <= 0) return view.offsets[0]!;

  let last = view.offsets[end - 1]!;
  return last + ((raw.codePointAt(last) ?? 0) > 0xffff ? 2 : 1);
};

interface ScanState {
  context: ScanContext;
  findings: Map<string, EngineFinding & { segmentIndex: number }>;
  isFindingsTruncated: boolean;
}

let addFinding = (
  state: ScanState,
  d: {
    rule: RuleDefinition;
    segment: Segment;
    segmentIndex: number;
    view: ScanView;
    match: RawMatch;
    start: number;
    end: number;
    decodedSample: string | null;
  }
) => {
  let key = `${d.rule.key}|${d.segmentIndex}|${d.start}`;
  let existing = state.findings.get(key);
  if (existing && VIEW_PRIORITY[existing.view] <= VIEW_PRIORITY[d.view]) return;

  if (!existing && state.findings.size >= MAX_FINDINGS) {
    state.isFindingsTruncated = true;
    return;
  }

  let value = d.segment.value;
  let matchedText = value.slice(d.start, Math.min(d.end, d.start + MATCHED_TEXT_MAX_CHARS));
  let direction = d.segment.direction;

  state.findings.set(key, {
    segmentIndex: d.segmentIndex,
    ruleKey: d.rule.key,
    family: d.rule.family,
    direction,
    view: d.view,
    stage: d.rule.stage,
    precision: d.match.precision ?? d.rule.appliesTo[direction]!,
    hardRule: d.match.hardRule ?? d.rule.hardRule ?? false,
    redactMatch: d.rule.redactMatch ?? false,
    description: d.match.description ?? d.rule.description,
    ruleDescription: d.rule.description,
    path: d.segment.path,
    startOffset: d.start,
    endOffset: d.end,
    matchedText,
    canonicalText: canonicalize(matchedText).text,
    contextBefore: value.slice(Math.max(0, d.start - CONTEXT_CHARS), d.start),
    contextAfter: value.slice(d.end, d.end + CONTEXT_CHARS),
    decodedSample: d.decodedSample?.slice(0, DECODED_SAMPLE_MAX_CHARS) ?? null
  });
};

let scanWindow = (
  state: ScanState,
  d: { segment: Segment; segmentIndex: number; window: WindowPlan; plan: DirectionPlan }
) => {
  let { segment, window } = d;
  let plans = window.runExpensive ? d.plan.all : d.plan.cheap;

  let slice = segment.value.slice(window.start, window.end);
  let ownedUntil = window.ownedEnd - window.start;
  let base = { segment, segmentIndex: d.segmentIndex };
  let matchInput = { direction: segment.direction, context: state.context };

  for (let { rule, match } of runViewPlan(plans.raw, {
    ...matchInput,
    text: slice,
    until: ownedUntil,
    view: 'raw'
  })) {
    addFinding(state, {
      ...base,
      rule,
      view: 'raw',
      match,
      start: window.start + match.start,
      end: window.start + match.end,
      decodedSample: match.decodedSample ?? null
    });
  }

  // Building the canonical and decoded views is the expensive part of a scan, so in sampled
  // windows they are skipped entirely and only the raw view runs.
  if (!window.runExpensive) return;

  if (!isViewPlanEmpty(plans.canonical)) {
    let view = canonicalize(slice);

    for (let { rule, match } of runViewPlan(plans.canonical, {
      ...matchInput,
      text: view.text,
      until: canonicalUntil(view, ownedUntil),
      view: 'canonical'
    })) {
      addFinding(state, {
        ...base,
        rule,
        view: 'canonical',
        match,
        start: window.start + view.offsets[match.start]!,
        end: window.start + canonicalRawEnd(slice, view, match.end),
        decodedSample: null
      });
    }
  }

  if (!isViewPlanEmpty(plans.decoded)) {
    for (let piece of decodeView(segment.value, window)) {
      let seen = new Set<RuleDefinition>();

      for (let { rule, match } of runViewPlan(plans.decoded, {
        ...matchInput,
        text: piece.text,
        until: piece.text.length,
        view: 'decoded'
      })) {
        if (seen.has(rule)) continue;
        seen.add(rule);

        addFinding(state, {
          ...base,
          rule,
          view: 'decoded',
          match,
          start: piece.rawStart,
          end: piece.rawEnd,
          decodedSample: match.decodedSample ?? piece.text
        });
      }
    }
  }
};

let WALK_YIELD_SEGMENTS = 4096;

// Walking a large nested payload takes tens of milliseconds on its own, so the walk yields too.
function* collectSegments(payload: ScanPayload) {
  let stats: SegmentWalkStats = { segmentCount: 0, isTruncated: false };
  let segments: Segment[] = [];
  let totalChars = 0;
  let binaryChars = 0;
  let walkedCount = 0;

  for (let walked of walkSegments(payload, stats)) {
    if (++walkedCount % WALK_YIELD_SEGMENTS == 0) yield;

    if (walked.kind == 'binary') {
      binaryChars += walked.value.length;
      continue;
    }

    segments.push({ ...walked, globalOffset: totalChars });
    totalChars += walked.value.length;
  }

  return { segments, totalChars, binaryChars, stats };
}

// The engine is a generator so the scheduler can hand control back to the event loop between
// windows. It yields periodically during the segment walk and once per window, and never awaits, which keeps it deterministic: for the same
// payload, ruleset, and budget clock, the result is identical.
export function* scanPayload(d: {
  ruleset: Ruleset;
  payload: ScanPayload;
  context?: ScanContext;
  budget?: ScanBudget;
  enabledFamilies?: Set<string> | null;
}): Generator<void, ScanResult> {
  let { segments, totalChars, binaryChars, stats } = yield* collectSegments(d.payload);
  let tier = getSizeTier(totalChars);

  let rules = d.ruleset.rules.filter(
    rule =>
      rule.stage != 'deprecated' && (!d.enabledFamilies || d.enabledFamilies.has(rule.family))
  );
  let directionPlans = new Map<ScanDirection, DirectionPlan>();

  let state: ScanState = {
    context: d.context ?? {},
    findings: new Map(),
    isFindingsTruncated: false
  };

  let startedAt = d.budget?.now() ?? 0;
  let isBudgetExceeded = false;
  let scannedChars = 0;
  let plannedChars = 0;

  segmentLoop: for (let [segmentIndex, segment] of segments.entries()) {
    let plan = directionPlans.get(segment.direction);
    if (!plan) {
      plan = createDirectionPlan(rules, segment.direction);
      directionPlans.set(segment.direction, plan);
    }

    let windowPlan = planSegmentWindows({
      segmentLength: segment.value.length,
      globalOffset: segment.globalOffset,
      totalChars,
      tier
    });
    plannedChars += windowPlan.plannedChars;

    for (let window of windowPlan.windows) {
      let maxDurationMs = d.budget?.maxDurationMs;
      if (d.budget && maxDurationMs != null && d.budget.now() - startedAt > maxDurationMs) {
        isBudgetExceeded = true;
        break segmentLoop;
      }

      if (!plan.isEmpty) scanWindow(state, { segment, segmentIndex, window, plan });

      scannedChars += Math.min(window.ownedEnd, window.end) - window.start;
      yield;
    }
  }

  let isPartial =
    isBudgetExceeded || stats.isTruncated || tier == 'XL' || plannedChars < totalChars;
  let coverage: ScanCoverage = isPartial ? 'partial' : tier == 'L' ? 'sampled' : 'full';

  let findings = [...state.findings.values()]
    .sort(
      (a, b) =>
        a.segmentIndex - b.segmentIndex ||
        a.startOffset - b.startOffset ||
        a.ruleKey.localeCompare(b.ruleKey)
    )
    .map(({ segmentIndex: _, ...finding }) => finding);

  return {
    rulesetVersion: d.ruleset.version,
    tier,
    coverage,
    totalChars,
    scannedChars: Math.min(scannedChars, totalChars),
    binaryChars,
    segmentCount: stats.segmentCount,
    isBudgetExceeded,
    isFindingsTruncated: state.isFindingsTruncated,
    findings
  };
}

export let scanPayloadSync = (d: Parameters<typeof scanPayload>[0]) => {
  let iterator = scanPayload(d);

  for (let step = iterator.next(); ; step = iterator.next()) {
    if (step.done) return step.value;
  }
};
