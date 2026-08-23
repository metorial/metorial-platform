import { notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import { getAuditEventsByIds } from '@metorial/audit-models';
import { db, getImageUrl, Prisma } from '@metorial/db';

let auditLogInclude = {
  event: true,
  organization: true,
  instance: true,
  organizationActor: {
    include: {
      member: true,
      consumerProfile: {
        select: {
          id: true,
          status: true,
          name: true,
          email: true,
          instance: {
            select: {
              id: true
            }
          }
        }
      }
    }
  }
} satisfies Prisma.AuditLogInclude;

type AuditLogWithRelations = Prisma.AuditLogGetPayload<{
  include: typeof auditLogInclude;
}>;

class AuditLogService {
  private async getOrganization(organizationId: string) {
    let organization = await db.organization.findFirst({
      where: {
        OR: [
          { id: organizationId },
          { slug: organizationId },
          { previousSlugs: { has: organizationId } }
        ],
        status: 'active'
      }
    });
    if (!organization) {
      throw new ServiceError(notFoundError('organization', organizationId));
    }

    return organization;
  }

  async hydrateAuditLogs(auditLogs: AuditLogWithRelations[], organizationOid: bigint) {
    let eventIds = auditLogs.flatMap(auditLog => (auditLog.event ? [auditLog.event.id] : []));
    let consumerProfileIds = [
      ...new Set(
        auditLogs.flatMap(auditLog =>
          auditLog.actorType == 'consumer_profile' && auditLog.actorId
            ? [auditLog.actorId]
            : []
        )
      )
    ];
    let [auditEvents, consumerProfiles] = await Promise.all([
      getAuditEventsByIds(eventIds),
      consumerProfileIds.length
        ? db.consumerProfile.findMany({
            where: {
              id: { in: consumerProfileIds },
              organizationOid
            },
            select: {
              id: true,
              status: true,
              name: true,
              email: true,
              instance: {
                select: {
                  id: true
                }
              },
              organizationActor: {
                select: {
                  id: true
                }
              }
            }
          })
        : []
    ]);
    let auditEventsById = new Map(auditEvents.map(event => [event._id, event]));
    let consumerProfilesById = new Map(
      consumerProfiles.map(consumerProfile => [consumerProfile.id, consumerProfile])
    );

    return await Promise.all(
      auditLogs.map(async auditLog => {
        let auditEvent = auditLog.event ? auditEventsById.get(auditLog.event.id) : undefined;
        let actorRecord =
          auditLog.actorType == 'org_actor' && auditLog.organizationActor
            ? {
                object: 'organization_actor' as const,
                id: auditLog.organizationActor.id,
                type: auditLog.organizationActor.type,
                name: auditLog.organizationActor.name,
                email: auditLog.organizationActor.email,
                imageUrl: await getImageUrl(auditLog.organizationActor),
                member: auditLog.organizationActor.member
                  ? {
                      id: auditLog.organizationActor.member.id,
                      status: auditLog.organizationActor.member.status,
                      role: auditLog.organizationActor.member.role
                    }
                  : undefined,
                consumerProfile: auditLog.organizationActor.consumerProfile
                  ? {
                      id: auditLog.organizationActor.consumerProfile.id,
                      status: auditLog.organizationActor.consumerProfile.status,
                      name: auditLog.organizationActor.consumerProfile.name,
                      email: auditLog.organizationActor.consumerProfile.email,
                      instanceId: auditLog.organizationActor.consumerProfile.instance.id
                    }
                  : undefined
              }
            : auditLog.actorType == 'consumer_profile' && auditLog.actorId
              ? (() => {
                  let consumerProfile = consumerProfilesById.get(auditLog.actorId);
                  return consumerProfile
                    ? {
                        object: 'consumer_profile' as const,
                        id: consumerProfile.id,
                        status: consumerProfile.status,
                        name: consumerProfile.name,
                        email: consumerProfile.email,
                        instanceId: consumerProfile.instance.id,
                        organizationActorId: consumerProfile.organizationActor?.id ?? null
                      }
                    : undefined;
                })()
              : undefined;

        return {
          id: auditLog.id,
          eventId: auditLog.event?.id,
          resource: auditLog.resource,
          action: auditLog.action,
          organizationId: auditLog.organization.id,
          instanceId: auditLog.instance?.id,
          organizationActorId: auditLog.organizationActor?.id,
          actor: auditLog.actorType
            ? {
                type: auditLog.actorType,
                id: auditLog.actorId,
                metadata: auditLog.actorMetadata,
                record: actorRecord
              }
            : undefined,
          context: {
            ip: auditLog.ip,
            ua: auditLog.ua
          },
          payload: auditEvent?.payload,
          previousAttributes: auditEvent?.previousAttributes,
          recordedAt: auditLog.recordedAt
        };
      })
    );
  }

  async listAuditLogs(d: { organizationId: string }) {
    let organization = await this.getOrganization(d.organizationId);

    return Paginator.create(
      ({ prisma }) =>
        prisma(async opts =>
          db.auditLog.findMany({
            ...opts,
            where: {
              organizationOid: organization.oid
            },
            include: auditLogInclude
          })
        ),
      { defaultOrder: 'desc' }
    ).mapAll(auditLogs => this.hydrateAuditLogs(auditLogs, organization.oid));
  }

  async listAuditLogsForStream(d: {
    organizationOid: bigint;
    recordedAtGte: Date;
    afterOid?: bigint | null;
    limit: number;
  }) {
    let auditLogs = await db.auditLog.findMany({
      where: {
        organizationOid: d.organizationOid,
        recordedAt: { gte: d.recordedAtGte },
        oid: d.afterOid == null ? undefined : { gt: d.afterOid }
      },
      include: auditLogInclude,
      orderBy: { oid: 'asc' },
      take: Math.min(d.limit, 100)
    });

    return {
      items: await this.hydrateAuditLogs(auditLogs, d.organizationOid),
      lastAuditLogOid: auditLogs.at(-1)?.oid ?? null
    };
  }

  async getAuditLog(d: { organizationId: string; auditLogId: string }) {
    let organization = await this.getOrganization(d.organizationId);
    let auditLog = await db.auditLog.findFirst({
      where: {
        id: d.auditLogId,
        organizationOid: organization.oid
      },
      include: auditLogInclude
    });
    if (!auditLog) {
      throw new ServiceError(notFoundError('audit_log', d.auditLogId));
    }

    let [hydratedAuditLog] = await this.hydrateAuditLogs([auditLog], organization.oid);
    return hydratedAuditLog!;
  }
}

export let auditLogService = Service.create(
  'auditLogService',
  () => new AuditLogService()
).build();

export type AuditLog = Awaited<ReturnType<typeof auditLogService.getAuditLog>>;
