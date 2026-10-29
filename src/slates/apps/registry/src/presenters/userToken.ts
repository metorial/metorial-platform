import type { Tenant, User, UserToken } from '../../prisma/generated/client';
import { apiKeys } from '../keys';

export let userTokenPresenter = (token: UserToken & { user: User; tenant: Tenant }) => ({
  object: 'user_token',

  id: token.id,
  status: token.status,

  name: token.name,
  secretRedacted: token.secretRedacted ?? (token.secret ? apiKeys.redact(token.secret) : null),

  tenantId: token.tenant.id,
  userId: token.user.id,

  createdAt: token.createdAt,
  updatedAt: token.updatedAt,
  expiresAt: token.expiresAt
});
