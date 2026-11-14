import { Paginator } from '@lowerdeck/pagination';
import type { App } from '../../prisma/generated/client';
import { db } from '../db';
import { getId } from '../id';

class AuditLogService {
  log(d: {
    appOid: bigint;
    type: string;
    userOid?: bigint;
    ip?: string | null;
    ua?: string | null;
    metadata?: Record<string, any>;
  }) {
    setTimeout(async () => {
      db.auditLog
        .create({
          data: {
            ...getId('auditLog'),
            appOid: d.appOid,
            type: d.type,
            userOid: d.userOid ?? null,
            ip: d.ip ?? null,
            ua: d.ua ?? null,
            metadata: d.metadata ?? null
          }
        })
        .catch(err => {
          console.error('Failed to write audit log:', err);
        });
    }, 10 * 1000);
  }

  async list(d: { app: App; type?: string }) {
    return Paginator.create(
      ({ prisma }) =>
        prisma(
          async opts =>
            await db.auditLog.findMany({
              ...opts,
              where: {
                appOid: d.app.oid,
                ...(d.type ? { type: d.type } : {})
              },
              include: { user: true },
              orderBy: [{ createdAt: 'desc' }]
            })
        ),
      { defaultOrder: 'desc' }
    );
  }
}

export let auditLogService = new AuditLogService();
