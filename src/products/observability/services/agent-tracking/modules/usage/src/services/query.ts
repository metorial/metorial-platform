import { preconditionFailedError, ServiceError } from '@lowerdeck/error';
import { Service } from '@lowerdeck/service';
import mongoose from 'mongoose';
import type { Organization } from '@mtsrc/agent-tracking-db';
import { knowledgeCacheService } from '@mtsrc/agent-tracking-module-knowledge';
import { getStore, isStoreConfigured } from '@mtsrc/agent-tracking-store';
import type { UsageSliceDocument } from '@mtsrc/agent-tracking-store';
import { resolveQueryScope, type QueryScope } from '../lib/scope';
import {
  buildUsagePipelines,
  finalizeUsageRows,
  usesDimensions,
  validateUsageQuery,
  type ReportedCostRow,
  type UsageGroupRow,
  type UsageQuery
} from '../lib/usageQuery';

let queryTimeoutMs = 30_000;

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
          maps: await knowledgeCacheService.getDimensionMaps(),
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
