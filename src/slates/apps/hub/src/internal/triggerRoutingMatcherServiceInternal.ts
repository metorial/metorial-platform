import { Service } from '@lowerdeck/service';
import type { SlatesTriggerRoutingMatcher } from '@slates/proto';
import type {
  SlateWebhookRegistration,
  TriggerRoutingDropReason
} from '../../prisma/generated/client';
import { db } from '../db';
import { getId, snowflake } from '../id';
import { prepareMatchers, type PreparedMatcher } from '../lib/triggerRoutingMatcherSerialize';
import { triggerRoutingDropServiceInternal } from './triggerRoutingDropServiceInternal';

class TriggerRoutingMatcherServiceInternalImpl {
  private async ensureMatcher(d: {
    tenantOid: bigint;
    triggerGroupOid: bigint;
    hash: string;
    values: SlatesTriggerRoutingMatcher;
  }) {
    let where = {
      tenantOid_triggerGroupOid_hash: {
        tenantOid: d.tenantOid,
        triggerGroupOid: d.triggerGroupOid,
        hash: d.hash
      }
    };

    try {
      return await db.triggerRoutingMatcher.upsert({
        where,
        create: {
          ...getId('triggerRoutingMatcher'),
          tenantOid: d.tenantOid,
          triggerGroupOid: d.triggerGroupOid,
          hash: d.hash,
          values: d.values
        },
        update: {},
        select: { oid: true }
      });
    } catch (err: any) {
      if (err.code !== 'P2002') throw err;
      return db.triggerRoutingMatcher.findUniqueOrThrow({ where, select: { oid: true } });
    }
  }

  async countInstanceMatchers(d: { triggerRegistrationInstanceOid: bigint }) {
    return db.triggerRegistrationInstanceRoutingMatcher.count({
      where: { triggerRegistrationInstanceOid: d.triggerRegistrationInstanceOid }
    });
  }

  async setInstanceMatchers(d: {
    tenantOid: bigint;
    triggerGroupOid: bigint;
    triggerRegistrationInstanceOid: bigint;
    matchers: SlatesTriggerRoutingMatcher[] | null | undefined;
  }) {
    let prepared = await prepareMatchers(d.matchers);

    let matcherOids = await Promise.all(
      prepared.map(async matcher => {
        let row = await this.ensureMatcher({
          tenantOid: d.tenantOid,
          triggerGroupOid: d.triggerGroupOid,
          hash: matcher.hash,
          values: matcher.values
        });
        return row.oid;
      })
    );

    await db.$transaction(async db => {
      if (matcherOids.length > 0) {
        await db.triggerRegistrationInstanceRoutingMatcher.createMany({
          skipDuplicates: true,
          data: matcherOids.map(matcherOid => ({
            oid: snowflake.nextId(),
            triggerRegistrationInstanceOid: d.triggerRegistrationInstanceOid,
            matcherOid
          }))
        });
      }

      await db.triggerRegistrationInstanceRoutingMatcher.deleteMany({
        where: {
          triggerRegistrationInstanceOid: d.triggerRegistrationInstanceOid,
          matcherOid: matcherOids.length > 0 ? { notIn: matcherOids } : undefined
        }
      });
    });

    return matcherOids.length;
  }

  async matchWebhookEvents<TEvent extends { matchers: SlatesTriggerRoutingMatcher[] }>(d: {
    webhookRegistration: Pick<
      SlateWebhookRegistration,
      'id' | 'oid' | 'type' | 'owner' | 'status' | 'tenantOid' | 'triggerGroupOid'
    >;
    events: TEvent[];
  }) {
    let registration = d.webhookRegistration;
    if (d.events.length === 0) return [];

    let recordDrop = (d2: {
      reason: TriggerRoutingDropReason;
      count: number;
      lastMatchers?: SlatesTriggerRoutingMatcher[] | null;
    }) =>
      triggerRoutingDropServiceInternal.recordDrop({
        webhookRegistration: registration,
        ...d2
      });

    if (registration.type !== 'manual') {
      await recordDrop({ reason: 'registration_not_matchable', count: d.events.length });
      return [];
    }

    if (registration.status !== 'active') {
      await recordDrop({ reason: 'registration_inactive', count: d.events.length });
      return [];
    }

    if (registration.owner === 'tenant' && !registration.tenantOid) {
      throw new Error(
        `Webhook registration ${registration.id} is tenant-owned without a tenant`
      );
    }

    let tenantOid = registration.owner === 'tenant' ? registration.tenantOid! : undefined;

    let preparedByEvent = new Map<TEvent, PreparedMatcher[]>();
    let hashes = new Set<string>();
    let unroutable: TEvent[] = [];

    for (let event of d.events) {
      let prepared = await prepareMatchers(event.matchers);
      if (prepared.length === 0) {
        unroutable.push(event);
        continue;
      }

      preparedByEvent.set(event, prepared);
      for (let matcher of prepared) hashes.add(matcher.hash);
    }

    await recordDrop({
      reason: 'no_matcher',
      count: unroutable.length,
      lastMatchers: unroutable.at(-1)?.matchers
    });

    if (hashes.size === 0) return [];

    let isSubscribed = {
      triggerRegistrationInstance: {
        triggerGroupOid: registration.triggerGroupOid,
        triggerRegistration: { status: { not: 'deleted' as const }, tenantOid },
        webhooks: { some: { webhookRegistrationOid: registration.oid } }
      }
    };

    let matchers = await db.triggerRoutingMatcher.findMany({
      where: {
        triggerGroupOid: registration.triggerGroupOid,
        hash: { in: [...hashes] },
        tenantOid,
        instances: { some: isSubscribed }
      },
      select: {
        hash: true,
        tenantOid: true,
        instances: {
          where: isSubscribed,
          select: {
            triggerRegistrationInstanceOid: true,
            triggerRegistrationInstance: {
              select: { triggerRegistration: { select: { tenantOid: true } } }
            }
          }
        }
      }
    });

    let instanceOidsByHash = new Map<string, bigint[]>();

    for (let matcher of matchers) {
      let instanceOids = instanceOidsByHash.get(matcher.hash) ?? [];

      for (let instance of matcher.instances) {
        let instanceTenantOid =
          instance.triggerRegistrationInstance.triggerRegistration.tenantOid;
        if (instanceTenantOid !== matcher.tenantOid) continue;

        instanceOids.push(instance.triggerRegistrationInstanceOid);
      }

      instanceOidsByHash.set(matcher.hash, instanceOids);
    }

    let matched: { event: TEvent; triggerRegistrationInstanceOids: bigint[] }[] = [];
    let unclaimed: TEvent[] = [];

    for (let [event, prepared] of preparedByEvent) {
      let instanceOids = new Set<bigint>();

      for (let matcher of prepared) {
        for (let oid of instanceOidsByHash.get(matcher.hash) ?? []) instanceOids.add(oid);
      }

      if (instanceOids.size === 0) {
        unclaimed.push(event);
        continue;
      }

      matched.push({ event, triggerRegistrationInstanceOids: [...instanceOids] });
    }

    await recordDrop({
      reason: 'no_match',
      count: unclaimed.length,
      lastMatchers: unclaimed.at(-1)?.matchers
    });

    return matched;
  }
}

export let triggerRoutingMatcherServiceInternal = Service.create(
  'triggerRoutingMatcherServiceInternal',
  () => new TriggerRoutingMatcherServiceInternalImpl()
).build();
