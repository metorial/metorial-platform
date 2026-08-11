import { badRequestError, notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import {
  type CustomProviderCommit,
  type CustomProviderCommitTrigger,
  type CustomProviderEnvironment,
  type CustomProviderVersion,
  addAfterTransactionHook,
  db,
  type Environment,
  getId,
  type ScmRepoPush,
  type Tenant,
  type TenantActor,
  withTransaction
} from '@metorial-subspace/db';
import {
  type DateFilter,
  normalizeDateFilter,
  resolveCustomProviderEnvironments,
  resolveCustomProviders,
  resolveCustomProviderVersions,
  resolveProviders
} from '@metorial-subspace/list-utils';
import {
  checkTenant,
  getMetorialSolution,
  type MetorialFacingWithActor,
  resolveMetorialFacingWithActor,
  toProviderEventBase
} from '@metorial-subspace/module-tenant';
import { Fabric } from '@metorial/fabric';
import { commitApplyQueue } from '../queues/commit/apply';

let envInclude = {
  include: {
    environment: true,
    providerEnvironment: {
      include: {
        currentVersion: true
      }
    }
  }
};

let verInclude = {
  include: {
    deployment: {
      include: {
        commit: true,
        scmRepoPush: { include: { repo: true } }
      }
    },
    providerVersion: true,
    customProviderEnvironmentVersions: {
      include: {
        customProviderEnvironment: {
          include: {
            environment: true,
            providerEnvironment: {
              include: {
                currentVersion: true
              }
            }
          }
        }
      }
    },
    creatorActor: true,
    immutableCodeBucket: { include: { scmRepo: true } }
  }
};

let include = {
  customProvider: {
    include: {
      provider: true
    }
  },
  toEnvironment: envInclude,
  fromEnvironment: envInclude,
  targetCustomProviderVersion: verInclude,
  toEnvironmentVersionBefore: verInclude,
  creatorActor: true,
  customProviderDeployment: true,
  scmRepoPush: { include: { repo: true } }
};

export type CreateCustomProviderCommitParams = {
  actor: TenantActor;
  tenant: Tenant;
  environment: Environment;

  _internal?: {
    trigger?: CustomProviderCommitTrigger;
    scmPush?: ScmRepoPush;
  };

  input: {
    message: string;

    action:
      | {
          type: 'merge_version_into_environment';
          fromEnvironment: CustomProviderEnvironment;
          toEnvironment: CustomProviderEnvironment;
        }
      | {
          type: 'rollback_to_version';
          environment: CustomProviderEnvironment;
          version: CustomProviderVersion;
        };
  };
};

class customProviderCommitServiceImpl {
  async createCustomProviderCommit(
    d: MetorialFacingWithActor<CreateCustomProviderCommitParams>
  ) {
    let { instance, organizationActor, ...rest } = d;
    let scope = await resolveMetorialFacingWithActor(d);

    let eventBase = toProviderEventBase(d);
    await Fabric.fire('provider.custom_provider.commit.created:before', eventBase);

    let customProviderCommit = await this.createCustomProviderCommitInternal({
      ...rest,
      tenant: scope.tenant,
      environment: scope.environment,
      actor: scope.actor
    });

    await Fabric.fire('provider.custom_provider.commit.created:after', {
      ...eventBase,
      customProviderCommit
    });

    return customProviderCommit;
  }

  async createCustomProviderCommitInternal(d: CreateCustomProviderCommitParams) {
    let solution = await getMetorialSolution();

    return await withTransaction(async db => {
      let dataBase = {
        ...getId('customProviderCommit'),

        status: 'pending' as const,
        trigger: d._internal?.trigger ?? ('manual' as const),
        type: d.input.action.type,

        message: d.input.message,

        scmRepoPushOid: d._internal?.scmPush?.oid,

        tenantOid: d.tenant.oid,
        solutionOid: solution.oid,
        creatorActorOid: d.actor.oid
      };

      let commit: CustomProviderCommit;

      if (d.input.action.type === 'rollback_to_version') {
        checkTenant(d, d.input.action.environment);
        checkTenant(d, d.input.action.version);

        let action = d.input.action;
        if (action.environment.customProviderOid !== action.version.customProviderOid) {
          throw new ServiceError(
            badRequestError({
              message: 'Environment and version must belong to the same custom provider.'
            })
          );
        }

        if (action.version.status !== 'deployment_succeeded') {
          throw new ServiceError(
            badRequestError({
              message: 'Can only rollback to a version that has been successfully deployed.'
            })
          );
        }

        commit = await db.customProviderCommit.create({
          data: {
            ...dataBase,

            toEnvironmentOid: d.input.action.environment.oid,

            // Flip the versions
            toEnvironmentVersionBeforeOid: action.version.oid,
            targetCustomProviderVersionOid: action.version.oid,

            customProviderOid: action.version.customProviderOid
          }
        });
      } else if (d.input.action.type === 'merge_version_into_environment') {
        checkTenant(d, d.input.action.fromEnvironment);
        checkTenant(d, d.input.action.toEnvironment);

        let action = d.input.action;

        if (action.toEnvironment.oid === action.fromEnvironment.oid) {
          throw new ServiceError(
            badRequestError({
              message: 'Cannot merge version into the same environment.'
            })
          );
        }
        if (
          action.toEnvironment.customProviderOid !== action.fromEnvironment.customProviderOid
        ) {
          throw new ServiceError(
            badRequestError({
              message: 'From and to environments must belong to the same custom provider.'
            })
          );
        }

        let toEnvironmentFull = await db.customProviderEnvironment.findUniqueOrThrow({
          where: { oid: action.toEnvironment.oid },
          include: {
            providerEnvironment: {
              include: {
                currentVersion: {
                  include: { customProviderVersion: true }
                }
              }
            }
          }
        });
        let fromEnvironmentFull = await db.customProviderEnvironment.findUniqueOrThrow({
          where: { oid: action.fromEnvironment.oid },
          include: {
            providerEnvironment: {
              include: {
                currentVersion: {
                  include: { customProviderVersion: true }
                }
              }
            }
          }
        });

        let toVersion =
          toEnvironmentFull.providerEnvironment?.currentVersion?.customProviderVersion;
        let fromVersion =
          fromEnvironmentFull.providerEnvironment?.currentVersion?.customProviderVersion;

        if (!fromVersion) {
          throw new ServiceError(
            badRequestError({
              message: 'From environment has no version to merge from.'
            })
          );
        }
        if (toVersion && toVersion.oid === fromVersion.oid) {
          throw new ServiceError(
            badRequestError({
              message: 'To environment is already at the same version as from environment.'
            })
          );
        }

        commit = await db.customProviderCommit.create({
          data: {
            ...dataBase,

            fromEnvironmentOid: action.fromEnvironment.oid,
            toEnvironmentOid: action.toEnvironment.oid,

            toEnvironmentVersionBeforeOid: toVersion ? toVersion.oid : null,
            targetCustomProviderVersionOid: fromVersion.oid,

            customProviderOid: fromVersion.customProviderOid
          }
        });
      } else {
        throw new Error('Unhandled action type');
      }

      await addAfterTransactionHook(() =>
        commitApplyQueue.add({ customProviderCommitId: commit.id })
      );

      return await db.customProviderCommit.findUniqueOrThrow({
        where: { oid: commit.oid },
        include
      });
    });
  }

  async listCustomProviderCommits(d: {
    tenant: Tenant;
    environment: Environment;

    createdAt?: DateFilter;
    updatedAt?: DateFilter;

    ids?: string[];
    providerIds?: string[];
    customProviderIds?: string[];
    customProviderVersionIds?: string[];
    customProviderEnvironmentIds?: string[];
  }) {
    let solution = await getMetorialSolution();
    let providers = await resolveProviders(d, d.providerIds);
    let customProviders = await resolveCustomProviders(d, d.customProviderIds);

    let customProviderEnvironments = await resolveCustomProviderEnvironments(
      d,
      d.customProviderEnvironmentIds
    );
    let customProviderVersions = await resolveCustomProviderVersions(
      d,
      d.customProviderVersionIds
    );

    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.customProviderCommit.findMany({
            ...opts,
            where: {
              tenantOid: d.tenant.oid,
              solutionOid: solution.oid,

              AND: [
                d.ids ? { id: { in: d.ids } } : undefined!,

                providers ? { customProvider: { providerOid: providers.in } } : undefined!,
                customProviders ? { customProviderOid: customProviders.in } : undefined!,

                customProviderVersions
                  ? { targetCustomProviderVersionOid: customProviderVersions.in }
                  : undefined!,

                customProviderEnvironments
                  ? {
                      toEnvironmentOid: customProviderEnvironments.in,
                      fromEnvironmentOid: customProviderEnvironments.in
                    }
                  : undefined!,
                d.createdAt ? { createdAt: normalizeDateFilter(d.createdAt) } : undefined!,
                d.updatedAt ? { updatedAt: normalizeDateFilter(d.updatedAt) } : undefined!
              ].filter(Boolean)
            },
            include
          })
      )
    );
  }

  async getCustomProviderCommitById(d: {
    tenant: Tenant;
    environment: Environment;
    customProviderCommitId: string;
  }) {
    let solution = await getMetorialSolution();
    let customProviderCommit = await db.customProviderCommit.findFirst({
      where: {
        id: d.customProviderCommitId,
        tenantOid: d.tenant.oid,
        solutionOid: solution.oid
      },
      include
    });
    if (!customProviderCommit)
      throw new ServiceError(
        notFoundError('custom_provider.commit', d.customProviderCommitId)
      );

    return customProviderCommit;
  }
}

export let customProviderCommitService = Service.create(
  'customProviderCommit',
  () => new customProviderCommitServiceImpl()
).build();
