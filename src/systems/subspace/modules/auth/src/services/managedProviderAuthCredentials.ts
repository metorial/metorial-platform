import {
  badRequestError,
  internalServerError,
  notFoundError,
  ServiceError
} from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import {
  db,
  getId,
  type ManagedProviderAuthCredentialsStatus,
  type Prisma,
  type Solution,
  withTransaction
} from '@metorial-subspace/db';
import { providerService } from '@metorial-subspace/module-catalog';
import { getBackend } from '@metorial-subspace/provider';
import { getManagedOAuthScopeIds, type ManagedOAuthScopes } from '../lib/managedOAuthScopes';

let include = {
  providerAuthCredentials: {
    include: {
      provider: true
    }
  },
  providerAuthMethod: true
};

type ManagedProviderAuthCredentialsRecord = Prisma.ManagedProviderAuthCredentialsGetPayload<{
  include: typeof include;
}>;

type ManagedProviderAuthCredentialsWithPublicCredential =
  ManagedProviderAuthCredentialsRecord & {
    providerAuthCredentials: NonNullable<
      ManagedProviderAuthCredentialsRecord['providerAuthCredentials']
    >;
  };

let requireManagedProviderAuthCredentialsPublicCredential = (
  managedProviderAuthCredentials: ManagedProviderAuthCredentialsRecord
): ManagedProviderAuthCredentialsWithPublicCredential => {
  if (managedProviderAuthCredentials.providerAuthCredentials) {
    return managedProviderAuthCredentials as ManagedProviderAuthCredentialsWithPublicCredential;
  }

  throw new ServiceError(
    internalServerError({
      code: 'managed_provider_auth_credentials_public_credential_missing',
      message: 'Managed provider auth credentials are missing their public credential'
    })
  );
};

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
      prisma(async opts =>
        (
          await db.managedProviderAuthCredentials.findMany({
            ...opts,
            where: {
              solutionOid: d.solution.oid,
              AND: [
                d.status?.length ? { status: { in: d.status } } : undefined!,
                d.ids?.length ? { id: { in: d.ids } } : undefined!,
                d.providerIds?.length
                  ? {
                      providerAuthCredentials: {
                        is: {
                          provider: {
                            id: { in: d.providerIds }
                          }
                        }
                      }
                    }
                  : undefined!
              ].filter(Boolean)
            },
            include
          })
        ).map(requireManagedProviderAuthCredentialsPublicCredential)
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

    return requireManagedProviderAuthCredentialsPublicCredential(
      managedProviderAuthCredentials
    );
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

    let defaultVariant = provider.defaultVariant;
    if (!defaultVariant) {
      throw new ServiceError(
        badRequestError({
          message: 'Provider has not been discovered',
          code: 'provider_not_discovered'
        })
      );
    }

    let backend = await getBackend({
      entity: {
        backendOid: defaultVariant.backendOid
      }
    });

    return withTransaction(async db => {
      let managedProviderAuthCredentials = await db.managedProviderAuthCredentials.create({
        data: {
          ...getId('managedProviderAuthCredentials'),
          status: 'active',
          solutionOid: d.solution.oid,
          providerAuthMethodOid: providerAuthMethod.oid,
          oauthClientId: d.input.clientId,
          oauthClientSecret: d.input.clientSecret,
          oauthScopes: (providerAuthMethod.value.scopes ?? []) as ManagedOAuthScopes
        }
      });

      await db.providerAuthCredentials.create({
        data: {
          ...getId('providerAuthCredentials'),
          type: 'oauth',
          status: 'active',
          origin: 'managed_public',
          backendOid: backend.backend.oid,
          isAutoRegistration: false,
          name: d.input.name,
          description: d.input.description || undefined,
          metadata: d.input.metadata,
          scopes: getManagedOAuthScopeIds(
            (providerAuthMethod.value.scopes ?? []) as ManagedOAuthScopes
          ),
          needsScopeSync: false,
          isEphemeral: false,
          isDefault: false,
          providerOid: provider.oid,
          managedCredentialsOid: managedProviderAuthCredentials.oid,
          solutionOid: d.solution.oid
        }
      });

      return await this.getManagedProviderAuthCredentialsByOid(
        managedProviderAuthCredentials.oid
      );
    });
  }

  async updateManagedProviderAuthCredentials(d: {
    solution: Solution;
    managedProviderAuthCredentials: {
      oid: bigint;
      providerAuthCredentials: {
        oid: bigint;
        name: string | null;
        description: string | null;
        metadata: unknown;
        provider: {
          id: string;
        };
      };
    };
    input: {
      name?: string;
      description?: string;
      metadata?: Record<string, any>;
      providerAuthMethodId?: string;
      clientId?: string;
      clientSecret?: string;
    };
  }) {
    let managedProviderAuthCredentialsData: {
      providerAuthMethodOid?: bigint;
      oauthClientId?: string;
      oauthClientSecret?: string;
      oauthScopes?: ManagedOAuthScopes;
    } = {};

    if (d.input.providerAuthMethodId) {
      let provider = await providerService.getProviderById({
        providerId: d.managedProviderAuthCredentials.providerAuthCredentials.provider.id,
        solution: d.solution
      });

      let providerAuthMethod = await getProviderAuthMethodForProvider({
        provider,
        providerAuthMethodId: d.input.providerAuthMethodId
      });

      managedProviderAuthCredentialsData.providerAuthMethodOid = providerAuthMethod.oid;
      managedProviderAuthCredentialsData.oauthScopes = (providerAuthMethod.value.scopes ??
        []) as ManagedOAuthScopes;
    }

    if (d.input.clientId !== undefined) {
      managedProviderAuthCredentialsData.oauthClientId = d.input.clientId;
    }

    if (d.input.clientSecret !== undefined) {
      managedProviderAuthCredentialsData.oauthClientSecret = d.input.clientSecret;
    }

    return withTransaction(async db => {
      if (Object.keys(managedProviderAuthCredentialsData).length > 0) {
        await db.managedProviderAuthCredentials.update({
          where: { oid: d.managedProviderAuthCredentials.oid },
          data: managedProviderAuthCredentialsData
        });
      }

      await db.providerAuthCredentials.update({
        where: {
          oid: d.managedProviderAuthCredentials.providerAuthCredentials.oid
        },
        data: {
          name: d.input.name ?? d.managedProviderAuthCredentials.providerAuthCredentials.name,
          description:
            d.input.description ||
            d.managedProviderAuthCredentials.providerAuthCredentials.description,
          metadata:
            d.input.metadata ??
            d.managedProviderAuthCredentials.providerAuthCredentials.metadata,
          scopes: managedProviderAuthCredentialsData.oauthScopes
            ? getManagedOAuthScopeIds(managedProviderAuthCredentialsData.oauthScopes)
            : undefined,
          needsScopeSync: managedProviderAuthCredentialsData.oauthScopes ? false : undefined
        }
      });

      return await this.getManagedProviderAuthCredentialsByOid(
        d.managedProviderAuthCredentials.oid
      );
    });
  }

  async archiveManagedProviderAuthCredentials(d: {
    managedProviderAuthCredentials: {
      oid: bigint;
      providerAuthCredentials: {
        oid: bigint;
      };
    };
  }) {
    return withTransaction(async db => {
      await db.managedProviderAuthCredentials.update({
        where: { oid: d.managedProviderAuthCredentials.oid },
        data: { status: 'archived' }
      });

      await db.providerAuthCredentials.update({
        where: {
          oid: d.managedProviderAuthCredentials.providerAuthCredentials.oid
        },
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

      return await this.getManagedProviderAuthCredentialsByOid(
        d.managedProviderAuthCredentials.oid
      );
    });
  }

  private async getManagedProviderAuthCredentialsByOid(oid: bigint) {
    return await withTransaction(async db =>
      requireManagedProviderAuthCredentialsPublicCredential(
        await db.managedProviderAuthCredentials.findUniqueOrThrow({
          where: { oid },
          include
        })
      )
    );
  }
}

export let managedProviderAuthCredentialsService = Service.create(
  'managedProviderAuthCredentials',
  () => new managedProviderAuthCredentialsServiceImpl()
).build();
