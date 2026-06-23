import type { Scope, Tenant, User } from '../../prisma/generated/client';
import { scopePresenter } from './scope';

export let userPresenter = (user: User & { scope: Scope; tenant: Tenant }) => ({
  object: 'user',

  id: user.id,
  status: user.status,

  identifier: user.identifier,
  name: user.name,

  scope: scopePresenter({ ...user.scope, tenant: user.tenant }),
  tenantId: user.tenant.id,

  createdAt: user.createdAt,
  updatedAt: user.updatedAt
});
