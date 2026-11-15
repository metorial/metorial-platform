import type { AuditLog, User } from '../../../../prisma/generated/client';

export let auditLogPresenter = (log: AuditLog & { user: User | null }) => ({
  object: 'ares#auditLog' as const,

  id: log.id,
  type: log.type,
  user: log.user
    ? {
        id: log.user.id,
        email: log.user.email,
        name: log.user.name
      }
    : null,
  ip: log.ip,
  metadata: log.metadata,

  createdAt: log.createdAt
});
