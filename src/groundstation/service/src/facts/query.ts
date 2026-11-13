import { preconditionFailedError, ServiceError } from '@lowerdeck/error';
import { Service } from '@lowerdeck/service';
import mongoose from 'mongoose';
import type { Organization } from '../../prisma/generated/client';
import { getDimensionMaps } from '../knowledge/dimensions';
import { getStore, isStoreConfigured } from '../store/connection';
import type { UsageSliceDocument } from '../store/derivedModels';
import { resolveQueryScope, type QueryScope } from './scope';
import {
  buildSessionPipeline,
  buildTopSessionsQuery,
  finalizeSessionGroups,
  validateSessionQuery,
  type SessionGroupRow,
  type SessionQuery
} from './sessionQuery';
import {
  buildUsagePipelines,
  finalizeUsageRows,
  usesDimensions,
  validateUsageQuery,
  type ReportedCostRow,
  type UsageGroupRow,
  type UsageQuery
} from './usageQuery';

let queryTimeoutMs = 30_000;

let decimal = (value: unknown) =>
  value === undefined || value === null ? null : Number.parseFloat(String(value));

class UsageQueryServiceImpl {
  async queryUsage(d: {
    organization: Organization;
    scope?: QueryScope;
    query: Omit<UsageQuery, 'organizationId' | 'projectIds' | 'instanceIds'>;
  }) {
    let scope = await resolveQueryScope({ organization: d.organization, scope: d.scope });
    let query: UsageQuery = { ...d.query, ...scope, organizationId: d.organization.id };
    validateUsageQuery(query);

    let collections = await this.collections();
    let dimensions = usesDimensions(query)
      ? {
          maps: await getDimensionMaps(),
          unresolvedRaws: query.filters['model.lab']
            ? await this.unresolvedRaws(collections, query)
            : []
        }
      : undefined;
    let pipelines = buildUsagePipelines(query, dimensions);

    let [rows, reported] = await Promise.all([
      collections.usageSlices
        .aggregate<UsageGroupRow>(pipelines.main, { maxTimeMS: queryTimeoutMs })
        .toArray(),
      pipelines.reported
        ? collections.usageSlices
            .aggregate<ReportedCostRow>(pipelines.reported, { maxTimeMS: queryTimeoutMs })
            .toArray()
        : []
    ]);

    let result = finalizeUsageRows({ query, rows, reported, maps: dimensions?.maps });

    return {
      interval: query.interval ?? null,
      timeZone: query.timeZone ?? 'UTC',
      allocation: query.allocation,
      ...result
    };
  }

  async querySessions(d: {
    organization: Organization;
    scope?: QueryScope;
    query: Omit<SessionQuery, 'organizationId' | 'projectIds' | 'instanceIds'>;
  }) {
    let scope = await resolveQueryScope({ organization: d.organization, scope: d.scope });
    let query: SessionQuery = { ...d.query, ...scope, organizationId: d.organization.id };
    validateSessionQuery(query);

    let collections = await this.collections();
    let top = buildTopSessionsQuery(query);

    let [rows, topSessions] = await Promise.all([
      collections.sessions
        .aggregate<SessionGroupRow>(buildSessionPipeline(query), { maxTimeMS: queryTimeoutMs })
        .toArray(),
      top
        ? collections.sessions
            .find(top.filter, {
              projection: {
                _id: 1,
                instanceId: 1,
                startedAt: 1,
                client: 1,
                'observed.userId': 1,
                'observed.agentId': 1,
                'summary.costUsd': 1,
                'summary.requests': 1,
                'summary.durationMs': 1,
                'summary.turns': 1
              },
              maxTimeMS: queryTimeoutMs
            })
            .sort(top.sort)
            .limit(top.limit)
            .toArray()
        : null
    ]);

    return {
      groups: finalizeSessionGroups(query, rows),
      top:
        topSessions?.map(session => ({
          sessionKey: session._id,
          instanceId: session.instanceId,
          startedAt: session.startedAt,
          client: session.client,
          userId: session.observed?.userId ?? null,
          agentId: session.observed?.agentId ?? null,
          costUsd: decimal(session.summary?.costUsd),
          requests: session.summary?.requests ?? null,
          durationMs: session.summary?.durationMs ?? null,
          turns: session.summary?.turns ?? null
        })) ?? null
    };
  }

  private async unresolvedRaws(
    collections: Awaited<ReturnType<UsageQueryServiceImpl['collections']>>,
    query: UsageQuery
  ) {
    let unresolved = {
      organizationId: query.organizationId,
      modelId: null,
      bucket: { $gte: query.range.from, $lt: query.range.to }
    } as unknown as mongoose.mongo.Filter<UsageSliceDocument>;
    let raws = await collections.usageSlices.distinct('modelRaw', unresolved, {
      maxTimeMS: queryTimeoutMs
    });

    return raws.filter((raw): raw is string => typeof raw == 'string');
  }

  private async collections() {
    if (!isStoreConfigured()) {
      throw new ServiceError(
        preconditionFailedError({ message: 'Usage queries need the record store.' })
      );
    }

    let store = getStore();
    await store.ready();

    return store.collections();
  }
}

export let usageQueryService = Service.create(
  'usageQueryService',
  () => new UsageQueryServiceImpl()
).build();
