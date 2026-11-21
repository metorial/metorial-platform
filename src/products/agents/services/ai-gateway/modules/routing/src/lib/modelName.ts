import { normalizeKey } from '@metorial/model-catalog/src/normalize/parseName';
import { metorialProviderSlug } from '@mtsrc/ai-gateway-spec';

export type ModelNameRequest =
  | { kind: 'pinned'; raw: string; providerSlug: string; vendorModelId: string }
  | { kind: 'metorial'; raw: string; name: string }
  | { kind: 'unified'; raw: string; name: string };

export type ModelRef = { slug: string; labSlug: string };

export type AliasRef = { namespace: string; modelSlug: string };

export type ResolvedModelName = {
  model: ModelRef;
  via: 'slug' | 'alias' | 'key' | 'offering';
};

export type ModelNameSource = {
  modelBySlug: (slug: string) => Promise<ModelRef | null>;
  aliasesByRaw: (raw: string) => Promise<AliasRef[]>;
  aliasesByKey: (key: string) => Promise<AliasRef[]>;
  modelOfOffering: (d: {
    providerSlug: string;
    vendorModelId: string;
  }) => Promise<ModelRef | null>;
};

// Only a known provider slug before the first colon pins a provider: vendor model ids contain
// colons of their own (`anthropic.claude-v2:1`, `llama3:70b`), so anything else stays one name.
export let parseModelName = (raw: string, providerSlugs: Set<string>): ModelNameRequest => {
  let trimmed = raw.trim();
  let separator = trimmed.indexOf(':');

  if (separator > 0) {
    let prefix = trimmed.slice(0, separator).toLowerCase();
    let rest = trimmed.slice(separator + 1).trim();

    if (rest && prefix == metorialProviderSlug) return { kind: 'metorial', raw, name: rest };
    if (rest && providerSlugs.has(prefix)) {
      return { kind: 'pinned', raw, providerSlug: prefix, vendorModelId: rest };
    }
  }

  return { kind: 'unified', raw, name: trimmed };
};

let namespaceRank = (namespace: string, labSlug: string) => {
  if (namespace == 'metorial') return 0;
  if (namespace == `vendor:${labSlug}`) return 1;
  if (namespace.startsWith('vendor:')) return 2;
  if (namespace.startsWith('sdk:')) return 3;

  return 4;
};

// Several namespaces can claim the same name for different models (a reseller's `gpt-4` may point
// at an older snapshot). Our own namespace wins, then the lab's own API, then everyone else.
let pickAlias = async (aliases: AliasRef[], source: ModelNameSource) => {
  if (!aliases.length) return null;

  let ranked = [...aliases].sort((a, b) => {
    let [labA, labB] = [a.modelSlug.split('/')[0]!, b.modelSlug.split('/')[0]!];
    let rank = namespaceRank(a.namespace, labA) - namespaceRank(b.namespace, labB);

    return rank || a.modelSlug.localeCompare(b.modelSlug);
  });

  return await source.modelBySlug(ranked[0]!.modelSlug);
};

export let resolveUnifiedName = async (
  name: string,
  source: ModelNameSource
): Promise<ResolvedModelName | null> => {
  let bySlug = await source.modelBySlug(name.toLowerCase());
  if (bySlug) return { model: bySlug, via: 'slug' };

  let byRaw = await pickAlias(await source.aliasesByRaw(name), source);
  if (byRaw) return { model: byRaw, via: 'alias' };

  let byKey = await pickAlias(await source.aliasesByKey(normalizeKey(name)), source);
  if (byKey) return { model: byKey, via: 'key' };

  return null;
};

export let resolveModelName = async (
  request: ModelNameRequest,
  source: ModelNameSource
): Promise<ResolvedModelName | null> => {
  if (request.kind != 'pinned') return await resolveUnifiedName(request.name, source);

  let offered = await source.modelOfOffering({
    providerSlug: request.providerSlug,
    vendorModelId: request.vendorModelId
  });
  if (offered) return { model: offered, via: 'offering' };

  return await resolveUnifiedName(request.vendorModelId, source);
};
