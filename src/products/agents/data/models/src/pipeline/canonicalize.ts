import { compareVersionSort, groupBy } from '../lib/util';
import { familyDisplayName, parseModelSlug } from '../normalize/grammar';
import { extractTrailingDate, normalizeKey, parseName } from '../normalize/parseName';
import { getLabProfile, labVariantSuffixes } from '../registry/labProfiles';
import type { ModelsDevSnapshot, UpstreamModel } from '../sources/modelsDev';
import type { Family, Model, NameTarget, Pointer, Release } from '../types';
import {
  cleanModelName,
  toCapabilities,
  toIsoDate,
  toLifecycleStatus,
  toLimits,
  toLinks,
  toModalities,
  toModelKind
} from './convert';
import type { OrganizationIndex } from './organizations';
import { isRouterId } from './routers';
import type { VendorIndex } from './vendors';

export interface SourceFile {
  labId: string;
  upstreamKey: string;
  upstreamId: string;
  data: UpstreamModel;
  origin: 'lab-file' | 'first-party-inline';
}

export interface ModelMerge {
  into: string;
  from: string[];
}

export interface IndexedKey {
  key: string;
  labId: string;
  target: NameTarget;
}

export interface CanonicalCatalog {
  models: Map<string, Model>;
  releases: Map<string, Release>;
  pointers: Map<string, Pointer>;
  families: Map<string, Family>;
  upstreamTargets: Map<string, NameTarget>;
  keys: IndexedKey[];
  undatedKeys: IndexedKey[];
  pointerStems: Map<string, string>;
  sourceFiles: SourceFile[];
}

interface Entry {
  file: SourceFile;
  slug: string;
  releaseDate: string | null;
  isLatest: boolean;
}

let lastSegment = (raw: string) => raw.split('/').pop()!;

let brandRoot = (token: string) => token.replace(/[\d.]+[a-z]?$/, '');

export let dottedVersions = (slug: string) => {
  let tokens = slug.split('-');
  let result: string[] = [];

  for (let i = 0; i < tokens.length; i++) {
    let token = tokens[i]!;

    if (/^\d{1,2}$/.test(token)) {
      while (i + 1 < tokens.length && /^\d$/.test(tokens[i + 1]!)) {
        let next = tokens[++i]!;
        let isLast = i + 1 >= tokens.length || !/^\d$/.test(tokens[i + 1]!);
        if (!(next === '0' && isLast)) token += `.${next}`;
      }
    }

    result.push(token);
  }

  return result.join('-');
};

export let canonicalSlug = (
  raw: string,
  labId: string,
  resolveLab: (alias: string) => string | null
) => {
  let profile = getLabProfile(labId);
  let opts = { labHint: labId, resolveOrg: resolveLab, labVariantSuffixes };
  let parsed = parseName(raw, opts);
  let finish = (slug: string) => (profile.dashedVersions ? dottedVersions(slug) : slug);

  if (parsed.isLatest)
    return { slug: finish(parsed.slug), releaseDate: null, isLatest: true, parsed };

  if (profile.dateSemantics === 'snapshot' && parsed.datePrecision === 'day')
    return { slug: finish(parsed.slug), releaseDate: parsed.date, isLatest: false, parsed };

  let kept = parseName(raw, { ...opts, stripDate: false });
  return { slug: finish(kept.slug), releaseDate: null, isLatest: false, parsed };
};

export let collectSourceFiles = (
  snapshot: ModelsDevSnapshot,
  orgs: OrganizationIndex,
  vendors: VendorIndex
): SourceFile[] => {
  let files: SourceFile[] = snapshot.labModels.map(model => ({
    labId: orgs.labForUpstream(model.labId),
    upstreamKey: `${model.labId}/${model.id}`,
    upstreamId: model.id,
    data: model.data,
    origin: 'lab-file'
  }));

  let brands = new Map<string, Set<string>>();
  for (let file of files) {
    let set = brands.get(file.labId) ?? new Set<string>();
    set.add(brandRoot(lastSegment(file.upstreamId).toLowerCase().split(/[-_.]/)[0]!));
    brands.set(file.labId, set);
  }

  for (let model of snapshot.providerModels) {
    if (model.baseModel || isRouterId(model.id)) continue;

    let endpoint = vendors.byProvider.get(model.providerId);
    let vendor = endpoint && vendors.vendors.get(endpoint.vendorId);
    if (!vendor || vendor.kind !== 'first-party') continue;

    let labId = vendor.organizationId;
    if (!orgs.organizations.get(labId)?.roles.includes('lab')) continue;

    let parsed = parseName(model.id, { resolveOrg: orgs.resolveLab });
    if (parsed.labHint && parsed.labHint !== labId) continue;

    let first = brandRoot(parsed.slug.split('-')[0] ?? '');
    let firstOrg = orgs.resolveLab(first);
    if (firstOrg && firstOrg !== labId) continue;
    if (firstOrg !== labId && brands.has(labId) && !brands.get(labId)!.has(first)) continue;

    files.push({
      labId,
      upstreamKey: `provider:${model.providerId}/${model.id}`,
      upstreamId: model.id,
      data: model.data,
      origin: 'first-party-inline'
    });
  }

  return files;
};

let primaryRank = (entry: Entry) => [
  entry.file.origin === 'lab-file' ? 0 : 1,
  entry.releaseDate ? 1 : 0,
  lastSegment(entry.file.upstreamId).toLowerCase() === entry.slug ? 0 : 1
];

let pickPrimary = (entries: Entry[]) =>
  [...entries].sort((a, b) => {
    let diff = compareVersionSort(primaryRank(a), primaryRank(b));
    if (diff !== 0) return diff;
    return (b.releaseDate ?? '').localeCompare(a.releaseDate ?? '');
  })[0]!;

let newestFirst = (a: Model, b: Model) => {
  let preferActive = Number(a.status === 'deprecated') - Number(b.status === 'deprecated');
  if (preferActive !== 0) return preferActive;

  let byDate = (b.releaseDate ?? '').localeCompare(a.releaseDate ?? '');
  if (byDate !== 0) return byDate;
  return compareVersionSort(b.versionSort, a.versionSort);
};

let buildModel = (id: string, labId: string, slug: string, primary: Entry): Model => {
  let data = primary.file.data;
  let grammar = parseModelSlug(slug, labId);

  return {
    id,
    labId,
    familyId: null,
    name: cleanModelName(data.name, slug),
    description: data.description ?? null,
    kind: toModelKind(data.type),
    version: grammar.version ?? grammar.date,
    versionSort: grammar.versionSort,
    size: grammar.size,
    derivedFrom: null,
    status: toLifecycleStatus(data.status),
    releaseDate: toIsoDate(data.release_date),
    knowledgeCutoff: data.knowledge ?? null,
    openWeights: data.open_weights ?? false,
    license: data.license ?? null,
    links: toLinks(data),
    modalities: toModalities(data),
    capabilities: toCapabilities(data),
    limits: toLimits(data),
    releaseIds: [],
    latestReleaseId: null,
    offeringCount: 0,
    origin: primary.file.origin
  };
};

export let linkFamilies = (models: Map<string, Model>) => {
  let families = new Map<string, Family>();

  for (let [familyId, members] of groupBy(models.values(), model => model.familyId!)) {
    let labId = members[0]!.labId;
    let series = familyId.slice(labId.length + 1);
    let kinds = groupBy(members, model => model.kind);
    let kind = [...kinds.entries()].sort((a, b) => b[1].length - a[1].length)[0]![0];
    let sorted = [...members].sort(newestFirst);

    families.set(familyId, {
      id: familyId,
      labId,
      name: familyDisplayName(series, labId),
      line: parseModelSlug(series, labId).line,
      kind: kind as Family['kind'],
      modelIds: members.map(model => model.id).sort(),
      latestModelId: sorted[0]?.id ?? null,
      status: members.every(model => model.status === 'retired') ? 'retired' : 'active'
    });
  }

  return families;
};

export let canonicalize = (
  files: SourceFile[],
  orgs: OrganizationIndex,
  merges: ModelMerge[] = []
): CanonicalCatalog => {
  let models = new Map<string, Model>();
  let releases = new Map<string, Release>();
  let pointers = new Map<string, Pointer>();
  let upstreamTargets = new Map<string, NameTarget>();
  let keys: IndexedKey[] = [];
  let undatedKeys: IndexedKey[] = [];
  let pointerStems = new Map<string, string>();

  let redirect = new Map<string, string>();
  for (let merge of merges) for (let from of merge.from) redirect.set(from, merge.into);

  let entries: Entry[] = files.map(file => {
    let canonical = canonicalSlug(file.upstreamId, file.labId, orgs.resolveLab);
    return {
      file,
      slug: canonical.slug,
      releaseDate: canonical.releaseDate,
      isLatest: canonical.isLatest
    };
  });

  let modelIdOf = (entry: Entry) => {
    let id = `${entry.file.labId}/${entry.slug}`;
    return redirect.get(id) ?? id;
  };

  let concrete = entries.filter(entry => !entry.isLatest);
  let latest = entries.filter(entry => entry.isLatest);

  let materialize = (id: string, group: Entry[]) => {
    let [labId, ...rest] = id.split('/');
    let slug = rest.join('/');
    let model = buildModel(id, labId!, slug, pickPrimary(group));
    models.set(id, model);
    keys.push({
      key: normalizeKey(slug),
      labId: labId!,
      target: { kind: 'model', modelId: id }
    });

    let dated = extractTrailingDate(slug);
    if (dated)
      undatedKeys.push({
        key: normalizeKey(dated.stem),
        labId: labId!,
        target: { kind: 'model', modelId: id }
      });

    return model;
  };

  for (let [id, group] of groupBy(concrete, modelIdOf)) {
    let model = materialize(id, group);

    for (let entry of group) {
      let target: NameTarget = { kind: 'model', modelId: id };

      if (entry.releaseDate) {
        let releaseId = `${id}@${entry.releaseDate}`;
        if (!releases.has(releaseId))
          releases.set(releaseId, {
            id: releaseId,
            modelId: id,
            date: entry.releaseDate,
            status: toLifecycleStatus(entry.file.data.status)
          });
        target = { kind: 'release', releaseId, modelId: id };
      }

      upstreamTargets.set(entry.file.upstreamKey, target);
      keys.push({
        key: normalizeKey(lastSegment(entry.file.upstreamId)),
        labId: model.labId,
        target
      });
    }
  }

  for (let release of releases.values()) {
    let model = models.get(release.modelId)!;
    model.releaseIds = [...model.releaseIds, release.id].sort();
    model.latestReleaseId = model.releaseIds[model.releaseIds.length - 1] ?? null;
  }

  for (let model of models.values()) {
    let series = parseModelSlug(model.id.slice(model.labId.length + 1), model.labId).series;
    model.familyId = `${model.labId}/${series}`;
  }

  for (let [stemId, group] of groupBy(latest, modelIdOf)) {
    let labId = group[0]!.file.labId;
    let stem = stemId.slice(labId.length + 1);
    let primary = pickPrimary(group);
    let kind = toModelKind(primary.file.data.type);
    let releaseDate = toIsoDate(primary.file.data.release_date);

    let candidates: Model[];
    let evidence: string;

    if (/\d/.test(stem)) {
      candidates = models.has(stemId) ? [models.get(stemId)!] : [];
      evidence = 'same-version';
    } else {
      let familyId = `${labId}/${parseModelSlug(stem, labId).series}`;
      candidates = [...models.values()].filter(
        model =>
          model.familyId === familyId &&
          model.kind === kind &&
          model.origin !== 'first-party-inline'
      );
      evidence = 'family-newest';
    }

    let dated = releaseDate
      ? candidates.filter(model => model.releaseDate === releaseDate)
      : [];
    let chosen: Model | undefined;

    if (dated.length === 1) {
      chosen = dated[0];
      evidence = 'release-date-match';
    } else {
      chosen = [...candidates].sort(newestFirst)[0];
    }

    if (!chosen) {
      chosen = materialize(stemId, group);
      chosen.familyId = `${labId}/${parseModelSlug(stem, labId).series}`;
      evidence = 'defined-by-pointer';
    }

    let pointerId = `${labId}/${stem}-latest`;
    let target: NameTarget = { kind: 'model', modelId: chosen.id };

    pointers.set(pointerId, {
      id: pointerId,
      labId,
      familyId: chosen.familyId,
      target,
      history: [],
      evidence
    });

    pointerStems.set(`${labId}/${normalizeKey(stem)}`, pointerId);

    for (let entry of group) {
      upstreamTargets.set(entry.file.upstreamKey, { kind: 'pointer', pointerId });
      keys.push({
        key: normalizeKey(lastSegment(entry.file.upstreamId)),
        labId,
        target: { kind: 'pointer', pointerId }
      });
    }
  }

  let families = linkFamilies(models);

  return {
    models,
    releases,
    pointers,
    families,
    upstreamTargets,
    keys: uniqKeys(keys),
    undatedKeys,
    pointerStems,
    sourceFiles: files
  };
};

let uniqKeys = (keys: IndexedKey[]) => {
  let seen = new Set<string>();
  return keys.filter(entry => {
    let id = `${entry.key}|${entry.labId}|${JSON.stringify(entry.target)}`;
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });
};
