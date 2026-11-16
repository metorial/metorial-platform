import type {
  Scope,
  Slate,
  SlateCategory,
  SlateActivation,
  SlateCategoryAssignment,
  SlateVersion,
  Tenant,
  User
} from '../../prisma/generated/client';
import { getEffectiveCurrentSlateVersion } from '../lib/slateVersion/current';
import { scopePresenter } from './scope';
import { slateCategoryPresenter } from './slateCategory';
import { userPresenter } from './user';

export let slatePresenter = (
  slate: Slate & {
    scope: Scope;
    tenant: Tenant;
    unbuiltCurrentVersion: SlateVersion | null;
    builtOrUnbuiltCurrentVersion: SlateVersion | null;
    createdByUser: User & { scope: Scope };
    categories: (SlateCategoryAssignment & {
      category: SlateCategory;
    })[];
    activation?: (SlateActivation & { pinnedVersion: SlateVersion | null }) | null;
  },
  o?: {
    supportsPrebuilt?: boolean;
  }
) => {
  let currentVersion = getEffectiveCurrentSlateVersion({
    supportsBuilt: o?.supportsPrebuilt ?? false,
    unbuiltCurrentVersion: slate.unbuiltCurrentVersion,
    builtOrUnbuiltCurrentVersion: slate.builtOrUnbuiltCurrentVersion,
    activation: slate.activation
  });

  return {
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

    currentVersion: currentVersion
      ? {
          id: currentVersion.id,
          version: currentVersion.version,
          createdAt: currentVersion.createdAt
        }
      : null,

    tenantId: slate.tenant.id,

    createdAt: slate.createdAt,
    updatedAt: slate.updatedAt
  };
};
