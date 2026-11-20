import type {
  ConnectionCheckResult,
  ProviderConnectionConfig,
  ProviderCredentials
} from '@mtsrc/ai-gateway-spec';
import {
  resolvePlatformConnection,
  validatePlatformConnections,
  type PlatformConnectionDefinition,
  type ResolvedPlatformConnection
} from './definitions/platformConnection';

let authFailureRecheckMs = 60_000;

export type PlatformConnectionStatus = 'pending' | 'valid' | 'invalid';

export type PlatformConnectionState = {
  slug: string;
  providerSlug: string;
  configured: boolean;
  status: PlatformConnectionStatus | 'disabled';
  statusMessage: string | null;
  lastCheckedAt: Date | null;
};

type Entry = {
  definition: PlatformConnectionDefinition;
  resolved: ResolvedPlatformConnection;
  status: PlatformConnectionStatus;
  statusMessage: string | null;
  lastCheckedAt: Date | null;
  lastAuthFailureCheckAt: number;
};

// Platform keys come from env and their health lives in each process's memory: every replica checks
// its own keys, so nothing about them is ever persisted.
export let createPlatformConnectionRegistry = (d: {
  definitions: PlatformConnectionDefinition[];
  check: (d: {
    providerSlug: string;
    credentials: ProviderCredentials;
    config: ProviderConnectionConfig;
  }) => Promise<ConnectionCheckResult>;
  onStatusChange?: (state: PlatformConnectionState) => void;
  now?: () => Date;
}) => {
  validatePlatformConnections(d.definitions);

  let now = d.now ?? (() => new Date());

  let entries = new Map<string, Entry>(
    d.definitions.map(definition => [
      definition.slug,
      {
        definition,
        resolved: resolvePlatformConnection(definition),
        status: 'pending',
        statusMessage: null,
        lastCheckedAt: null,
        lastAuthFailureCheckAt: 0
      }
    ])
  );

  let stateOf = (entry: Entry): PlatformConnectionState => ({
    slug: entry.definition.slug,
    providerSlug: entry.definition.providerSlug,
    configured: entry.resolved.configured,
    status: entry.resolved.configured ? entry.status : 'disabled',
    statusMessage: entry.resolved.configured ? entry.statusMessage : entry.resolved.reason,
    lastCheckedAt: entry.lastCheckedAt
  });

  let check = async (slug: string) => {
    let entry = entries.get(slug);
    if (!entry?.resolved.configured) return;

    let result = await d.check({
      providerSlug: entry.definition.providerSlug,
      credentials: entry.resolved.credentials,
      config: entry.resolved.config
    });

    entry.lastCheckedAt = now();
    if (result.outcome == 'unreachable') return;

    let previous = entry.status;
    entry.status = result.outcome;
    entry.statusMessage =
      result.outcome == 'invalid'
        ? (result.message ?? 'The provider rejected the credentials.')
        : null;

    if (previous != entry.status) d.onStatusChange?.(stateOf(entry));
  };

  let configured = (slug: string) => {
    let entry = entries.get(slug);
    if (!entry) throw new Error(`Platform connection "${slug}" is not defined.`);
    if (!entry.resolved.configured) {
      throw new Error(`Platform connection "${slug}": ${entry.resolved.reason}`);
    }

    return entry.resolved;
  };

  return {
    status: (slug: string): PlatformConnectionStatus | null => {
      let entry = entries.get(slug);
      return entry?.resolved.configured ? entry.status : null;
    },

    credentials: (slug: string) => configured(slug).credentials,

    config: (slug: string) => configured(slug).config,

    check,

    checkAll: async () => {
      await Promise.all(
        [...entries.keys()].map(slug =>
          check(slug).catch(error =>
            console.error('[ai-gateway] Platform connection check failed', slug, error)
          )
        )
      );
    },

    reportAuthFailure: (slug: string) => {
      let entry = entries.get(slug);
      if (!entry) return;

      let at = now().getTime();
      if (at - entry.lastAuthFailureCheckAt < authFailureRecheckMs) return;
      entry.lastAuthFailureCheckAt = at;

      void check(slug).catch(error =>
        console.error('[ai-gateway] Platform connection check failed', slug, error)
      );
    },

    list: () => [...entries.values()].map(stateOf)
  };
};

export type PlatformConnectionRegistry = ReturnType<typeof createPlatformConnectionRegistry>;
