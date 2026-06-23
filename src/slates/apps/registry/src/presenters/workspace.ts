import type { Scope, Tenant, Workspace } from '../../prisma/generated/client';
import { scopePresenter } from './scope';

export let workspacePresenter = (workspace: Workspace & { scope: Scope; tenant: Tenant }) => ({
  object: 'workspace',

  id: workspace.id,
  status: workspace.status,

  identifier: workspace.identifier,
  name: workspace.name,

  scope: scopePresenter({ ...workspace.scope, tenant: workspace.tenant }),
  tenantId: workspace.tenant.id,

  createdAt: workspace.createdAt,
  updatedAt: workspace.updatedAt
});
