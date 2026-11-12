import { groupBy } from '../lib/util';
import { normalizeKey, parseName } from '../normalize/parseName';
import type { OfferingOverride } from '../overrides';
import { parseModelSlug } from '../normalize/grammar';
import { getLabProfile, labVariantSuffixes } from '../registry/labProfiles';
import type { NameTarget, OfferingVariant, ParsedName, ResolutionMethod } from '../types';
import { canonicalSlug, type CanonicalCatalog, type IndexedKey } from './canonicalize';
import type { OrganizationIndex } from './organizations';
import { isRouterId } from './routers';
import type { VendorIndex } from './vendors';

let learnedMajority = 0.75;

export interface ResolveInput {
  vendorId: string | null;
  vendorModelId: string;
  baseModel?: string | null;
}

export interface ResolveResult {
  target: NameTarget;
  method: ResolutionMethod;
  upstreamCanonicalId: string | null;
  overrideId: string | null;
  variant: OfferingVariant;
  parsed: ParsedName;
}

let targetKey = (target: NameTarget) => JSON.stringify(target);

export let targetModelId = (target: NameTarget, catalog: CanonicalCatalog): string | null => {
  if (target.kind === 'model' || target.kind === 'release') return target.modelId;
  if (target.kind === 'pointer') {
    let pointer = catalog.pointers.get(target.pointerId);
    return pointer ? targetModelId(pointer.target, catalog) : null;
  }
  return null;
};

let compact = (key: string) => key.replace(/-/g, '');

let brandOf = (slug: string) => slug.split(/[-.]/)[0]!.replace(/[\d.]+[a-z]?$/, '');

let signatureOf = (slug: string, labId: string) => {
  let shape = parseModelSlug(slug, labId);
  return [
    labId,
    shape.series,
    shape.version,
    shape.size?.label,
    [...shape.modifiers].sort().join('+'),
    shape.date
  ].join('|');
};

let instructVariants = (key: string) =>
  key.endsWith('-instruct') ? [key.slice(0, -'-instruct'.length)] : [`${key}-instruct`];

export let createResolver = (
  catalog: CanonicalCatalog,
  orgs: OrganizationIndex,
  vendors: VendorIndex,
  offeringOverrides: OfferingOverride[] = []
) => {
  let keyIndex = groupBy(catalog.keys, entry => entry.key);
  let compactIndex = groupBy(catalog.keys, entry => compact(entry.key));
  let undatedIndex = groupBy(catalog.undatedKeys, entry => entry.key);
  let learned = new Map<string, Map<string, { target: NameTarget; votes: number }>>();
  let overridesByName = new Map(
    offeringOverrides.map(override => [
      `${override.vendorId}|${override.vendorModelId}`,
      override
    ])
  );

  let parseOpts = { resolveOrg: orgs.resolveLab, labVariantSuffixes };

  let structuralIndex = new Map<string, Set<string>>();
  let brandLabs = new Map<string, Set<string>>();
  for (let model of catalog.models.values()) {
    let slug = model.id.slice(model.labId.length + 1);
    let signature = signatureOf(slug, model.labId);
    structuralIndex.set(
      signature,
      (structuralIndex.get(signature) ?? new Set()).add(model.id)
    );
    brandLabs.set(brandOf(slug), (brandLabs.get(brandOf(slug)) ?? new Set()).add(model.labId));
  }

  let pick = (entries: IndexedKey[] | undefined, hint: string | null) => {
    if (!entries?.length) return null;

    let scoped = hint ? entries.filter(entry => entry.labId === hint) : entries;
    if (!scoped.length) scoped = entries;

    let distinct = new Map(scoped.map(entry => [targetKey(entry.target), entry]));
    return distinct.size === 1 ? [...distinct.values()][0]! : null;
  };

  // "meta-llama-3.1-8b" → try "llama-3.1-8b" with lab hint meta.
  let keyCandidates = (stem: string, hint: string | null) => {
    let result: { key: string; hint: string | null }[] = [{ key: stem, hint }];
    let tokens = stem.split('-');

    for (let length = 1; length <= 2 && length < tokens.length; length++) {
      let org = orgs.resolveLab(tokens.slice(0, length).join('-'));
      if (org) result.push({ key: tokens.slice(length).join('-'), hint: hint ?? org });
    }

    for (let candidate of [...result]) {
      if (!candidate.hint) continue;
      for (let prefix of getLabProfile(candidate.hint).namePrefixes) {
        if (candidate.key.startsWith(prefix))
          result.push({ key: candidate.key.slice(prefix.length), hint: candidate.hint });
      }
    }

    for (let candidate of [...result]) {
      let decimal = candidate.key.replace(/(\d)p(\d)/g, '$1-$2');
      if (decimal !== candidate.key) result.push({ key: decimal, hint: candidate.hint });
    }

    return result;
  };

  let lookup = (stem: string, hint: string | null, withInstruct = true): IndexedKey | null => {
    for (let candidate of keyCandidates(stem, hint)) {
      let hit = pick(keyIndex.get(candidate.key), candidate.hint);
      if (hit) return hit;
    }

    if (!withInstruct) return null;

    for (let variant of instructVariants(stem)) {
      let hit = lookup(variant, hint, false);
      if (hit) return hit;
    }

    for (let candidate of keyCandidates(stem, hint)) {
      let hit = pick(compactIndex.get(compact(candidate.key)), candidate.hint);
      if (hit) return hit;
    }

    return null;
  };

  let lookupUndated = (stem: string, hint: string | null) => {
    for (let candidate of keyCandidates(stem, hint)) {
      let hit = pick(undatedIndex.get(candidate.key), candidate.hint);
      if (hit) return hit;
    }
    return null;
  };

  // "~openai/gpt-luna-latest" has no upstream pointer file, but it names a family we know.
  let familyPointer = (slug: string, hint: string | null): NameTarget | null => {
    let labs = hint
      ? [hint]
      : [...new Set([...catalog.families.values()].map(family => family.labId))];
    let matches = labs
      .map(lab => catalog.families.get(`${lab}/${parseModelSlug(slug, lab).series}`))
      .filter(family => family?.latestModelId);
    if (matches.length !== 1) return null;

    let family = matches[0]!;
    let pointerId = `${family.labId}/${slug}-latest`;

    if (!catalog.pointers.has(pointerId)) {
      catalog.pointers.set(pointerId, {
        id: pointerId,
        labId: family.labId,
        familyId: family.id,
        target: { kind: 'model', modelId: family.latestModelId! },
        history: [],
        evidence: 'family-latest'
      });
      catalog.pointerStems.set(`${family.labId}/${normalizeKey(slug)}`, pointerId);
    }

    return { kind: 'pointer', pointerId };
  };

  // Same lab, series, version, size and modifiers in a different word order or spelling,
  // e.g. "claude-4-sonnet" for claude-sonnet-4.
  let lookupStructural = (
    raw: string,
    slug: string,
    hint: string | null
  ): NameTarget | null => {
    let labs = hint ? [hint] : [...(brandLabs.get(brandOf(slug)) ?? [])];
    if (labs.length !== 1) return null;

    let canonical = canonicalSlug(raw, labs[0]!, orgs.resolveLab);
    let hits = structuralIndex.get(signatureOf(canonical.slug, labs[0]!));
    if (hits?.size !== 1) return null;

    let modelId = [...hits][0]!;
    return findRelease(modelId, canonical.releaseDate);
  };

  let lookupLearned = (stem: string) => {
    let votes = learned.get(stem);
    if (!votes?.size) return null;

    let ranked = [...votes.values()].sort((a, b) => b.votes - a.votes);
    let total = ranked.reduce((sum, entry) => sum + entry.votes, 0);
    return ranked[0]!.votes / total >= learnedMajority ? ranked[0]!.target : null;
  };

  let learn = (vendorModelId: string, target: NameTarget) => {
    if (target.kind === 'router' || target.kind === 'unresolved') return;

    let stem = parseName(vendorModelId, { ...parseOpts, stripDate: false }).stem;
    let votes = learned.get(stem) ?? new Map();
    let key = targetKey(target);
    let existing = votes.get(key);

    if (existing) existing.votes++;
    else votes.set(key, { target, votes: 1 });
    learned.set(stem, votes);
  };

  let findRelease = (modelId: string, date: string | null): NameTarget => {
    let releaseId = date ? `${modelId}@${date}` : null;
    return releaseId && catalog.releases.has(releaseId)
      ? { kind: 'release', releaseId, modelId }
      : { kind: 'model', modelId };
  };

  let resolve = (input: ResolveInput): ResolveResult => {
    let parsed = parseName(input.vendorModelId, parseOpts);
    let kept = parseName(input.vendorModelId, { ...parseOpts, stripDate: false });
    let vendor = input.vendorId ? vendors.vendors.get(input.vendorId) : undefined;
    let vendorLab =
      vendor?.kind === 'first-party' &&
      orgs.organizations.get(vendor.organizationId)?.roles.includes('lab')
        ? vendor.organizationId
        : null;

    let hint = parsed.labHint ?? vendorLab;
    let result = (
      target: NameTarget,
      method: ResolutionMethod,
      extra: Partial<ResolveResult> = {}
    ) => ({
      target,
      method,
      upstreamCanonicalId: input.baseModel ?? null,
      overrideId: null,
      variant: parsed.variant,
      parsed,
      ...extra
    });

    let override = input.vendorId
      ? overridesByName.get(`${input.vendorId}|${input.vendorModelId}`)
      : undefined;

    if (override) {
      let target: NameTarget =
        override.target.kind === 'model'
          ? { kind: 'model', modelId: override.target.modelId }
          : override.target.kind === 'router'
            ? { kind: 'router' }
            : { kind: 'unresolved' };
      return result(target, 'override', { overrideId: override.id });
    }

    if (input.baseModel) {
      let target = catalog.upstreamTargets.get(input.baseModel);
      if (target) return result(target, 'base-model');
    }

    if (isRouterId(input.vendorModelId)) return result({ kind: 'router' }, 'router');

    if (parsed.isLatest) {
      for (let candidate of keyCandidates(parsed.stem, hint)) {
        let labs = candidate.hint ? [candidate.hint] : [...orgs.organizations.keys()];
        let pointerId = labs
          .map(lab => catalog.pointerStems.get(`${lab}/${candidate.key}`))
          .find(Boolean);
        if (pointerId) return result({ kind: 'pointer', pointerId }, 'pointer');
      }

      let model = lookup(parsed.stem, hint);
      if (model) return result(model.target, 'pointer');

      let family = familyPointer(parsed.slug, hint);
      if (family) return result(family, 'pointer');
    }

    let exact = lookup(kept.stem, hint);
    if (exact) {
      let method: ResolutionMethod =
        vendorLab && exact.labId === vendorLab ? 'first-party' : 'exact-key';
      return result(exact.target, method);
    }

    let learnedTarget = lookupLearned(kept.stem);
    if (learnedTarget) return result(learnedTarget, 'learned-alias');

    if (parsed.date) {
      let undated = lookup(parsed.stem, hint);
      if (undated && undated.target.kind === 'model')
        return result(findRelease(undated.target.modelId, parsed.date), 'snapshot-date');
    }

    let undatedHit = lookupUndated(kept.stem, hint);
    if (undatedHit) return result(undatedHit.target, 'snapshot-date');

    let structural = lookupStructural(input.vendorModelId, kept.slug, hint);
    if (structural) return result(structural, 'structural');

    return result({ kind: 'unresolved' }, 'unresolved');
  };

  return { resolve, learn };
};

export type Resolver = ReturnType<typeof createResolver>;
