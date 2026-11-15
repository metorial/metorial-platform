import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import { AuditLogStream, db } from '@metorial/db';

class AuditLogStreamEventService {
  async listAuditLogStreamEvents(d: { auditLogStream: AuditLogStream }) {
    return Paginator.create(
      ({ prisma }) =>
        prisma(async opts =>
          db.auditLogStreamEvent.findMany({
            ...opts,
            where: { auditLogStreamOid: d.auditLogStream.oid }
          })
        ),
      { defaultOrder: 'desc' }
    );
  }
}

export let auditLogStreamEventService = Service.create(
  'auditLogStreamEventService',
  () => new AuditLogStreamEventService()
).build();
