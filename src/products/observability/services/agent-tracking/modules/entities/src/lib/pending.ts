import type { Entity } from '@mtsrc/agent-tracking-db';
import { withTransaction } from '@mtsrc/agent-tracking-db';
import { getId } from '@mtsrc/agent-tracking-db';
import { normalizeEmail } from './normalize';
import { Events } from '@mtsrc/agent-tracking-events';

export let applyPendingMemberships = async (d: {
  organizationOid: bigint;
  userEntity: Pick<Entity, 'oid' | 'id' | 'kind'>;
  emails: string[];
}) => {
  if (d.userEntity.kind != 'user' || !d.emails.length) return [];

  let emails = [...new Set(d.emails.map(normalizeEmail))];

  let applied = await withTransaction(async db => {
    let pending = await db.pendingMembership.findMany({
      where: { organizationOid: d.organizationOid, email: { in: emails } },
      include: { targetEntity: true }
    });

    let links = [];

    for (let membership of pending) {
      let { count } = await db.pendingMembership.deleteMany({
        where: { oid: membership.oid }
      });
      if (!count) continue;

      let target = membership.targetEntity;
      if (target.status != 'managed' && target.status != 'discovered') continue;

      let active = await db.entityLink.findFirst({
        where: {
          fromOid: d.userEntity.oid,
          toOid: target.oid,
          type: membership.type,
          validTo: null
        }
      });
      if (active) continue;

      links.push(
        await db.entityLink.create({
          data: {
            ...getId('entityLink'),
            type: membership.type,
            origin: 'manual',
            weight: membership.weight,
            validFrom: membership.validFrom,
            organizationOid: d.organizationOid,
            fromOid: d.userEntity.oid,
            toOid: target.oid
          },
          include: { to: true }
        })
      );
    }

    if (!links.length) return { links, organization: null };

    let organization = await db.organization.findUniqueOrThrow({
      where: { oid: d.organizationOid }
    });

    return { links, organization };
  });

  if (applied.organization) {
    let since = new Date(Math.min(...applied.links.map(link => link.validFrom.getTime())));

    await Events.fire('entities.links.changed:after', {
      organizationId: applied.organization.id,
      entityIds: [d.userEntity.id, ...applied.links.map(link => link.to.id)],
      since
    });
  }

  return applied.links;
};
