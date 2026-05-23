import { badRequestError, notFoundError, ServiceError } from '@mtsrc/error';
import { Paginator } from '@mtsrc/pagination';
import { Service } from '@mtsrc/service';
import {
  addAfterTransactionHook,
  db,
  getId,
  type ManagedProviderAuthCredentialsStatus,
  type Prisma,
  type Solution,
  withTransaction
} from '@metorial-subspace/db';
import { providerService } from '@metorial-subspace/module-catalog';
import { getManagedOAuthScopeIds, type ManagedOAuthScopes } from '../lib/managedOAuthScopes';
import { reconcileAllTenantsManagedBackingsQueue } from '../queues/reconcile';
import { reconcileManagedCredentialProviderSingleQueue } from '../queues/reconcile/managedCredentialProvider';

let include = {
  provider: true,
  providerAuthMethodGlobal: {
    include: {
      currentInstance: true
    }
  },
  initialProviderAuthMethod: {
    include: {
      provider: true
    }
  }
};

type ManagedProviderAuthCredentialsRecord = Prisma.ManagedProviderAuthCredentialsGetPayload<{
  include: typeof include;
}>;

let getProviderAuthMethodForProvider = async (d: {
  provider: Awaited<ReturnType<typeof providerService.getProviderById>>;
  providerAuthMethodId: string;
}) => {
  if (!d.provider.defaultVariant?.currentVersion?.specificationOid) {
    throw new ServiceError(
      badRequestError({
        message: 'Provider has not been discovered',
        code: 'provider_not_discovered'
      })
    );
  }

  let providerAuthMethod = await db.providerAuthMethod.findFirst({
    where: {
      id: d.providerAuthMethodId,
      providerOid: d.provider.oid,
      specificationOid: d.provider.defaultVariant.currentVersion.specificationOid,
      type: 'oauth'
    }
  });

  if (providerAuthMethod) {
    return providerAuthMethod;
  }

  throw new ServiceError(
    badRequestError({
      message: 'Invalid auth method for provider',
      code: 'invalid_auth_method'
    })
  );
};

class managedProviderAuthCredentialsServiceImpl {
  async listManagedProviderAuthCredentials(d: {
    solution: Solution;
    status?: ManagedProviderAuthCredentialsStatus[];
    ids?: string[];
    providerIds?: string[];
  }) {
    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.managedProviderAuthCredentials.findMany({
            ...opts,
            where: {
              solutionOid: d.solution.oid,
              AND: [
                d.status?.length ? { status: { in: d.status } } : undefined!,
                d.ids?.length ? { id: { in: d.ids } } : undefined!,
                d.providerIds?.length
                  ? { provider: { id: { in: d.providerIds } } }
                  : undefined!
              ].filter(Boolean)
            },
            include
          })
      )
    );
  }

  async getManagedProviderAuthCredentialsById(d: {
    solution: Solution;
    managedProviderAuthCredentialsId: string;
  }) {
    let managedProviderAuthCredentials = await db.managedProviderAuthCredentials.findFirst({
      where: {
        id: d.managedProviderAuthCredentialsId,
        solutionOid: d.solution.oid
      },
      include
    });

    if (!managedProviderAuthCredentials) {
      throw new ServiceError(
        notFoundError('provider.auth_credentials.managed', d.managedProviderAuthCredentialsId)
      );
    }

    return managedProviderAuthCredentials;
  }

  async createManagedProviderAuthCredentials(d: {
    solution: Solution;
    input: {
      providerId: string;
      providerAuthMethodId: string;
      name: string;
      description?: string;
      metadata?: Record<string, any>;
      clientId: string;
      clientSecret: string;
    };
  }) {
    let provider = await providerService.getProviderById({
      providerId: d.input.providerId,
      solution: d.solution
    });

    let providerAuthMethod = await getProviderAuthMethodForProvider({
      provider,
      providerAuthMethodId: d.input.providerAuthMethodId
    });

    return withTransaction(async db => {
      let managedProviderAuthCredentials = await db.managedProviderAuthCredentials.create({
        data: {
          ...getId('managedProviderAuthCredentials'),
          status: 'active',
          name: d.input.name,
          description: d.input.description || undefined,
          metadata: d.input.metadata,
          solutionOid: d.solution.oid,
          initialProviderAuthMethodOid: providerAuthMethod.oid,
          providerOid: providerAuthMethod.providerOid,
          providerAuthMethodGlobalOid: providerAuthMethod.globalOid,
          oauthClientId: d.input.clientId,
          oauthClientSecret: d.input.clientSecret,
          oauthScopes: getManagedOAuthScopeIds(
            (providerAuthMethod.value.scopes ?? []) as ManagedOAuthScopes
          )
        }
      });

      await addAfterTransactionHook(async () =>
        reconcileManagedCredentialProviderSingleQueue.add(
          { managedProviderAuthCredentialsId: managedProviderAuthCredentials.id },
          { id: `single-${managedProviderAuthCredentials.id}` }
        )
      );

      return await this.getManagedProviderAuthCredentialsByOid(
        managedProviderAuthCredentials.oid
      );
    });
  }

  async updateManagedProviderAuthCredentials(d: {
    solution: Solution;
    managedProviderAuthCredentials: ManagedProviderAuthCredentialsRecord;
    input: {
      name?: string;
      description?: string;
      metadata?: Record<string, any>;
      providerAuthMethodId?: string;
      clientId?: string;
      clientSecret?: string;
    };
  }) {
    let managedProviderAuthCredentialsData: Prisma.ManagedProviderAuthCredentialsUncheckedUpdateInput =
      {};

    if (d.input.providerAuthMethodId) {
      let provider = await providerService.getProviderById({
        providerId:
          d.managedProviderAuthCredentials.provider?.id ??
          d.managedProviderAuthCredentials.initialProviderAuthMethod.provider.id,
        solution: d.solution
      });

      let providerAuthMethod = await getProviderAuthMethodForProvider({
        provider,
        providerAuthMethodId: d.input.providerAuthMethodId
      });

      managedProviderAuthCredentialsData.providerOid = providerAuthMethod.providerOid;
      managedProviderAuthCredentialsData.providerAuthMethodGlobalOid =
        providerAuthMethod.globalOid;
      managedProviderAuthCredentialsData.oauthScopes = getManagedOAuthScopeIds(
        (providerAuthMethod.value.scopes ?? []) as ManagedOAuthScopes
      );
    }

    if (d.input.name !== undefined) {
      managedProviderAuthCredentialsData.name = d.input.name;
    }

    if (d.input.description !== undefined) {
      managedProviderAuthCredentialsData.description = d.input.description;
    }

    if (d.input.metadata !== undefined) {
      managedProviderAuthCredentialsData.metadata = d.input.metadata;
    }

    if (d.input.clientId !== undefined) {
      managedProviderAuthCredentialsData.oauthClientId = d.input.clientId;
    }

    if (d.input.clientSecret !== undefined) {
      managedProviderAuthCredentialsData.oauthClientSecret = d.input.clientSecret;
    }

    return withTransaction(async db => {
      if (Object.keys(managedProviderAuthCredentialsData).length > 0) {
        let managedProviderAuthCredentials = await db.managedProviderAuthCredentials.update({
          where: { oid: d.managedProviderAuthCredentials.oid },
          data: managedProviderAuthCredentialsData
        });

        await addAfterTransactionHook(async () =>
          reconcileManagedCredentialProviderSingleQueue.add(
            {
              managedProviderAuthCredentialsId: managedProviderAuthCredentials.id
            },
            {
              id: `single-${managedProviderAuthCredentials.id}`
            }
          )
        );

        await addAfterTransactionHook(async () =>
          reconcileAllTenantsManagedBackingsQueue.add(
            { solutionId: d.solution.id },
            { id: `all-tenants-${managedProviderAuthCredentials.id}` }
          )
        );
      }

      return await this.getManagedProviderAuthCredentialsByOid(
        d.managedProviderAuthCredentials.oid
      );
    });
  }

  async archiveManagedProviderAuthCredentials(d: {
    solution: Solution;
    managedProviderAuthCredentials: ManagedProviderAuthCredentialsRecord;
  }) {
    return withTransaction(async db => {
      let managedProviderAuthCredentials = await db.managedProviderAuthCredentials.update({
        where: { oid: d.managedProviderAuthCredentials.oid },
        data: { status: 'archived' }
      });

      let backings = await db.managedProviderAuthCredentialsBacking.findMany({
        where: {
          managedCredentialsOid: d.managedProviderAuthCredentials.oid
        },
        select: {
          providerAuthCredentialsOid: true
        }
      });

      if (backings.length > 0) {
        await db.providerAuthCredentials.updateMany({
          where: {
            oid: {
              in: backings.map(backing => backing.providerAuthCredentialsOid)
            }
          },
          data: { status: 'archived' }
        });
      }

      await addAfterTransactionHook(async () =>
        reconcileAllTenantsManagedBackingsQueue.add(
          { solutionId: d.solution.id },
          { id: `all-tenants-${managedProviderAuthCredentials.id}` }
        )
      );

      return await this.getManagedProviderAuthCredentialsByOid(
        d.managedProviderAuthCredentials.oid
      );
    });
  }

  private async getManagedProviderAuthCredentialsByOid(oid: bigint) {
    return await withTransaction(async db =>
      db.managedProviderAuthCredentials.findUniqueOrThrow({
        where: { oid },
        include
      })
    );
  }
}

export let managedProviderAuthCredentialsService = Service.create(
  'managedProviderAuthCredentials',
  () => new managedProviderAuthCredentialsServiceImpl()
).build();
