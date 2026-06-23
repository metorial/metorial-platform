import { shadowId } from '@lowerdeck/shadow-id';
import type { Scope, Tenant } from '../../prisma/generated/client';

export let scopePresenter = (scope: Scope & { tenant: Tenant }) => ({
  object: 'scope',

  id: scope.id,
  type: scope.type,
  status: scope.status,

  tenantId: scope.tenant.id,

  identifier: scope.identifier,
  name: scope.name,
  description: scope.description,
  links: scope.links.map((link, i) => ({
    id: shadowId('srsopln_', [scope.id], [link.url, i]),
    ...link
  })),

  createdAt: scope.createdAt,
  updatedAt: scope.updatedAt
});
