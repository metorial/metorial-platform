import { badRequestError, ServiceError } from '@lowerdeck/error';
import { Service } from '@lowerdeck/service';
import type { Entity, Organization, PendingMembership } from '@mtsrc/agent-tracking-db';
import { db, withTransaction } from '@mtsrc/agent-tracking-db';
import { isLinkAllowed, reachSince, type LinkReach, type LinkType } from '../lib/linkRules';
import {
  diffMembers,
  groupRowsByTeam,
  parseMembershipCsv,
  type CurrentMember,
  type DesiredMember
} from '../lib/membershipCsv';
import { normalizeEmail } from '../lib/normalize';
import { followMerged } from '../lib/resolve';
import { getId } from '@mtsrc/agent-tracking-db';
import { linkService, type LinkWithEntities } from './link';

let maxReportedCsvErrors = 20;

export type MemberInput = { email?: string; userId?: string; weight?: number | null };

type ResolvedMembers = {
  users: { entity: Entity; email: string | null; weight?: number | null }[];
  unknownEmails: { email: string; weight?: number | null }[];
};

export type MembershipImportTeam = {
  target: Entity;
  desired: DesiredMember[];
  added: { email: string; userId: string }[];
  pending: { email: string }[];
  removed: { email: string | null; userId: string | null }[];
  changed: { email: string; weight: number | null }[];
  unchanged: number;
};

class MembershipServiceImpl {
  async replaceMemberships(d: {
    organization: Organization;
    target: Entity;
    input: { type?: LinkType; members: MemberInput[]; reach: LinkReach };
  }) {
    let type = d.input.type ?? 'member_of';
    this.assertTarget({ target: d.target, type });

    let members = await this.resolveMembers({
      organization: d.organization,
      members: d.input.members
    });
    let since = reachSince(d.input.reach);

    return await withTransaction(async db => {
      let links = await linkService.replaceLinkSet({
        organization: d.organization,
        to: d.target,
        input: {
          type,
          reach: d.input.reach,
          members: members.users.map(user => ({ entity: user.entity, weight: user.weight }))
        }
      });

      await db.pendingMembership.deleteMany({
        where: {
          targetEntityOid: d.target.oid,
          type,
          email: { notIn: members.unknownEmails.map(member => member.email) }
        }
      });

      let pending = await this.upsertPending({
        organization: d.organization,
        target: d.target,
        type,
        since,
        members: members.unknownEmails
      });

      return { ...links, pending, pendingRemoved: [] as string[] };
    });
  }

  async updateMemberships(d: {
    organization: Organization;
    target: Entity;
    input: { type?: LinkType; add: MemberInput[]; remove: MemberInput[]; reach: LinkReach };
  }) {
    let type = d.input.type ?? 'member_of';
    this.assertTarget({ target: d.target, type });

    let add = await this.resolveMembers({
      organization: d.organization,
      members: d.input.add
    });
    let remove = await this.resolveMembers({
      organization: d.organization,
      members: d.input.remove
    });
    let since = reachSince(d.input.reach);

    return await withTransaction(async db => {
      let added: LinkWithEntities[] = [];
      let removed: LinkWithEntities[] = [];

      for (let user of add.users) {
        added.push(
          await linkService.upsertLink({
            organization: d.organization,
            from: user.entity,
            to: d.target,
            input: { type, origin: 'manual', weight: user.weight, reach: d.input.reach }
          })
        );
      }

      for (let user of remove.users) {
        let active = await db.entityLink.findMany({
          where: { fromOid: user.entity.oid, toOid: d.target.oid, type, validTo: null },
          include: { from: true, to: true }
        });

        for (let link of active) {
          removed.push(
            await linkService.endLink({
              organization: d.organization,
              link,
              reach: d.input.reach
            })
          );
        }
      }

      let pendingRemoved = [
        ...remove.unknownEmails.map(member => member.email),
        ...remove.users.map(user => user.email).filter((email): email is string => !!email)
      ];

      await db.pendingMembership.deleteMany({
        where: { targetEntityOid: d.target.oid, type, email: { in: pendingRemoved } }
      });

      let pending = await this.upsertPending({
        organization: d.organization,
        target: d.target,
        type,
        since,
        members: add.unknownEmails
      });

      return { added, removed, kept: [], changed: [], pending, pendingRemoved };
    });
  }

  async importMemberships(d: {
    organization: Organization;
    input: { csv: string; dryRun: boolean; kind?: string; type?: LinkType; reach: LinkReach };
  }) {
    let kind = d.input.kind ?? 'team';
    let type = d.input.type ?? 'member_of';

    let { rows, errors } = parseMembershipCsv(d.input.csv);
    if (errors.length && !d.input.dryRun) {
      throw new ServiceError(
        badRequestError({
          message: `The CSV has invalid rows: ${errors
            .slice(0, maxReportedCsvErrors)
            .map(error => `line ${error.line}: ${error.message}`)
            .join('; ')}`
        })
      );
    }

    let groups = groupRowsByTeam(rows);
    let teams: MembershipImportTeam[] = [];
    let unknownTeams: string[] = [];

    for (let [name, desired] of groups) {
      let target = await this.findTargetByName({ organization: d.organization, kind, name });
      if (!target) {
        unknownTeams.push(name);
        continue;
      }

      this.assertTarget({ target, type });

      let current = await this.currentMembers({ target, type });
      let diff = diffMembers({ current, desired });
      let resolved = await this.resolveMembers({
        organization: d.organization,
        members: diff.added.map(member => ({ email: member.email }))
      });

      teams.push({
        target,
        desired,
        added: resolved.users.map(user => ({ email: user.email!, userId: user.entity.id })),
        pending: resolved.unknownEmails.map(member => ({ email: member.email })),
        removed: diff.removed.map(member => ({ email: member.email, userId: member.userId })),
        changed: diff.changed.map(member => ({
          email: member.email,
          weight: member.weight ?? null
        })),
        unchanged: diff.kept.length
      });
    }

    if (!d.input.dryRun && unknownTeams.length) {
      throw new ServiceError(
        badRequestError({ message: `Unknown ${kind} entities: ${unknownTeams.join(', ')}.` })
      );
    }

    if (!d.input.dryRun) {
      await withTransaction(async () => {
        for (let team of teams) {
          await this.replaceMemberships({
            organization: d.organization,
            target: team.target,
            input: { type, reach: d.input.reach, members: team.desired }
          });
        }
      });
    }

    return { dryRun: d.input.dryRun, teams, unknownTeams, errors };
  }

  private async findTargetByName(d: {
    organization: Organization;
    kind: string;
    name: string;
  }) {
    let live = {
      organizationOid: d.organization.oid,
      kind: d.kind,
      status: { in: ['managed' as const, 'discovered' as const] }
    };

    let bySlug = await db.entity.findFirst({ where: { ...live, slug: d.name.toLowerCase() } });
    if (bySlug) return bySlug;

    let byName = await db.entity.findMany({
      where: { ...live, name: { equals: d.name, mode: 'insensitive' } },
      take: 2
    });
    if (byName.length > 1) {
      throw new ServiceError(
        badRequestError({
          message: `The ${d.kind} name "${d.name}" is ambiguous; use its slug.`
        })
      );
    }

    return byName[0] ?? null;
  }

  private async currentMembers(d: { target: Entity; type: string }): Promise<CurrentMember[]> {
    let links = await db.entityLink.findMany({
      where: { toOid: d.target.oid, type: d.type, validTo: null },
      include: {
        from: {
          include: { identifiers: { where: { type: 'email' }, orderBy: { oid: 'asc' } } }
        }
      }
    });

    let pending = await db.pendingMembership.findMany({
      where: { targetEntityOid: d.target.oid, type: d.type }
    });

    return [
      ...links.map(link => ({
        email: link.from.identifiers[0]?.value ?? null,
        userId: link.from.id,
        weight: link.weight
      })),
      ...pending.map(membership => ({
        email: membership.email,
        userId: null,
        weight: membership.weight
      }))
    ];
  }

  private async resolveMembers(d: {
    organization: Organization;
    members: MemberInput[];
  }): Promise<ResolvedMembers> {
    let resolved: ResolvedMembers = { users: [], unknownEmails: [] };

    for (let member of d.members) {
      if (!member.userId && !member.email) {
        throw new ServiceError(
          badRequestError({ message: 'Each member needs an email or a userId.' })
        );
      }

      let email = member.email ? normalizeEmail(member.email) : null;

      if (member.userId) {
        let entity = await db.entity.findFirst({
          where: { id: member.userId, organizationOid: d.organization.oid, kind: 'user' }
        });
        if (!entity) {
          throw new ServiceError(
            badRequestError({ message: `Unknown user ${member.userId}.` })
          );
        }

        resolved.users.push({
          entity: await followMerged(entity),
          email,
          weight: member.weight
        });
        continue;
      }

      let identifier = await db.entityIdentifier.findUnique({
        where: {
          organizationOid_kind_type_value: {
            organizationOid: d.organization.oid,
            kind: 'user',
            type: 'email',
            value: email!
          }
        },
        include: { entity: true }
      });

      if (identifier) {
        resolved.users.push({
          entity: await followMerged(identifier.entity),
          email,
          weight: member.weight
        });
      } else {
        resolved.unknownEmails.push({ email: email!, weight: member.weight });
      }
    }

    return resolved;
  }

  private async upsertPending(d: {
    organization: Organization;
    target: Entity;
    type: string;
    since: Date;
    members: { email: string; weight?: number | null }[];
  }) {
    let pending: PendingMembership[] = [];

    await withTransaction(async db => {
      for (let member of d.members) {
        let key = {
          organizationOid_email_targetEntityOid_type: {
            organizationOid: d.organization.oid,
            email: member.email,
            targetEntityOid: d.target.oid,
            type: d.type
          }
        };

        let existing = await db.pendingMembership.findUnique({ where: key });

        pending.push(
          existing
            ? await db.pendingMembership.update({
                where: { oid: existing.oid },
                data: {
                  weight: member.weight === undefined ? existing.weight : member.weight,
                  validFrom: d.since < existing.validFrom ? d.since : existing.validFrom
                }
              })
            : await db.pendingMembership.create({
                data: {
                  ...getId('pendingMembership'),
                  email: member.email,
                  type: d.type,
                  weight: member.weight ?? null,
                  validFrom: d.since,
                  organizationOid: d.organization.oid,
                  targetEntityOid: d.target.oid
                }
              })
        );
      }
    });

    return pending;
  }

  private assertTarget(d: { target: Entity; type: string }) {
    if (d.target.status != 'managed' && d.target.status != 'discovered') {
      throw new ServiceError(
        badRequestError({ message: `The entity ${d.target.id} is ${d.target.status}.` })
      );
    }

    if (!isLinkAllowed({ type: d.type, fromKind: 'user', toKind: d.target.kind })) {
      throw new ServiceError(
        badRequestError({ message: `Users cannot be linked ${d.type} a ${d.target.kind}.` })
      );
    }
  }
}

export let membershipService = Service.create(
  'membershipService',
  () => new MembershipServiceImpl()
).build();
