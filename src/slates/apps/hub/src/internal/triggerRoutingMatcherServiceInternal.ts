import { Service } from '@lowerdeck/service';
import type { SlatesTriggerRoutingMatcher } from '@slates/proto';
import type { SlateWebhookRegistration } from '../../prisma/generated/client';
import { db } from '../db';
import { getId, snowflake } from '../id';
import { prepareMatchers, type PreparedMatcher } from '../lib/triggerRoutingMatcherSerialize';

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
      'oid' | 'type' | 'tenantOid' | 'triggerGroupOid'
    >;
    events: TEvent[];
  }) {
    let registration = d.webhookRegistration;
    if (registration.type !== 'manual') return [];

    let preparedByEvent = new Map<TEvent, PreparedMatcher[]>();
    let hashes = new Set<string>();

    for (let event of d.events) {
      let prepared = await prepareMatchers(event.matchers);
      if (prepared.length === 0) continue;

      preparedByEvent.set(event, prepared);
      for (let matcher of prepared) hashes.add(matcher.hash);
    }

    if (hashes.size === 0) return [];

    let isSubscribed = {
      triggerRegistrationInstance: {
        triggerRegistration: { status: { not: 'deleted' as const } },
        webhooks: { some: { webhookRegistrationOid: registration.oid } }
      }
    };

    let matchers = await db.triggerRoutingMatcher.findMany({
      where: {
        triggerGroupOid: registration.triggerGroupOid,
        hash: { in: [...hashes] },
        tenantOid: registration.tenantOid ?? undefined,
        instances: { some: isSubscribed }
      },
      select: {
        hash: true,
        instances: { where: isSubscribed, select: { triggerRegistrationInstanceOid: true } }
      }
    });

    // A global registration has no tenant filter, so one hash can come back as several rows - one
    // per tenant that identifies itself the same way - and they all route.
    let instanceOidsByHash = new Map<string, bigint[]>();

    for (let matcher of matchers) {
      let instanceOids = instanceOidsByHash.get(matcher.hash) ?? [];
      instanceOids.push(...matcher.instances.map(i => i.triggerRegistrationInstanceOid));
      instanceOidsByHash.set(matcher.hash, instanceOids);
    }

    let matched: { event: TEvent; triggerRegistrationInstanceOids: bigint[] }[] = [];

    for (let [event, prepared] of preparedByEvent) {
      let instanceOids = new Set<bigint>();

      for (let matcher of prepared) {
        for (let oid of instanceOidsByHash.get(matcher.hash) ?? []) instanceOids.add(oid);
      }

      if (instanceOids.size === 0) continue;

      matched.push({ event, triggerRegistrationInstanceOids: [...instanceOids] });
    }

    return matched;
  }
}

export let triggerRoutingMatcherServiceInternal = Service.create(
  'triggerRoutingMatcherServiceInternal',
  () => new TriggerRoutingMatcherServiceInternalImpl()
).build();
