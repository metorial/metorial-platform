export let MIN_RATE_LIMIT_INTERVAL_SECONDS = 1;
export let MAX_RATE_LIMIT_INTERVAL_SECONDS = 60 * 60 * 24;

export type RateLimitKind = 'rate' | 'quota' | 'value';

export type RateLimitEnforcement = 'local' | 'synced';

export interface RateLimitUsageTypeDefinition {
  kind: RateLimitKind;
  enforcement: RateLimitEnforcement;

  name: string;
  description?: string;
  unit: string;

  supportsBurst?: boolean;
  minIntervalSeconds?: number;
  maxIntervalSeconds?: number;
}

export interface RateLimitResourceGroupDefinition<
  UsageTypes extends Record<string, RateLimitUsageTypeDefinition>
> {
  name: string;
  description?: string;
  usageTypes: UsageTypes;
}

export let usageType = <const D extends RateLimitUsageTypeDefinition>(d: D) => d;

export let resourceGroup = <
  const UsageTypes extends Record<string, RateLimitUsageTypeDefinition>
>(
  d: RateLimitResourceGroupDefinition<UsageTypes>
) => d;

export let rateLimitCatalog = {
  sandbox: resourceGroup({
    name: 'Sandboxes',
    description: 'Limits for sandbox machines, traffic and builds.',
    usageTypes: {
      machine_starts: usageType({
        kind: 'rate',
        enforcement: 'synced',
        name: 'Machine starts',
        unit: 'starts'
      }),

      requests_per_project: usageType({
        kind: 'rate',
        enforcement: 'synced',
        name: 'Requests per project',
        unit: 'requests',
        supportsBurst: false,
        minIntervalSeconds: 600
      }),

      requests_per_machine: usageType({
        kind: 'rate',
        enforcement: 'synced',
        name: 'Requests per machine',
        unit: 'requests',
        supportsBurst: false,
        minIntervalSeconds: 600
      }),

      open_connections: usageType({
        kind: 'quota',
        enforcement: 'synced',
        name: 'Open connections',
        unit: 'connections'
      }),

      machines: usageType({
        kind: 'quota',
        enforcement: 'synced',
        name: 'Machines',
        unit: 'machines'
      }),

      active_machines: usageType({
        kind: 'quota',
        enforcement: 'synced',
        name: 'Active machines',
        unit: 'machines'
      }),

      active_memory_mib: usageType({
        kind: 'quota',
        enforcement: 'synced',
        name: 'Active memory',
        unit: 'MiB'
      }),

      active_vcpus: usageType({
        kind: 'quota',
        enforcement: 'synced',
        name: 'Active vCPUs',
        unit: 'vCPUs'
      }),

      disk_bytes: usageType({
        kind: 'quota',
        enforcement: 'synced',
        name: 'Disk storage',
        unit: 'bytes'
      }),

      concurrent_builds: usageType({
        kind: 'quota',
        enforcement: 'synced',
        name: 'Concurrent image builds',
        unit: 'builds'
      }),

      ingress_bytes_per_second_per_connection: usageType({
        kind: 'value',
        enforcement: 'synced',
        name: 'Ingress bandwidth per connection',
        unit: 'bytes/s'
      }),

      boost_multiplier: usageType({
        kind: 'value',
        enforcement: 'synced',
        name: 'Boost multiplier',
        unit: 'x'
      })
    }
  }),

  sessions: resourceGroup({
    name: 'Sessions',
    description: 'Limits for MCP sessions and the tool calls made within them.',
    usageTypes: {
      created: usageType({
        kind: 'rate',
        enforcement: 'local',
        name: 'Sessions created',
        unit: 'sessions'
      }),

      tool_calls: usageType({
        kind: 'rate',
        enforcement: 'local',
        name: 'Tool calls',
        unit: 'tool calls'
      })
    }
  })
};

export type RateLimitCatalog = typeof rateLimitCatalog;

export type RateLimitResourceGroupSlug = keyof RateLimitCatalog & string;

type UsageTypesOf<G extends RateLimitResourceGroupSlug> = RateLimitCatalog[G]['usageTypes'];

export type RateLimitUsageKey = {
  [G in RateLimitResourceGroupSlug]: `${G}.${keyof UsageTypesOf<G> & string}`;
}[RateLimitResourceGroupSlug];

export type LocalRateLimitUsageKey = {
  [G in RateLimitResourceGroupSlug]: {
    [U in keyof UsageTypesOf<G> & string]: UsageTypesOf<G>[U] extends {
      kind: 'rate';
      enforcement: 'local';
    }
      ? `${G}.${U}`
      : never;
  }[keyof UsageTypesOf<G> & string];
}[RateLimitResourceGroupSlug];

export interface RateLimitUsageTypeEntry extends RateLimitUsageTypeDefinition {
  key: RateLimitUsageKey;
  slug: string;
  group: RateLimitResourceGroupSlug;
}

export let rateLimitResourceGroups = Object.entries(rateLimitCatalog).map(([slug, group]) => ({
  slug: slug as RateLimitResourceGroupSlug,
  name: group.name,
  description: group.description
}));

export let rateLimitUsageTypes: RateLimitUsageTypeEntry[] = Object.entries(
  rateLimitCatalog
).flatMap(([group, definition]) =>
  Object.entries(definition.usageTypes as Record<string, RateLimitUsageTypeDefinition>).map(
    ([slug, usage]) => ({
      ...usage,
      key: `${group}.${slug}` as RateLimitUsageKey,
      slug,
      group: group as RateLimitResourceGroupSlug
    })
  )
);

let usageTypesByKey = new Map(rateLimitUsageTypes.map(usage => [usage.key, usage]));

export let getRateLimitUsageType = (key: string) =>
  usageTypesByKey.get(key as RateLimitUsageKey);

export let isRateLimitUsageKey = (key: string): key is RateLimitUsageKey =>
  usageTypesByKey.has(key as RateLimitUsageKey);
