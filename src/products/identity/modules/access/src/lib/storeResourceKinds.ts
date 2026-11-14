import type { Prisma } from '@metorial/db';
import {
  consumerSkillMarketplaceWriteRoles,
  consumerSkillPluginWriteRoles
} from '../definitions/accessRoles';
import type { Scope } from '../definitions/scopeValues';
import {
  assertDistinctStoreResourceAccessRoles,
  skillStoreResourceAccess,
  standaloneStoreResourceAccess,
  type StoreResourceAccessDefinition,
  type StoreResourceAccessLevel
} from '../definitions/storeResourceAccess';
import { accessTagService, type AnyAccessTagSelector } from '../services/accessTag';

type AccessTagEntityFilter = NonNullable<
  Awaited<ReturnType<typeof accessTagService.getAccessTagFilter>>
>;

export type StoreResourceKind = {
  kind: string;
  access: StoreResourceAccessDefinition;
  storeWhere: Prisma.StoreWhereInput;
  activeWhere?: Prisma.StoreWhereInput;
  inheritedAccessWhere?: (d: {
    level: StoreResourceAccessLevel;
    accessTagFilter: AccessTagEntityFilter;
    accessTagFilterFor: (roles: readonly Scope[]) => Promise<AccessTagEntityFilter>;
  }) => Promise<Prisma.StoreWhereInput | undefined> | Prisma.StoreWhereInput | undefined;
};

let activeMarketplaceMembershipWhere = (
  skillMarketplace: Prisma.SkillMarketplaceWhereInput = {}
): Prisma.SkillPluginWhereInput => ({
  skillMarketplacePlugins: {
    some: {
      status: 'active',
      skillMarketplace: { status: 'active', ...skillMarketplace }
    }
  }
});

export let skillStoreResourceKind: StoreResourceKind = {
  kind: 'skill',
  access: skillStoreResourceAccess,
  storeWhere: { skill: { isNot: null } },
  activeWhere: { skill: { is: { status: 'active' } } },
  inheritedAccessWhere: async ({ level, accessTagFilter, accessTagFilterFor }) => {
    let skillGroupWhere: Prisma.SkillWhereInput = {
      skillGroupItems: {
        some: {
          status: 'active',
          skillGroup: { status: 'active', accessTagEntities: accessTagFilter }
        }
      }
    };
    if (level != 'read') return { skill: { is: skillGroupWhere } };

    // Marketplace managers can read every skill in the marketplaces they manage, and
    // plugin managers every skill in their plugins. Only the manage-level write roles count:
    // read-level marketplace access also carries skill read roles on the marketplace.
    let marketplaceManagerFilter = await accessTagFilterFor(
      consumerSkillMarketplaceWriteRoles
    );
    let pluginManagerFilter = await accessTagFilterFor(consumerSkillPluginWriteRoles);

    return {
      skill: {
        is: {
          OR: [
            skillGroupWhere,
            {
              skillPluginSkills: {
                some: {
                  status: 'active',
                  skillPlugin: {
                    status: 'active',
                    OR: [
                      activeMarketplaceMembershipWhere({
                        accessTagEntities: marketplaceManagerFilter
                      }),
                      {
                        accessTagEntities: pluginManagerFilter,
                        ...activeMarketplaceMembershipWhere()
                      }
                    ]
                  }
                }
              }
            }
          ]
        }
      }
    };
  }
};

let storeResourceKinds = new Map<string, StoreResourceKind>([
  [skillStoreResourceKind.kind, skillStoreResourceKind]
]);

export let registerStoreResourceKind = (kind: StoreResourceKind) => {
  assertDistinctStoreResourceAccessRoles(kind.access);
  storeResourceKinds.set(kind.kind, kind);
  return kind;
};

export let unregisterStoreResourceKind = (kind: Pick<StoreResourceKind, 'kind'>) => {
  if (kind.kind == skillStoreResourceKind.kind) return;
  storeResourceKinds.delete(kind.kind);
};

export let listStoreResourceKinds = () => [...storeResourceKinds.values()];

export let getStoreResourceKind = (kind: string) => storeResourceKinds.get(kind);

let getPublicAccessWhere = (level: StoreResourceAccessLevel): Prisma.StoreWhereInput =>
  level == 'read'
    ? { access: { in: ['public_read', 'public_write'] } }
    : { access: 'public_write' };

let getKindAccessWhere = async (d: {
  kind: StoreResourceKind;
  accessTags?: AnyAccessTagSelector;
  level: StoreResourceAccessLevel;
}) => {
  let accessTagFilter = await accessTagService.getAccessTagFilter({
    tags: d.accessTags,
    roles: d.kind.access.policies[d.level].roles
  });
  if (!accessTagFilter) return undefined;

  let inherited = await d.kind.inheritedAccessWhere?.({
    level: d.level,
    accessTagFilter,
    accessTagFilterFor: async roles =>
      (await accessTagService.getAccessTagFilter({ tags: d.accessTags, roles: [...roles] }))!
  });

  return {
    OR: [{ accessTagEntities: accessTagFilter }, ...(inherited ? [inherited] : [])]
  } satisfies Prisma.StoreWhereInput;
};

export let getStoreResourceKindAccessWhere = async (d: {
  kind: StoreResourceKind;
  accessTags?: AnyAccessTagSelector;
  level: StoreResourceAccessLevel;
}): Promise<Prisma.StoreWhereInput> => {
  let accessWhere = await getKindAccessWhere(d);

  return {
    AND: [d.kind.storeWhere, d.kind.activeWhere ?? {}, accessWhere ?? { oid: { in: [] } }]
  };
};

export let getStoreResourceAccessWhere = async (d: {
  accessTags?: AnyAccessTagSelector;
  level: StoreResourceAccessLevel;
}): Promise<Prisma.StoreWhereInput> => {
  let kinds = listStoreResourceKinds();
  let kindWheres = await Promise.all(
    kinds.map(kind =>
      getStoreResourceKindAccessWhere({ kind, accessTags: d.accessTags, level: d.level })
    )
  );

  let standaloneAccess = await getKindAccessWhere({
    kind: { kind: 'store', access: standaloneStoreResourceAccess, storeWhere: {} },
    accessTags: d.accessTags,
    level: d.level
  });

  return {
    OR: [
      ...kindWheres,
      {
        AND: [
          { NOT: kinds.map(kind => kind.storeWhere) },
          {
            OR: [
              getPublicAccessWhere(d.level),
              ...(standaloneAccess ? [standaloneAccess] : [])
            ]
          }
        ]
      }
    ]
  };
};
