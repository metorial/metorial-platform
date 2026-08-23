import { base62 } from '@lowerdeck/base62';

export let PROVIDER_INVOCATION_ID_PREFIX = 'piv_';

export type ProviderInvocationSourceType =
  | 'slate.invocation'
  | 'shuttle.function_invocation'
  | 'shuttle.server_connection';

export type ProviderInvocationBackendType = 'slates' | 'shuttle';

let legacyStoredSourceTypeToProviderSourceType: Record<
  string,
  ProviderInvocationSourceType | undefined
> = {
  'slates.auth_config_event': 'slate.invocation',
  'slates.oauth_setup_event': 'slate.invocation',
  'slates.oauth_setup': 'slate.invocation',
  'shuttle.server_auth_config_event': 'shuttle.function_invocation',
  'shuttle.server_oauth_setup': 'shuttle.function_invocation'
};

let providerInvocationSourceTypeToBackendType: Record<
  ProviderInvocationSourceType,
  ProviderInvocationBackendType
> = {
  'slate.invocation': 'slates',
  'shuttle.function_invocation': 'shuttle',
  'shuttle.server_connection': 'shuttle'
};

let extractProviderInvocationId = (id: string) =>
  JSON.parse(base62.decode(id.slice(PROVIDER_INVOCATION_ID_PREFIX.length))) as [
    unknown,
    unknown
  ];

export let createProviderInvocationId = (
  sourceType: ProviderInvocationSourceType,
  sourceId: string
) =>
  `${PROVIDER_INVOCATION_ID_PREFIX}${base62.encode(JSON.stringify([sourceType, sourceId]))}`;

export let parseProviderInvocationId = (id: string) => {
  if (!id.startsWith(PROVIDER_INVOCATION_ID_PREFIX)) return null;

  try {
    let [sourceType, sourceId] = extractProviderInvocationId(id);
    if (typeof sourceType !== 'string' || typeof sourceId !== 'string') return null;
    if (!(sourceType in providerInvocationSourceTypeToBackendType)) return null;

    return {
      id,
      sourceType: sourceType as ProviderInvocationSourceType,
      sourceId,
      backendType:
        providerInvocationSourceTypeToBackendType[
          sourceType as ProviderInvocationSourceType
        ]
    };
  } catch {
    return null;
  }
};

export let parseStoredProviderInvocationId = (d: {
  sourceType: string;
  providerInvocationId: string | null | undefined;
}) => {
  if (!d.providerInvocationId) return null;

  let parsed = parseProviderInvocationId(d.providerInvocationId);
  if (parsed) return parsed;

  let legacySourceType = legacyStoredSourceTypeToProviderSourceType[d.sourceType];
  if (!legacySourceType) return null;

  return {
    id: createProviderInvocationId(legacySourceType, d.providerInvocationId),
    sourceType: legacySourceType,
    sourceId: d.providerInvocationId,
    backendType: providerInvocationSourceTypeToBackendType[legacySourceType]
  };
};

export let normalizeStoredProviderInvocationId = (d: {
  sourceType: string;
  providerInvocationId: string | null | undefined;
}) => parseStoredProviderInvocationId(d)?.id ?? d.providerInvocationId ?? null;

export let buildStoredProviderInvocationIdFilter = (
  providerInvocationIds?: string[]
): any => {
  if (!providerInvocationIds?.length) return undefined;

  let encodedIds = Array.from(new Set(providerInvocationIds));
  let slatesRawIds: string[] = [];
  let shuttleFunctionRawIds: string[] = [];

  for (let providerInvocationId of providerInvocationIds) {
    let parsed = parseProviderInvocationId(providerInvocationId);
    if (!parsed) continue;

    if (parsed.sourceType === 'slate.invocation') {
      slatesRawIds.push(parsed.sourceId);
      continue;
    }

    if (parsed.sourceType === 'shuttle.function_invocation') {
      shuttleFunctionRawIds.push(parsed.sourceId);
    }
  }

  let filters: any[] = [
    {
      providerInvocationId: {
        in: encodedIds
      }
    }
  ];

  if (slatesRawIds.length) {
    filters.push({
      providerInvocationId: {
        in: Array.from(new Set(slatesRawIds))
      },
      sourceType: {
        in: ['slates.auth_config_event', 'slates.oauth_setup_event', 'slates.oauth_setup']
      }
    });
  }

  if (shuttleFunctionRawIds.length) {
    filters.push({
      providerInvocationId: {
        in: Array.from(new Set(shuttleFunctionRawIds))
      },
      sourceType: {
        in: ['shuttle.server_auth_config_event', 'shuttle.server_oauth_setup']
      }
    });
  }

  return filters.length === 1 ? filters[0] : { OR: filters };
};
