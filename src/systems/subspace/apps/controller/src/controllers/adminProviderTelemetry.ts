import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import { db } from '@metorial-subspace/db';
import { providerService } from '@metorial-subspace/module-catalog';
import {
  adminProviderTelemetryErrorGroupService,
  adminProviderTelemetryErrorGroupTypes,
  providerInvocationService,
  providerRunLogsService,
  sessionMessageService
} from '@metorial-subspace/module-session';
import {
  adminProviderTelemetryErrorGroupPresenter,
  providerInvocationPresenter,
  sessionMessagePresenter
} from '@metorial-subspace/presenters';
import { app } from './_app';

let dateRangeValidator = v.object({
  from: v.optional(v.date()),
  to: v.optional(v.date())
});

let telemetryMetricScopeValidator = {
  tenantId: v.optional(v.string()),
  tenantIds: v.optional(v.array(v.string())),
  tenantSearch: v.optional(v.string()),
  environmentId: v.optional(v.string()),
  environmentIds: v.optional(v.array(v.string())),
  range: v.optional(dateRangeValidator)
};

let telemetryScopeValidator = {
  providerId: v.optional(v.string()),
  ...telemetryMetricScopeValidator
};

let withDefaultRange = (range?: { from?: Date; to?: Date }) => {
  let to = range?.to ?? new Date();
  let from = range?.from ?? new Date(to.getTime() - 7 * 24 * 60 * 60 * 1000);
  let maxRangeMs = 90 * 24 * 60 * 60 * 1000;
  if (to.getTime() - from.getTime() > maxRangeMs) {
    from = new Date(to.getTime() - maxRangeMs);
  }

  return { from, to };
};

let bucketDate = (date: Date, bucket: 'hour' | 'day') => {
  let d = new Date(date);
  d.setMinutes(0, 0, 0);
  if (bucket === 'day') d.setHours(0, 0, 0, 0);
  return d.toISOString();
};

let uniqueStrings = (values: (string | null | undefined)[]) =>
  Array.from(new Set(values.map(v => v?.trim()).filter(Boolean) as string[]));

let uniqueBigints = (values: bigint[]) => Array.from(new Set(values));

let oidFilter = (oids?: bigint[]) => (oids ? { in: oids } : undefined);

let createdAtOrder = (order?: 'asc' | 'desc') => [
  { createdAt: order ?? ('desc' as const) },
  { id: order ?? ('desc' as const) }
];

let emptyList = () => ({
  object: 'list',
  items: [],
  pagination: {
    has_more_after: false,
    has_more_before: false
  }
});

let paginateSortedItems = <T extends { id: string }>(
  sorted: T[],
  input: { limit?: number; after?: string; before?: string }
) => {
  let limit = Number(input.limit ?? 100);
  if (Number.isNaN(limit)) limit = 100;
  limit = Math.min(Math.max(limit, 1), 100);

  let cursorType = input.before ? 'before' : input.after ? 'after' : 'none';
  let cursorId = input.before ?? input.after;
  let cursorItem = cursorId ? sorted.find(item => item.id === cursorId) : null;

  let start = 0;
  let end = sorted.length;

  if (cursorItem) {
    let cursorIndex = sorted.indexOf(cursorItem);
    if (cursorType === 'after') start = cursorIndex + 1;
    else if (cursorType === 'before') end = cursorIndex;
  }

  let available = sorted.slice(start, end);

  if (cursorType === 'before') {
    return {
      items: available.slice(-limit),
      pagination: {
        has_more_after: !!cursorItem,
        has_more_before: available.length > limit
      }
    };
  }

  return {
    items: available.slice(0, limit),
    pagination: {
      has_more_after: available.length > limit,
      has_more_before: cursorType === 'after' && !!cursorItem
    }
  };
};

let resolveProvider = async (providerId?: string) => {
  if (!providerId) return undefined;

  return await db.provider.findFirstOrThrow({
    where: {
      OR: [
        { id: providerId },
        { slug: providerId },
        { globalIdentifier: providerId },
        { listing: { id: providerId } },
        { listing: { slug: providerId } }
      ]
    }
  });
};

let resolveTelemetryScope = async (input: {
  providerId?: string;
  tenantId?: string;
  tenantIds?: string[];
  tenantSearch?: string;
  environmentId?: string;
  environmentIds?: string[];
  range?: { from?: Date; to?: Date };
}) => {
  let { from, to } = withDefaultRange(input.range);
  let provider = await resolveProvider(input.providerId);
  let tenantIds = uniqueStrings([input.tenantId, ...(input.tenantIds ?? [])]);
  let tenantSearch = input.tenantSearch?.trim();
  let environmentIds = uniqueStrings([input.environmentId, ...(input.environmentIds ?? [])]);

  if (
    (input.tenantIds && tenantIds.length === 0) ||
    (input.environmentIds && environmentIds.length === 0)
  ) {
    return { provider, from, to, isEmpty: true as const };
  }

  let tenants = tenantIds.length
    ? await db.tenant.findMany({ where: { id: { in: tenantIds } } })
    : [];
  if (tenantIds.length && tenants.length !== tenantIds.length) {
    throw new Error('One or more tenant IDs were not found');
  }

  let tenantSearchMatches = tenantSearch
    ? await db.tenant.findMany({
        where: {
          OR: [
            { id: { contains: tenantSearch, mode: 'insensitive' } },
            { identifier: { contains: tenantSearch, mode: 'insensitive' } },
            { urlKey: { contains: tenantSearch, mode: 'insensitive' } },
            { name: { contains: tenantSearch, mode: 'insensitive' } }
          ]
        }
      })
    : [];

  if (tenantSearch && tenantSearchMatches.length === 0 && tenantIds.length === 0) {
    return { provider, from, to, isEmpty: true as const };
  }

  let tenantOids = uniqueBigints(
    [...tenants, ...tenantSearchMatches].map(tenant => tenant.oid)
  );
  let environments = environmentIds.length
    ? await db.environment.findMany({
        where: {
          id: { in: environmentIds },
          tenantOid: tenantOids.length ? { in: tenantOids } : undefined
        }
      })
    : [];
  if (environmentIds.length && environments.length !== environmentIds.length) {
    throw new Error('One or more environment IDs were not found');
  }

  return {
    provider,
    from,
    to,
    tenantOids: tenantOids.length ? tenantOids : undefined,
    environmentOids: environments.length
      ? environments.map(environment => environment.oid)
      : undefined,
    isEmpty: false as const
  };
};

let firstPartyProviderWhere = (input: {
  search?: string;
  includeDeprecated?: boolean;
  providerIds?: string[];
}) => ({
  ownerTenantOid: null,
  ownerSolutionOid: null,
  status: 'active' as const,
  ...(input.includeDeprecated ? {} : { isDeprecated: false }),
  AND: [
    input.providerIds?.length
      ? {
          OR: [
            { id: { in: input.providerIds } },
            { slug: { in: input.providerIds } },
            { prettySlug: { in: input.providerIds } },
            { provider: { id: { in: input.providerIds } } },
            { provider: { slug: { in: input.providerIds } } },
            { provider: { globalIdentifier: { in: input.providerIds } } }
          ]
        }
      : undefined!,
    input.search?.trim()
      ? {
          OR: [
            { id: { contains: input.search, mode: 'insensitive' as const } },
            { name: { contains: input.search, mode: 'insensitive' as const } },
            { slug: { contains: input.search, mode: 'insensitive' as const } },
            { prettySlug: { contains: input.search, mode: 'insensitive' as const } },
            { provider: { id: { contains: input.search, mode: 'insensitive' as const } } },
            { provider: { name: { contains: input.search, mode: 'insensitive' as const } } },
            { provider: { slug: { contains: input.search, mode: 'insensitive' as const } } },
            {
              provider: {
                globalIdentifier: { contains: input.search, mode: 'insensitive' as const }
              }
            }
          ]
        }
      : undefined!
  ].filter(Boolean)
});

let providerListingInclude = {
  publisher: true,
  categories: true,
  collections: true,
  provider: {
    include: {
      type: true,
      defaultVariant: { include: { currentVersion: true } },
      providerVersions: {
        orderBy: { createdAt: 'desc' as const },
        take: 20
      }
    }
  }
};

let presentProvider = async (
  listing: any,
  range?: { from?: Date; to?: Date },
  scope?: { tenantOids?: bigint[]; environmentOids?: bigint[] }
) => {
  let { from, to } = withDefaultRange(range);

  let [runs, errors, authFailures, latestRun] = await Promise.all([
    db.providerRun.count({
      where: {
        providerOid: listing.providerOid,
        tenantOid: oidFilter(scope?.tenantOids),
        environmentOid: oidFilter(scope?.environmentOids),
        createdAt: { gte: from, lte: to }
      }
    }),
    db.sessionError.count({
      where: {
        tenantOid: oidFilter(scope?.tenantOids),
        environmentOid: oidFilter(scope?.environmentOids),
        providerRun: { providerOid: listing.providerOid },
        createdAt: { gte: from, lte: to }
      }
    }),
    db.providerSetupSessionEvent.count({
      where: {
        type: 'oauth_setup_failed',
        session: {
          providerOid: listing.providerOid,
          tenantOid: oidFilter(scope?.tenantOids),
          environmentOid: oidFilter(scope?.environmentOids)
        },
        createdAt: { gte: from, lte: to }
      }
    }),
    db.providerRun.findFirst({
      where: {
        providerOid: listing.providerOid,
        tenantOid: oidFilter(scope?.tenantOids),
        environmentOid: oidFilter(scope?.environmentOids)
      },
      orderBy: { createdAt: 'desc' },
      select: { id: true, createdAt: true, status: true }
    })
  ]);

  return {
    object: 'admin.provider',
    id: listing.provider.id,
    listing_id: listing.id,
    name: listing.name,
    slug: listing.slug,
    pretty_slug: listing.prettySlug,
    status: listing.status,
    is_public: listing.isPublic,
    is_deprecated: listing.isDeprecated,
    is_customized: listing.isCustomized,
    is_metorial: listing.isMetorial,
    is_verified: listing.isVerified,
    is_official: listing.isOfficial,
    publisher: listing.publisher
      ? {
          id: listing.publisher.id,
          name: listing.publisher.name,
          type: listing.publisher.type
        }
      : null,
    type: listing.provider.type
      ? {
          id: listing.provider.type.id,
          name: listing.provider.type.name,
          attributes: listing.provider.type.attributes
        }
      : null,
    current_version: listing.provider.defaultVariant?.currentVersion
      ? {
          id: listing.provider.defaultVariant.currentVersion.id,
          tag: listing.provider.defaultVariant.currentVersion.tag,
          name: listing.provider.defaultVariant.currentVersion.name,
          created_at: listing.provider.defaultVariant.currentVersion.createdAt
        }
      : null,
    versions: (listing.provider.providerVersions ?? []).map((version: any) => ({
      id: version.id,
      tag: version.tag,
      name: version.name,
      specification_discovery_status: version.specificationDiscoveryStatus,
      is_current: version.isCurrent,
      created_at: version.createdAt
    })),
    metrics: {
      range: { from, to },
      runs,
      errors,
      auth_failures: authFailures,
      error_rate: runs > 0 ? errors / runs : 0,
      latest_run: latestRun
        ? {
            id: latestRun.id,
            status: latestRun.status,
            created_at: latestRun.createdAt
          }
        : null
    },
    created_at: listing.createdAt,
    updated_at: listing.updatedAt
  };
};

let summarizeBuckets = async (input: {
  providerOid?: bigint;
  tenantOids?: bigint[];
  environmentOids?: bigint[];
  from: Date;
  to: Date;
  bucket: 'hour' | 'day';
}) => {
  let [runs, errors, messages, authFailures] = await Promise.all([
    db.providerRun.findMany({
      where: {
        providerOid: input.providerOid,
        tenantOid: oidFilter(input.tenantOids),
        environmentOid: oidFilter(input.environmentOids),
        createdAt: { gte: input.from, lte: input.to }
      },
      select: { createdAt: true, status: true }
    }),
    db.sessionError.findMany({
      where: {
        tenantOid: oidFilter(input.tenantOids),
        environmentOid: oidFilter(input.environmentOids),
        providerRun: input.providerOid ? { providerOid: input.providerOid } : undefined,
        createdAt: { gte: input.from, lte: input.to }
      },
      select: { createdAt: true, type: true }
    }),
    db.sessionMessage.findMany({
      where: {
        tenantOid: oidFilter(input.tenantOids),
        environmentOid: oidFilter(input.environmentOids),
        providerRun: input.providerOid ? { providerOid: input.providerOid } : undefined,
        createdAt: { gte: input.from, lte: input.to }
      },
      select: { createdAt: true, status: true, source: true }
    }),
    db.providerSetupSessionEvent.findMany({
      where: {
        type: 'oauth_setup_failed',
        session: {
          providerOid: input.providerOid,
          tenantOid: oidFilter(input.tenantOids),
          environmentOid: oidFilter(input.environmentOids)
        },
        createdAt: { gte: input.from, lte: input.to }
      },
      select: { createdAt: true }
    })
  ]);

  let bucketMap = new Map<
    string,
    {
      starts_at: string;
      runs: number;
      errors: number;
      messages: number;
      failed_messages: number;
      auth_failures: number;
    }
  >();

  let getBucket = (date: Date) => {
    let key = bucketDate(date, input.bucket);
    let existing = bucketMap.get(key);
    if (existing) return existing;

    let next = {
      starts_at: key,
      runs: 0,
      errors: 0,
      messages: 0,
      failed_messages: 0,
      auth_failures: 0
    };
    bucketMap.set(key, next);
    return next;
  };

  for (let run of runs) getBucket(run.createdAt).runs++;
  for (let error of errors) getBucket(error.createdAt).errors++;
  for (let message of messages) {
    let bucket = getBucket(message.createdAt);
    bucket.messages++;
    if (message.status === 'failed') bucket.failed_messages++;
  }
  for (let authFailure of authFailures) getBucket(authFailure.createdAt).auth_failures++;

  return Array.from(bucketMap.values())
    .sort((a, b) => a.starts_at.localeCompare(b.starts_at))
    .map(bucket => ({
      ...bucket,
      error_rate: bucket.runs > 0 ? bucket.errors / bucket.runs : 0
    }));
};

let getTenantEnvironment = async (input: { tenantId?: string; environmentId?: string }) => {
  if (!input.tenantId || !input.environmentId) {
    return { tenant: undefined, environment: undefined };
  }

  let tenant = await db.tenant.findFirstOrThrow({ where: { id: input.tenantId } });
  let environment = await db.environment.findFirstOrThrow({
    where: { id: input.environmentId, tenantOid: tenant.oid }
  });

  return { tenant, environment };
};

let requireTenantEnvironment = async (input: {
  tenantId?: string;
  environmentId?: string;
}) => {
  let { tenant, environment } = await getTenantEnvironment(input);
  if (!tenant || !environment) {
    throw new Error('tenantId and environmentId are required');
  }

  return { tenant, environment };
};

let presentSession = (session: any) => ({
  object: 'admin.session',
  id: session.id,
  name: session.name,
  description: session.description,
  metadata: session.metadata,
  status: session.status,
  connection_state: session.connectionState,
  has_errors: session.hasErrors,
  has_warnings: session.hasWarnings,
  tenant: { id: session.tenant.id, name: session.tenant.name },
  environment: { id: session.environment.id, name: session.environment.name },
  providers: (session.providers ?? []).map((provider: any) => ({
    id: provider.id,
    status: provider.status,
    provider: provider.provider
      ? {
          id: provider.provider.id,
          name: provider.provider.name,
          slug: provider.provider.slug
        }
      : null,
    deployment_id: provider.deployment?.id ?? null,
    config_id: provider.config?.id ?? null,
    auth_config_id: provider.authConfig?.id ?? null
  })),
  usage: {
    total_productive_client_message_count: session.totalProductiveClientMessageCount,
    total_productive_provider_message_count: session.totalProductiveProviderMessageCount
  },
  created_at: session.createdAt,
  updated_at: session.updatedAt
});

let presentAdminRun = (run: any) => ({
  object: 'admin.provider_run',
  id: run.id,
  status: run.status,
  provider: { id: run.provider.id, name: run.provider.name, slug: run.provider.slug },
  provider_version: {
    id: run.providerVersion.id,
    tag: run.providerVersion.tag,
    name: run.providerVersion.name
  },
  tenant: { id: run.tenant.id, name: run.tenant.name },
  environment: { id: run.environment.id, name: run.environment.name },
  tenant_id: run.tenant.id,
  environment_id: run.environment.id,
  session_id: run.session.id,
  errors: (run.sessionErrors ?? []).map((error: any) => ({
    id: error.id,
    type: error.type,
    code: error.code,
    message: error.message,
    created_at: error.createdAt
  })),
  created_at: run.createdAt,
  updated_at: run.updatedAt,
  completed_at: run.completedAt
});

export let adminProviderTelemetryController = app.controller({
  listProviders: app
    .handler()
    .input(
      Paginator.validate(
        v.object({
          search: v.optional(v.string()),
          providerIds: v.optional(v.array(v.string())),
          includeDeprecated: v.optional(v.boolean()),
          ...telemetryMetricScopeValidator
        })
      )
    )
    .do(async ctx => {
      let scope = await resolveTelemetryScope(ctx.input);
      if (scope.isEmpty) return emptyList();

      let paginator = Paginator.create(
        ({ prisma }) =>
          prisma(
            async opts =>
              await db.providerListing.findMany({
                ...opts,
                orderBy: createdAtOrder(ctx.input.order),
                where: firstPartyProviderWhere({
                  search: ctx.input.search,
                  providerIds: ctx.input.providerIds,
                  includeDeprecated: ctx.input.includeDeprecated
                }),
                include: providerListingInclude
              })
          ),
        { defaultOrder: 'desc' }
      );

      let list = await paginator.run(ctx.input);
      let items = await Promise.all(
        list.items.map(listing => presentProvider(listing, ctx.input.range, scope))
      );

      return {
        object: 'list',
        items,
        pagination: {
          has_more_after: list.pagination.hasNextPage,
          has_more_before: list.pagination.hasPreviousPage
        }
      };
    }),

  getProvider: app
    .handler()
    .input(
      v.object({
        providerId: v.string(),
        range: v.optional(dateRangeValidator)
      })
    )
    .do(async ctx => {
      let listing = await db.providerListing.findFirstOrThrow({
        where: firstPartyProviderWhere({
          providerIds: [ctx.input.providerId],
          includeDeprecated: true
        }),
        include: providerListingInclude
      });

      return presentProvider(listing, ctx.input.range);
    }),

  updateProvider: app
    .handler()
    .input(
      v.object({
        providerId: v.string(),
        name: v.optional(v.string()),
        description: v.optional(v.string()),
        readme: v.optional(v.string()),
        slug: v.optional(v.string()),
        aliases: v.optional(v.array(v.string())),
        image: v.optional(v.any()),
        skills: v.optional(v.array(v.string())),
        access: v.optional(v.enumOf(['public', 'tenant'])),
        status: v.optional(v.enumOf(['active', 'archived', 'deleted'])),
        isDeprecated: v.optional(v.boolean()),
        isPublic: v.optional(v.boolean()),
        isMetorial: v.optional(v.boolean()),
        isVerified: v.optional(v.boolean()),
        isOfficial: v.optional(v.boolean()),
        rank: v.optional(v.number())
      })
    )
    .do(async ctx => {
      let listing = await db.providerListing.findFirstOrThrow({
        where: firstPartyProviderWhere({
          providerIds: [ctx.input.providerId],
          includeDeprecated: true
        }),
        include: { provider: true }
      });

      await providerService.updateProvider({
        provider: listing.provider,
        input: {
          name: ctx.input.name,
          description: ctx.input.description,
          readme: ctx.input.readme,
          slug: ctx.input.slug,
          aliases: ctx.input.aliases,
          image: ctx.input.image,
          skills: ctx.input.skills,
          access: ctx.input.access,
          status: ctx.input.status,
          isDeprecated: ctx.input.isDeprecated,
          isPublic: ctx.input.isPublic,
          isMetorial: ctx.input.isMetorial,
          isVerified: ctx.input.isVerified,
          isOfficial: ctx.input.isOfficial,
          rank: ctx.input.rank
        }
      });

      let updated = await db.providerListing.findFirstOrThrow({
        where: { id: listing.id },
        include: providerListingInclude
      });

      return presentProvider(updated);
    }),

  getTelemetry: app
    .handler()
    .input(
      v.object({
        ...telemetryScopeValidator,
        bucket: v.optional(v.enumOf(['hour', 'day']))
      })
    )
    .do(async ctx => {
      let scope = await resolveTelemetryScope(ctx.input);
      let bucket = ctx.input.bucket ?? 'day';

      if (scope.isEmpty) {
        return {
          object: 'admin.provider_telemetry',
          range: { from: scope.from, to: scope.to },
          bucket,
          totals: {
            runs: 0,
            errors: 0,
            messages: 0,
            failed_messages: 0,
            auth_failures: 0,
            error_rate: 0
          },
          buckets: []
        };
      }

      let buckets = await summarizeBuckets({
        providerOid: scope.provider?.oid,
        tenantOids: scope.tenantOids,
        environmentOids: scope.environmentOids,
        from: scope.from,
        to: scope.to,
        bucket
      });

      let totals = buckets.reduce(
        (acc, bucket) => ({
          runs: acc.runs + bucket.runs,
          errors: acc.errors + bucket.errors,
          messages: acc.messages + bucket.messages,
          failed_messages: acc.failed_messages + bucket.failed_messages,
          auth_failures: acc.auth_failures + bucket.auth_failures
        }),
        { runs: 0, errors: 0, messages: 0, failed_messages: 0, auth_failures: 0 }
      );

      return {
        object: 'admin.provider_telemetry',
        range: { from: scope.from, to: scope.to },
        bucket,
        totals: {
          ...totals,
          error_rate: totals.runs > 0 ? totals.errors / totals.runs : 0
        },
        buckets
      };
    }),

  listErrorGroups: app
    .handler()
    .input(
      Paginator.validate(
        v.object({
          ...telemetryScopeValidator,
          types: v.optional(v.array(v.enumOf([...adminProviderTelemetryErrorGroupTypes])))
        })
      )
    )
    .do(async ctx => {
      let paginator = await adminProviderTelemetryErrorGroupService.listErrorGroups(ctx.input);
      let list = await paginator.run(ctx.input);
      return Paginator.presentLight(list, adminProviderTelemetryErrorGroupPresenter);
    }),

  getErrorGroup: app
    .handler()
    .input(v.object({ sessionErrorGroupId: v.string() }))
    .do(async ctx => {
      let group = await db.sessionErrorGroup.findFirstOrThrow({
        where: { id: ctx.input.sessionErrorGroupId },
        include: {
          provider: true,
          tenant: true,
          environment: true,
          firstOccurrence: true,
          sessionErrorGroupOccurrencePeriods: { orderBy: { startsAt: 'asc' } }
        }
      });

      let occurrences = await db.sessionError.findMany({
        where: { groupOid: group.oid },
        include: {
          providerRun: {
            include: {
              providerVersion: true,
              provider: true,
              session: true,
              tenant: true,
              environment: true
            }
          },
          session: true
        },
        orderBy: { createdAt: 'desc' },
        take: 50
      });

      return {
        object: 'admin.provider_error_group.detail',
        id: group.id,
        type: group.type,
        code: group.code,
        message: group.message,
        hash: group.hash,
        occurrence_count: group.occurrenceCount,
        provider: group.provider
          ? { id: group.provider.id, name: group.provider.name, slug: group.provider.slug }
          : null,
        tenant: { id: group.tenant.id, name: group.tenant.name },
        environment: { id: group.environment.id, name: group.environment.name },
        periods: group.sessionErrorGroupOccurrencePeriods.map(period => ({
          starts_at: period.startsAt,
          ends_at: period.endsAt,
          occurrence_count: period.occurrenceCount
        })),
        occurrences: occurrences.map(error => ({
          id: error.id,
          type: error.type,
          code: error.code,
          message: error.message,
          payload: error.payload,
          session_id: error.session.id,
          tenant_id: error.providerRun?.tenant.id ?? group.tenant.id,
          environment_id: error.providerRun?.environment.id ?? group.environment.id,
          provider_run_id: error.providerRun?.id ?? null,
          provider: error.providerRun?.provider
            ? {
                id: error.providerRun.provider.id,
                name: error.providerRun.provider.name,
                slug: error.providerRun.provider.slug
              }
            : null,
          provider_version_id: error.providerRun?.providerVersion.id ?? null,
          created_at: error.createdAt
        })),
        created_at: group.createdAt
      };
    }),

  listRuns: app
    .handler()
    .input(
      Paginator.validate(
        v.object({
          ...telemetryScopeValidator,
          providerVersionIds: v.optional(v.array(v.string()))
        })
      )
    )
    .do(async ctx => {
      let scope = await resolveTelemetryScope(ctx.input);
      if (scope.isEmpty) return emptyList();

      let providerVersions = ctx.input.providerVersionIds?.length
        ? await db.providerVersion.findMany({
            where: { id: { in: ctx.input.providerVersionIds } },
            select: { oid: true }
          })
        : undefined;

      let paginator = Paginator.create(
        ({ prisma }) =>
          prisma(
            async opts =>
              await db.providerRun.findMany({
                ...opts,
                orderBy: createdAtOrder(ctx.input.order),
                where: {
                  providerOid: scope.provider?.oid,
                  tenantOid: oidFilter(scope.tenantOids),
                  environmentOid: oidFilter(scope.environmentOids),
                  providerVersionOid: providerVersions
                    ? { in: providerVersions.map(v => v.oid) }
                    : undefined,
                  createdAt: { gte: scope.from, lte: scope.to }
                },
                include: {
                  provider: true,
                  providerVersion: true,
                  tenant: true,
                  environment: true,
                  session: true,
                  sessionErrors: { take: 5, orderBy: { createdAt: 'desc' } }
                }
              })
          ),
        { defaultOrder: 'desc' }
      );

      let list = await paginator.run(ctx.input);
      return Paginator.presentLight(list, presentAdminRun);
    }),

  getRunLogs: app
    .handler()
    .input(
      v.object({
        providerRunId: v.string(),
        sessionMessageIds: v.optional(v.array(v.string()))
      })
    )
    .do(async ctx => {
      let providerRun = await db.providerRun.findFirstOrThrow({
        where: { id: ctx.input.providerRunId },
        include: { tenant: true, environment: true, solution: true }
      });

      return providerRunLogsService.getProviderRunLogs({
        tenant: providerRun.tenant,
        environment: providerRun.environment,
        solution: providerRun.solution,
        providerRun,
        inputs: {
          sessionMessageIds: ctx.input.sessionMessageIds
        }
      });
    }),

  listAuthLogs: app
    .handler()
    .input(
      Paginator.validate(
        v.object({
          ...telemetryScopeValidator,
          types: v.optional(
            v.array(
              v.enumOf([
                'created',
                'link_opened',
                'config_set',
                'auth_config_set',
                'oauth_setup_completed',
                'oauth_setup_failed',
                'completed',
                'expired'
              ])
            )
          )
        })
      )
    )
    .do(async ctx => {
      let scope = await resolveTelemetryScope(ctx.input);
      if (scope.isEmpty) return emptyList();

      let paginator = Paginator.create(
        ({ prisma }) =>
          prisma(
            async opts =>
              await db.providerSetupSessionEvent.findMany({
                ...opts,
                orderBy: createdAtOrder(ctx.input.order),
                where: {
                  type: ctx.input.types ? { in: ctx.input.types } : undefined,
                  session: {
                    providerOid: scope.provider?.oid,
                    tenantOid: oidFilter(scope.tenantOids),
                    environmentOid: oidFilter(scope.environmentOids)
                  },
                  createdAt: { gte: scope.from, lte: scope.to }
                },
                include: {
                  setup: {
                    select: {
                      id: true,
                      status: true,
                      name: true,
                      description: true,
                      metadata: true,
                      redirectUrl: true,
                      backendUrl: true,
                      errorCode: true,
                      errorMessage: true,
                      createdAt: true,
                      updatedAt: true,
                      expiresAt: true
                    }
                  },
                  session: {
                    select: {
                      id: true,
                      status: true,
                      typeSelected: true,
                      typeConcrete: true,
                      uiMode: true,
                      name: true,
                      description: true,
                      metadata: true,
                      redirectUrl: true,
                      createdAt: true,
                      updatedAt: true,
                      expiresAt: true,
                      provider: {
                        select: {
                          id: true,
                          name: true,
                          slug: true
                        }
                      },
                      authMethod: {
                        select: {
                          id: true,
                          name: true
                        }
                      },
                      authConfig: {
                        select: {
                          id: true
                        }
                      },
                      authCredentials: {
                        select: {
                          id: true,
                          managedCredentials: {
                            select: { id: true }
                          },
                          managedCredentialsBacking: {
                            select: {
                              managedCredentials: {
                                select: { id: true }
                              }
                            }
                          }
                        }
                      },
                      tenant: {
                        select: {
                          id: true,
                          name: true
                        }
                      },
                      environment: {
                        select: {
                          id: true,
                          name: true
                        }
                      }
                    }
                  }
                }
              })
          ),
        { defaultOrder: 'desc' }
      );

      let list = await paginator.run(ctx.input);
      return Paginator.presentLight(list, event => {
        let managedAuthCredentialsId =
          event.session.authCredentials?.managedCredentials?.id ??
          event.session.authCredentials?.managedCredentialsBacking?.managedCredentials?.id ??
          null;

        return {
          object: 'admin.provider_auth_log',
          id: event.id,
          type: event.type,
          provider: event.session.provider
            ? {
                id: event.session.provider.id,
                name: event.session.provider.name,
                slug: event.session.provider.slug
              }
            : null,
          tenant: { id: event.session.tenant.id, name: event.session.tenant.name },
          environment: {
            id: event.session.environment.id,
            name: event.session.environment.name
          },
          setup_session_id: event.session.id,
          oauth_setup_id: event.setup?.id ?? null,
          auth_method_id: event.session.authMethod?.id ?? null,
          auth_method_name: event.session.authMethod?.name ?? null,
          auth_config_id: event.session.authConfig?.id ?? null,
          auth_credentials_id: event.session.authCredentials?.id ?? null,
          managed_auth_credentials_id: managedAuthCredentialsId,
          event_ip: event.ip ?? null,
          event_user_agent: event.ua ?? null,
          setup_session: {
            id: event.session.id,
            status: event.session.status,
            type_selected: event.session.typeSelected,
            type_concrete: event.session.typeConcrete,
            ui_mode: event.session.uiMode,
            name: event.session.name,
            description: event.session.description,
            metadata: event.session.metadata,
            redirect_url: event.session.redirectUrl,
            created_at: event.session.createdAt,
            updated_at: event.session.updatedAt,
            expires_at: event.session.expiresAt
          },
          oauth_setup: event.setup
            ? {
                id: event.setup.id,
                status: event.setup.status,
                name: event.setup.name,
                description: event.setup.description,
                metadata: event.setup.metadata,
                redirect_url: event.setup.redirectUrl,
                backend_url: event.setup.backendUrl,
                error_code: event.setup.errorCode,
                error_message: event.setup.errorMessage,
                created_at: event.setup.createdAt,
                updated_at: event.setup.updatedAt,
                expires_at: event.setup.expiresAt
              }
            : null,
          created_at: event.createdAt
        };
      });
    }),

  listProviderVersionDeployments: app
    .handler()
    .input(
      Paginator.validate(
        v.object({
          ...telemetryScopeValidator,
          providerId: v.string(),
          providerVersionId: v.string()
        })
      )
    )
    .do(async ctx => {
      let scope = await resolveTelemetryScope(ctx.input);
      let provider = scope.provider!;
      let providerWithDefaults = await db.provider.findFirstOrThrow({
        where: { oid: provider.oid },
        include: {
          defaultVariant: {
            include: {
              currentVersion: true
            }
          }
        }
      });

      let providerVersion = await db.providerVersion.findFirstOrThrow({
        where: {
          providerOid: provider.oid,
          OR: [
            { id: ctx.input.providerVersionId },
            { tag: ctx.input.providerVersionId },
            { identifier: ctx.input.providerVersionId }
          ]
        }
      });

      let providerEnvironmentVersionByEnvironmentOid = new Map<bigint, bigint>();
      if (providerWithDefaults.hasEnvironments) {
        let providerEnvironments = await db.providerEnvironment.findMany({
          where: {
            providerOid: provider.oid,
            environmentOid: oidFilter(scope.environmentOids)
          },
          select: {
            environmentOid: true,
            currentVersionOid: true
          }
        });

        for (let providerEnvironment of providerEnvironments) {
          if (!providerEnvironment.currentVersionOid) continue;

          providerEnvironmentVersionByEnvironmentOid.set(
            providerEnvironment.environmentOid,
            providerEnvironment.currentVersionOid
          );
        }
      }

      if (scope.isEmpty) {
        return {
          object: 'admin.provider_version_deployments',
          provider: { id: provider.id, name: provider.name, slug: provider.slug },
          provider_version: {
            id: providerVersion.id,
            tag: providerVersion.tag,
            name: providerVersion.name,
            created_at: providerVersion.createdAt
          },
          range: { from: scope.from, to: scope.to },
          total_deployments: 0,
          items: [],
          pagination: { has_more_after: false, has_more_before: false }
        };
      }

      let deployments = await db.providerDeployment.findMany({
        where: {
          providerOid: provider.oid,
          tenantOid: oidFilter(scope.tenantOids),
          environmentOid: oidFilter(scope.environmentOids),
          isEphemeral: false,
          status: { not: 'deleted' },
          currentVersion: {
            OR: [{ lockedVersionOid: providerVersion.oid }, { lockedVersionOid: null }]
          }
        },
        include: {
          tenant: true,
          environment: true,
          currentVersion: true
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }]
      });

      deployments = deployments.filter(deployment => {
        let lockedVersionOid = deployment.currentVersion?.lockedVersionOid;
        if (lockedVersionOid) return lockedVersionOid === providerVersion.oid;

        if (providerWithDefaults.hasEnvironments) {
          return (
            providerEnvironmentVersionByEnvironmentOid.get(deployment.environmentOid) ===
            providerVersion.oid
          );
        }

        return providerWithDefaults.defaultVariant?.currentVersionOid === providerVersion.oid;
      });

      let deploymentOids = deployments.map(deployment => deployment.oid);
      let runs = deploymentOids.length
        ? await db.providerRun.findMany({
            where: {
              providerOid: provider.oid,
              providerVersionOid: providerVersion.oid,
              tenantOid: oidFilter(scope.tenantOids),
              environmentOid: oidFilter(scope.environmentOids),
              createdAt: { gte: scope.from, lte: scope.to },
              sessionProvider: {
                deploymentOid: { in: deploymentOids }
              }
            },
            select: {
              id: true,
              createdAt: true,
              sessionProvider: {
                select: {
                  deploymentOid: true
                }
              }
            },
            orderBy: [{ createdAt: 'desc' }, { id: 'desc' }]
          })
        : [];

      let usageByDeploymentOid = new Map<
        string,
        { run_count: number; last_used_at: Date; last_run_id: string }
      >();

      for (let run of runs) {
        let key = run.sessionProvider.deploymentOid.toString();
        let usage = usageByDeploymentOid.get(key);
        if (usage) {
          usage.run_count++;
          continue;
        }

        usageByDeploymentOid.set(key, {
          run_count: 1,
          last_used_at: run.createdAt,
          last_run_id: run.id
        });
      }

      let items = deployments
        .map(deployment => {
          let usage = usageByDeploymentOid.get(deployment.oid.toString());

          return {
            object: 'admin.provider_version_deployment',
            id: deployment.id,
            name: deployment.name,
            status: deployment.status,
            is_default: deployment.isDefault,
            tenant: { id: deployment.tenant.id, name: deployment.tenant.name },
            environment: {
              id: deployment.environment.id,
              name: deployment.environment.name
            },
            run_count: usage?.run_count ?? 0,
            last_used_at: usage?.last_used_at ?? null,
            last_run_id: usage?.last_run_id ?? null,
            created_at: deployment.createdAt,
            updated_at: deployment.updatedAt
          };
        })
        .sort((a, b) => {
          if (a.last_used_at && b.last_used_at) {
            let diff = b.last_used_at.getTime() - a.last_used_at.getTime();
            if (diff !== 0) return diff;
          } else if (a.last_used_at) {
            return -1;
          } else if (b.last_used_at) {
            return 1;
          }

          return b.created_at.getTime() - a.created_at.getTime() || b.id.localeCompare(a.id);
        });
      let page = paginateSortedItems(items, ctx.input);

      return {
        object: 'admin.provider_version_deployments',
        provider: { id: provider.id, name: provider.name, slug: provider.slug },
        provider_version: {
          id: providerVersion.id,
          tag: providerVersion.tag,
          name: providerVersion.name,
          created_at: providerVersion.createdAt
        },
        range: { from: scope.from, to: scope.to },
        total_deployments: deployments.length,
        items: page.items,
        pagination: page.pagination
      };
    }),

  getSession: app
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        environmentId: v.string(),
        sessionId: v.string()
      })
    )
    .do(async ctx => {
      let { tenant, environment } = await requireTenantEnvironment(ctx.input);
      let session = await db.session.findFirstOrThrow({
        where: {
          id: ctx.input.sessionId,
          tenantOid: tenant.oid,
          environmentOid: environment.oid,
          solutionOid: ctx.solution.oid
        },
        include: {
          tenant: true,
          environment: true,
          providers: {
            include: {
              provider: true,
              deployment: true,
              config: true,
              authConfig: true
            }
          }
        }
      });

      return presentSession(session);
    }),

  listSessionMessages: app
    .handler()
    .input(
      Paginator.validate(
        v.object({
          tenantId: v.string(),
          environmentId: v.string(),
          sessionId: v.string()
        })
      )
    )
    .do(async ctx => {
      let { tenant, environment } = await requireTenantEnvironment(ctx.input);
      let paginator = await sessionMessageService.listSessionMessages({
        tenant,
        environment,
        solution: ctx.solution,
        sessionIds: [ctx.input.sessionId],
        hierarchy: ['parent', 'child']
      });

      let list = await paginator.run(ctx.input);
      return Paginator.presentLight(list, sessionMessagePresenter);
    }),

  listSessionRuns: app
    .handler()
    .input(
      Paginator.validate(
        v.object({
          tenantId: v.string(),
          environmentId: v.string(),
          sessionId: v.string()
        })
      )
    )
    .do(async ctx => {
      let { tenant, environment } = await requireTenantEnvironment(ctx.input);
      let paginator = Paginator.create(({ prisma }) =>
        prisma(
          async opts =>
            await db.providerRun.findMany({
              ...opts,
              where: {
                tenantOid: tenant.oid,
                environmentOid: environment.oid,
                solutionOid: ctx.solution.oid,
                session: { id: ctx.input.sessionId }
              },
              include: {
                provider: true,
                providerVersion: true,
                tenant: true,
                environment: true,
                session: true,
                sessionErrors: { take: 5, orderBy: { createdAt: 'desc' } }
              }
            })
        )
      );

      let list = await paginator.run(ctx.input);
      return Paginator.presentLight(list, presentAdminRun);
    }),

  listSessionInvocations: app
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        environmentId: v.string(),
        sessionId: v.string()
      })
    )
    .do(async ctx => {
      let { tenant, environment } = await requireTenantEnvironment(ctx.input);
      let [runs, messages] = await Promise.all([
        db.providerRun.findMany({
          where: {
            tenantOid: tenant.oid,
            environmentOid: environment.oid,
            solutionOid: ctx.solution.oid,
            session: { id: ctx.input.sessionId }
          },
          select: { id: true }
        }),
        db.sessionMessage.findMany({
          where: {
            tenantOid: tenant.oid,
            environmentOid: environment.oid,
            solutionOid: ctx.solution.oid,
            session: { id: ctx.input.sessionId },
            providerRunOid: { not: null }
          },
          select: { id: true }
        })
      ]);

      let invocations = await providerInvocationService.listProviderInvocations({
        tenant,
        environment,
        solution: ctx.solution,
        inputs: {
          providerRunIds: runs.map(run => run.id),
          sessionMessageIds: messages.map(message => message.id)
        }
      });

      return await Promise.all(invocations.map(providerInvocationPresenter));
    }),

  getProviderInvocation: app
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        environmentId: v.string(),
        providerInvocationId: v.string()
      })
    )
    .do(async ctx => {
      let { tenant, environment } = await requireTenantEnvironment(ctx.input);
      let invocation = await providerInvocationService.getProviderInvocation({
        tenant,
        environment,
        solution: ctx.solution,
        providerInvocationId: ctx.input.providerInvocationId
      });

      return providerInvocationPresenter(invocation);
    }),

  getSessionTrace: app
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        environmentId: v.string(),
        sessionId: v.string()
      })
    )
    .do(async ctx => {
      let { tenant, environment } = await requireTenantEnvironment(ctx.input);
      let session = await db.session.findFirstOrThrow({
        where: {
          id: ctx.input.sessionId,
          tenantOid: tenant.oid,
          environmentOid: environment.oid,
          solutionOid: ctx.solution.oid
        },
        include: {
          tenant: true,
          environment: true,
          providers: {
            include: {
              provider: true,
              deployment: true,
              config: true,
              authConfig: true
            }
          }
        }
      });

      let [rawMessages, runs] = await Promise.all([
        db.sessionMessage.findMany({
          where: {
            tenantOid: tenant.oid,
            environmentOid: environment.oid,
            solutionOid: ctx.solution.oid,
            sessionOid: session.oid,
            status: { not: 'waiting_for_response' }
          },
          include: {
            session: true,
            sessionProvider: true,
            connection: true,
            providerRun: true
          },
          orderBy: { createdAt: 'asc' },
          take: 500
        }),
        db.providerRun.findMany({
          where: {
            tenantOid: tenant.oid,
            environmentOid: environment.oid,
            solutionOid: ctx.solution.oid,
            sessionOid: session.oid
          },
          include: {
            provider: true,
            providerVersion: true,
            tenant: true,
            environment: true,
            session: true,
            sessionErrors: { take: 20, orderBy: { createdAt: 'desc' } }
          },
          orderBy: { createdAt: 'asc' },
          take: 200
        })
      ]);

      let messages = await sessionMessageService.enrichMessages(rawMessages as any);
      let invocations = await providerInvocationService.listProviderInvocations({
        tenant,
        environment,
        solution: ctx.solution,
        inputs: {
          providerRunIds: runs.map(run => run.id),
          sessionMessageIds: messages.map(message => message.id)
        }
      });
      let logs = await Promise.all(
        runs.map(async run =>
          providerRunLogsService.getProviderRunLogs({
            tenant,
            environment,
            solution: ctx.solution,
            providerRun: run,
            inputs: {}
          })
        )
      );

      return {
        object: 'admin.session_trace',
        session: presentSession(session),
        messages: await Promise.all(
          messages.map(message => sessionMessagePresenter(message as any))
        ),
        runs: runs.map(presentAdminRun),
        invocations: await Promise.all(invocations.map(providerInvocationPresenter)),
        logs
      };
    }),

  compareVersions: app
    .handler()
    .input(
      v.object({
        providerId: v.string(),
        baseVersionId: v.string(),
        targetVersionId: v.string(),
        range: v.optional(dateRangeValidator)
      })
    )
    .do(async ctx => {
      let { from, to } = withDefaultRange(ctx.input.range);
      let provider = await db.provider.findFirstOrThrow({
        where: {
          OR: [
            { id: ctx.input.providerId },
            { slug: ctx.input.providerId },
            { globalIdentifier: ctx.input.providerId },
            { listing: { id: ctx.input.providerId } },
            { listing: { slug: ctx.input.providerId } }
          ]
        }
      });
      let versions = await db.providerVersion.findMany({
        where: {
          providerOid: provider.oid,
          id: { in: [ctx.input.baseVersionId, ctx.input.targetVersionId] }
        }
      });

      let summarizeVersion = async (versionId: string) => {
        let version = versions.find(v => v.id === versionId);
        if (!version) throw new Error(`Provider version not found: ${versionId}`);

        let [runs, errors, groups] = await Promise.all([
          db.providerRun.count({
            where: {
              providerOid: provider.oid,
              providerVersionOid: version.oid,
              createdAt: { gte: from, lte: to }
            }
          }),
          db.sessionError.count({
            where: {
              providerRun: {
                providerOid: provider.oid,
                providerVersionOid: version.oid
              },
              createdAt: { gte: from, lte: to }
            }
          }),
          db.sessionErrorGroup.findMany({
            where: {
              providerOid: provider.oid,
              instances: {
                some: {
                  providerRun: { providerVersionOid: version.oid },
                  createdAt: { gte: from, lte: to }
                }
              }
            },
            orderBy: { occurrenceCount: 'desc' },
            take: 10
          })
        ]);

        return {
          id: version.id,
          tag: version.tag,
          name: version.name,
          created_at: version.createdAt,
          runs,
          errors,
          error_rate: runs > 0 ? errors / runs : 0,
          top_error_groups: groups.map(group => ({
            id: group.id,
            type: group.type,
            code: group.code,
            message: group.message,
            occurrence_count: group.occurrenceCount
          }))
        };
      };

      let [base, target] = await Promise.all([
        summarizeVersion(ctx.input.baseVersionId),
        summarizeVersion(ctx.input.targetVersionId)
      ]);

      return {
        object: 'admin.provider_version_regression',
        provider: { id: provider.id, name: provider.name, slug: provider.slug },
        range: { from, to },
        base,
        target,
        delta: {
          runs: target.runs - base.runs,
          errors: target.errors - base.errors,
          error_rate: target.error_rate - base.error_rate
        }
      };
    })
});
