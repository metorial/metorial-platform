import type {
  Scope,
  Slate,
  SlateCategory,
  SlateCategoryAssignment,
  SlateVersion,
  Tenant,
  User
} from '../../prisma/generated/client';
import { scopePresenter } from './scope';
import { slateCategoryPresenter } from './slateCategory';
import { userPresenter } from './user';

export let slatePresenter = (
  slate: Slate & {
    scope: Scope;
    tenant: Tenant;
    currentVersion: SlateVersion | null;
    createdByUser: User & { scope: Scope };
    categories: (SlateCategoryAssignment & {
      category: SlateCategory;
    })[];
  }
) => ({
  object: 'slate',

  id: slate.id,
  status: slate.status,
  access: slate.access,

  name: slate.name,
  description: slate.description,

  logoUrl: slate.logoUrl,
  skills: slate.skills,

  categories: slate.categories.map(ca => slateCategoryPresenter(ca.category)),

  identifier: slate.identifier,
  fullIdentifier: slate.fullIdentifier,

  createdByUser: userPresenter({
    ...slate.createdByUser,
    tenant: slate.tenant
  }),

  scope: scopePresenter({ ...slate.scope, tenant: slate.tenant }),

  currentVersion: slate.currentVersion
    ? {
        id: slate.currentVersion.id,
        version: slate.currentVersion.version,
        createdAt: slate.currentVersion.createdAt
      }
    : null,

  tenantId: slate.tenant.id,

  createdAt: slate.createdAt,
  updatedAt: slate.updatedAt
});
