import { badRequestError, notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import type { Entity, EntityLink, Organization, Prisma } from '@mtsrc/agent-tracking-db';
import { db, withTransaction } from '@mtsrc/agent-tracking-db';
import {
  isLinkAllowed,
  reachSince,
  type LinkOrigin,
  type LinkReach,
  type LinkType
} from '../lib/linkRules';
import { getId } from '@mtsrc/agent-tracking-db';
import { Events } from '@mtsrc/agent-tracking-events';

export let linkInclude = { from: true, to: true } satisfies Prisma.EntityLinkInclude;

export type LinkWithEntities = Prisma.EntityLinkGetPayload<{ include: typeof linkInclude }>;

let originRank: Record<string, number> = { classifier: 0, observed: 1, sync: 2, manual: 3 };

let keepStrongerOrigin = (current: string, incoming: string) =>
  (originRank[incoming] ?? 0) >= (originRank[current] ?? 0) ? incoming : current;

let endAt = (link: Pick<EntityLink, 'validFrom'>, since: Date) =>
  since > link.validFrom ? since : link.validFrom;

class LinkServiceImpl {
  async upsertLink(d: {
    organization: Organization;
    from: Entity;
    to: Entity;
    input: { type: LinkType; origin?: LinkOrigin; weight?: number | null; reach: LinkReach };
  }) {
    this.assertLinkAllowed({ from: d.from, to: d.to, type: d.input.type });

    let since = reachSince(d.input.reach);
    let origin = d.input.origin ?? 'manual';

    let { link, changed } = await withTransaction(async db => {
      let active = await db.entityLink.findFirst({
        where: { fromOid: d.from.oid, toOid: d.to.oid, type: d.input.type, validTo: null },
        orderBy: { validFrom: 'asc' }
      });

      if (!active) {
        let link = await db.entityLink.create({
          data: {
            ...getId('entityLink'),
            type: d.input.type,
            origin,
            weight: d.input.weight ?? null,
            validFrom: since,
            organizationOid: d.organization.oid,
            fromOid: d.from.oid,
            toOid: d.to.oid
          },
          include: linkInclude
        });

        return { link, changed: true };
      }

      let weight = d.input.weight === undefined ? active.weight : d.input.weight;
      let validFrom = since < active.validFrom ? since : active.validFrom;
      let nextOrigin = keepStrongerOrigin(active.origin, origin);

      let changed =
        weight != active.weight ||
        validFrom.getTime() != active.validFrom.getTime() ||
        nextOrigin != active.origin;

      let link = await db.entityLink.update({
        where: { oid: active.oid },
        data: { weight, validFrom, origin: nextOrigin },
        include: linkInclude
      });

      return { link, changed };
    });

    if (changed) {
      await Events.fire('entities.links.changed:after', {
        organizationId: d.organization.id,
        entityIds: [d.from.id, d.to.id],
        since
      });
    }

    return link;
  }

  async replaceLinkSet(d: {
    organization: Organization;
    to: Entity;
    input: {
      type: LinkType;
      origin?: LinkOrigin;
      reach: LinkReach;
      members: { entity: Entity; weight?: number | null }[];
    };
  }) {
    let members = new Map(d.input.members.map(member => [member.entity.oid, member]));
    for (let member of members.values()) {
      this.assertLinkAllowed({ from: member.entity, to: d.to, type: d.input.type });
    }

    let since = reachSince(d.input.reach);
    let origin = d.input.origin ?? 'manual';

    let result = await withTransaction(async db => {
      let active = await db.entityLink.findMany({
        where: { toOid: d.to.oid, type: d.input.type, validTo: null },
        include: linkInclude
      });

      let added: LinkWithEntities[] = [];
      let removed: LinkWithEntities[] = [];
      let kept: LinkWithEntities[] = [];
      let changed: LinkWithEntities[] = [];

      for (let link of active) {
        let member = members.get(link.fromOid);

        if (!member) {
          removed.push(
            await db.entityLink.update({
              where: { oid: link.oid },
              data: { validTo: endAt(link, since) },
              include: linkInclude
            })
          );
          continue;
        }

        let weight = member.weight === undefined ? link.weight : member.weight;
        if (weight == link.weight) {
          kept.push(link);
          continue;
        }

        changed.push(
          await db.entityLink.update({
            where: { oid: link.oid },
            data: { weight, origin: keepStrongerOrigin(link.origin, origin) },
            include: linkInclude
          })
        );
      }

      let linked = new Set(active.map(link => link.fromOid));

      for (let member of members.values()) {
        if (linked.has(member.entity.oid)) continue;

        added.push(
          await db.entityLink.create({
            data: {
              ...getId('entityLink'),
              type: d.input.type,
              origin,
              weight: member.weight ?? null,
              validFrom: since,
              organizationOid: d.organization.oid,
              fromOid: member.entity.oid,
              toOid: d.to.oid
            },
            include: linkInclude
          })
        );
      }

      return { added, removed, kept, changed };
    });

    let touched = [...result.added, ...result.removed, ...result.changed];

    if (touched.length) {
      await Events.fire('entities.links.changed:after', {
        organizationId: d.organization.id,
        entityIds: [d.to.id, ...new Set(touched.map(link => link.from.id))],
        since
      });
    }

    return result;
  }

  async endLink(d: { organization: Organization; link: LinkWithEntities; reach: LinkReach }) {
    if (d.link.validTo) return d.link;

    let since = reachSince(d.reach);

    let link = await db.entityLink.update({
      where: { oid: d.link.oid },
      data: { validTo: endAt(d.link, since) },
      include: linkInclude
    });

    await Events.fire('entities.links.changed:after', {
      organizationId: d.organization.id,
      entityIds: [link.from.id, link.to.id],
      since
    });

    return link;
  }

  async getLinkById(d: { organization: Organization; linkId: string }) {
    let link = await db.entityLink.findFirst({
      where: { id: d.linkId, organizationOid: d.organization.oid },
      include: linkInclude
    });
    if (!link) throw new ServiceError(notFoundError('entity_link', d.linkId));

    return link;
  }

  async listLinks(d: {
    organization: Organization;
    fromId?: string;
    toId?: string;
    types?: string[];
    includeEnded?: boolean;
  }) {
    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.entityLink.findMany({
            ...opts,
            where: {
              organizationOid: d.organization.oid,
              from: d.fromId ? { id: d.fromId } : undefined,
              to: d.toId ? { id: d.toId } : undefined,
              type: d.types ? { in: d.types } : undefined,
              validTo: d.includeEnded ? undefined : null
            },
            include: linkInclude
          })
      )
    );
  }

  private assertLinkAllowed(d: { from: Entity; to: Entity; type: string }) {
    if (d.from.oid == d.to.oid) {
      throw new ServiceError(
        badRequestError({ message: 'An entity cannot be linked to itself.' })
      );
    }

    for (let entity of [d.from, d.to]) {
      if (entity.status != 'managed' && entity.status != 'discovered') {
        throw new ServiceError(
          badRequestError({ message: `The entity ${entity.id} is ${entity.status}.` })
        );
      }
    }

    if (!isLinkAllowed({ type: d.type, fromKind: d.from.kind, toKind: d.to.kind })) {
      throw new ServiceError(
        badRequestError({
          message: `A ${d.from.kind} cannot be linked ${d.type} a ${d.to.kind}.`
        })
      );
    }
  }
}

export let linkService = Service.create('linkService', () => new LinkServiceImpl()).build();
