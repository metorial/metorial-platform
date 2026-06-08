import { notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import {
  db,
  type Environment,
  type Prisma,
  type ProviderSpecificationChangeNotificationTarget,
  type Solution,
  type Tenant
} from '@metorial-subspace/db';
import {
  type DateFilter,
  normalizeDateFilter,
  resolveProviders,
  resolveProviderSpecifications,
  resolveProviderVersions
} from '@metorial-subspace/list-utils';

export let providerSpecificationChangeNotificationInclude = {
  version: { include: { provider: true } },
  deploymentConfigPair: true,
  versionSpecificationChange: {
    include: {
      fromSpecification: true,
      toSpecification: true,
      fromVersion: true,
      toVersion: true
    }
  },
  pairSpecificationChange: {
    include: {
      fromSpecification: true,
      toSpecification: true,
      fromPairVersion: { include: { version: true } },
      toPairVersion: { include: { version: true } }
    }
  }
} as const;

export type ProviderSpecificationChangeNotificationWithRelations =
  Prisma.ProviderSpecificationChangeNotificationGetPayload<{
    include: typeof providerSpecificationChangeNotificationInclude;
  }>;

let visibilityFilter = (d: { tenant: Tenant; environment: Environment; solution: Solution }) =>
  ({
    OR: [
      {
        tenantOid: null,
        environmentOid: null,
        solutionOid: null
      },
      {
        tenantOid: d.tenant.oid,
        environmentOid: d.environment.oid,
        solutionOid: d.solution.oid
      }
    ]
  }) satisfies Prisma.ProviderSpecificationChangeNotificationWhereInput;

class providerSpecificationChangeNotificationServiceImpl {
  async listProviderSpecificationChangeNotifications(d: {
    tenant: Tenant;
    environment: Environment;
    solution: Solution;

    ids?: string[];
    targets?: ProviderSpecificationChangeNotificationTarget[];
    providerIds?: string[];
    providerVersionIds?: string[];
    providerSpecificationIds?: string[];
    createdAt?: DateFilter;
  }) {
    let [providers, providerVersions, providerSpecifications] = await Promise.all([
      resolveProviders(d, d.providerIds),
      resolveProviderVersions(d, d.providerVersionIds),
      resolveProviderSpecifications(d, d.providerSpecificationIds)
    ]);

    return Paginator.create<ProviderSpecificationChangeNotificationWithRelations>(
      ({ prisma }) =>
        prisma(async opts => {
          let and: Prisma.ProviderSpecificationChangeNotificationWhereInput[] = [
            visibilityFilter(d),
            d.ids ? { id: { in: d.ids } } : undefined!,
            d.targets ? { target: { in: d.targets } } : undefined!,
            providers ? { version: { providerOid: providers.in } } : undefined!,
            providerVersions ? { versionOid: providerVersions.in } : undefined!,
            providerSpecifications
              ? {
                  OR: [
                    {
                      versionSpecificationChange: {
                        OR: [
                          { fromSpecificationOid: providerSpecifications.in },
                          { toSpecificationOid: providerSpecifications.in }
                        ]
                      }
                    },
                    {
                      pairSpecificationChange: {
                        OR: [
                          { fromSpecificationOid: providerSpecifications.in },
                          { toSpecificationOid: providerSpecifications.in }
                        ]
                      }
                    }
                  ]
                }
              : undefined!,
            d.createdAt ? { createdAt: normalizeDateFilter(d.createdAt) } : undefined!
          ].filter(Boolean);

          return await db.providerSpecificationChangeNotification.findMany({
            ...opts,
            where: { AND: and },
            include: providerSpecificationChangeNotificationInclude
          });
        })
    );
  }

  async getProviderSpecificationChangeNotificationById(d: {
    tenant: Tenant;
    environment: Environment;
    solution: Solution;
    notificationId: string;
  }) {
    let notification = await db.providerSpecificationChangeNotification.findFirst({
      where: {
        id: d.notificationId,
        AND: [visibilityFilter(d)]
      },
      include: providerSpecificationChangeNotificationInclude
    });
    if (!notification) {
      throw new ServiceError(
        notFoundError('provider specification change notification', d.notificationId)
      );
    }

    return notification;
  }
}

export let providerSpecificationChangeNotificationService = Service.create(
  'providerSpecificationChangeNotificationService',
  () => new providerSpecificationChangeNotificationServiceImpl()
).build();
