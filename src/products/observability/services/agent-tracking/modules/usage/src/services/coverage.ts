import { badRequestError, preconditionFailedError, ServiceError } from '@lowerdeck/error';
import { Service } from '@lowerdeck/service';
import type mongoose from 'mongoose';
import type { Organization } from '@mtsrc/agent-tracking-db';
import { getStore, isStoreConfigured } from '@mtsrc/agent-tracking-store';
import type { SessionDocument, SourceHealthDocument } from '@mtsrc/agent-tracking-store';
import {
  buildCoverage,
  type CoverageSessionTotals,
  type SourceSessionCounts
} from '../lib/coverageReport';
import { instanceIdsOfScope, resolveQueryScope, type QueryScope } from '../lib/scope';

let queryTimeoutMs = 30_000;

let maxSources = 5000;

let maxRangeDays = 400;

let dayMs = 24 * 60 * 60 * 1000;

class CoverageServiceImpl {
  async getCoverage(d: {
    organization: Organization;
    scope?: QueryScope;
    range: { from: Date; to: Date };
  }) {
    this.assertRange(d.range);

    let scope = await resolveQueryScope({ organization: d.organization, scope: d.scope });
    let instanceIds = await instanceIdsOfScope({ organization: d.organization, scope });
    let collections = await this.collections();

    let scoped = {
      organizationId: d.organization.id,
      ...(instanceIds ? { instanceId: { $in: instanceIds } } : {})
    };

    let sessionFilter = {
      ...scoped,
      startedAt: { $gte: d.range.from, $lt: d.range.to }
    } as mongoose.mongo.Filter<SessionDocument>;

    let [health, sourceSessions, totals, sessionlessSlices] = await Promise.all([
      collections.sourceHealth
        .find({
          ...scoped,
          updatedAt: { $gte: d.range.from }
        } as mongoose.mongo.Filter<SourceHealthDocument>)
        .sort({ updatedAt: -1 })
        .limit(maxSources)
        .maxTimeMS(queryTimeoutMs)
        .toArray(),
      collections.sessions
        .aggregate<SourceSessionCounts & { _id: unknown }>(
          [
            { $match: sessionFilter },
            {
              $group: {
                _id: {
                  instanceId: '$instanceId',
                  actorKey: { $ifNull: ['$observed.deviceId', '$observed.userId'] },
                  family: '$client.family'
                },
                sessions: { $sum: 1 },
                withoutUsage: this.missing('$coverage.hasUsage')
              }
            },
            { $match: { '_id.actorKey': { $ne: null } } },
            {
              $project: {
                instanceId: '$_id.instanceId',
                actorKey: '$_id.actorKey',
                family: '$_id.family',
                sessions: 1,
                withoutUsage: 1
              }
            }
          ],
          { maxTimeMS: queryTimeoutMs }
        )
        .toArray(),
      collections.sessions
        .aggregate<CoverageSessionTotals>(
          [
            { $match: sessionFilter },
            {
              $group: {
                _id: null,
                total: { $sum: 1 },
                withoutUsage: this.missing('$coverage.hasUsage'),
                withoutContext: this.missing('$coverage.hasContext'),
                withoutRepo: this.missing('$coverage.hasRepo'),
                notFullyAttributed: this.missing('$coverage.fullyAttributed')
              }
            },
            { $project: { _id: 0 } }
          ],
          { maxTimeMS: queryTimeoutMs }
        )
        .toArray(),
      collections.usageSlices.countDocuments(
        {
          ...scoped,
          sessionlessKey: { $exists: true },
          bucket: { $gte: d.range.from, $lt: d.range.to }
        },
        { maxTimeMS: queryTimeoutMs }
      )
    ]);

    return buildCoverage({
      range: d.range,
      health,
      sourceSessions,
      sessions: totals[0] ?? {
        total: 0,
        withoutUsage: 0,
        withoutContext: 0,
        withoutRepo: 0,
        notFullyAttributed: 0
      },
      sessionlessSlices
    });
  }

  private missing(field: string) {
    return { $sum: { $cond: [{ $eq: [field, true] }, 0, 1] } };
  }

  private assertRange(range: { from: Date; to: Date }) {
    if (range.to <= range.from) {
      throw new ServiceError(
        badRequestError({ message: 'range.to must be after range.from.' })
      );
    }

    if (range.to.getTime() - range.from.getTime() > maxRangeDays * dayMs) {
      throw new ServiceError(
        badRequestError({ message: `Coverage ranges are limited to ${maxRangeDays} days.` })
      );
    }
  }

  private async collections() {
    if (!isStoreConfigured()) {
      throw new ServiceError(
        preconditionFailedError({ message: 'Coverage needs the record store.' })
      );
    }

    let store = getStore();
    await store.ready();

    return store.collections();
  }
}

export let coverageService = Service.create(
  'coverageService',
  () => new CoverageServiceImpl()
).build();
