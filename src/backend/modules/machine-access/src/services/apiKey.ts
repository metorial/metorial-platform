import { forbiddenError, notFoundError, ServiceError } from '@lowerdeck/error';
import { Hash } from '@lowerdeck/hash';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import { UnifiedApiKey } from '@metorial/api-keys';
import { getConfig } from '@metorial/config';
import { Context } from '@metorial/context';
import {
  addAfterTransactionHook,
  ApiKey,
  ApiKeyKind,
  db,
  ID,
  Instance,
  MachineAccess,
  Organization,
  OrganizationActor,
  User,
  withTransaction
} from '@metorial/db';
import { Fabric } from '@metorial/fabric';
import { addMinutes } from 'date-fns';
import { env } from '../env';
import { assertValidApiKeyIpFilters } from '../lib/apiKeyIpFilters';
import { machineAccessService } from './machineAccess';

export type ListApiKeysFilter =
  | {
      type: 'organization_management_token';
      organization: Organization;
    }
  | {
      type: 'instance_access_token';
      instance: Instance;
      organization: Organization;
    };

class ApiKeyService {
  private async ensureApiKeyActive(apiKey: ApiKey) {
    if (apiKey.status != 'active') {
      throw new ServiceError(
        forbiddenError({
          message: 'Cannot perform this action on a deleted api key'
        })
      );
    }

    if (apiKey.kind == 'system_internal') {
      throw new ServiceError(
        forbiddenError({
          message: 'Cannot perform this action on an internal system api key'
        })
      );
    }
  }

  async createApiKey(
    d: {
      input: {
        name: string;
        description?: string;
        expiresAt?: Date;
        ipFilters?: string[];
      };
      context: Context;
      kind?: ApiKeyKind;
    } & (
      | {
          type: 'organization_management_token';
          organization: Organization;
          performedBy: OrganizationActor;
        }
      | {
          type: 'instance_access_token_secret' | 'instance_access_token_publishable';
          organization: Organization;
          instance: Instance;
          performedBy: OrganizationActor;
        }
    )
  ) {
    let ipFilters = assertValidApiKeyIpFilters(d.input.ipFilters);

    let res = await withTransaction(async db => {
      let machineAccess = await machineAccessService.createMachineAccess(
        d.type == 'organization_management_token'
          ? {
              type: 'organization_management' as const,
              organization: d.organization,
              performedBy: d.performedBy,
              context: d.context,
              input: {
                name: `ORG TOKEN ${d.input.name}`
              }
            }
          : {
              type:
                d.type == 'instance_access_token_secret'
                  ? 'instance_secret'
                  : 'instance_publishable',
              organization: d.organization,
              performedBy: d.performedBy,
              context: d.context,
              instance: d.instance,
              input: {
                name: `INSTANCE TOKEN ${d.input.name}`
              }
            }
      );

      await Fabric.fire('machine_access.api_key.created:before', {
        ...d,
        machineAccess
      });

      let secretKey = UnifiedApiKey.create({
        type: d.type,
        config: {
          url: getConfig().urls.apiUrl,
          instance: `v2-${env.service.METORIAL_REGION ?? 'ext'}`
        }
      });

      let limitReveal =
        d.type == 'organization_management_token' ||
        (d.type == 'instance_access_token_secret' && d.instance.type == 'production');

      let apiKey = await db.apiKey.create({
        data: {
          id: await ID.generateId('apiKey'),
          status: 'active',
          kind: d.kind ?? 'user_created',
          type: d.type,
          name: d.input.name,
          description: d.input.description,
          ipFilters,
          machineAccessOid: machineAccess.oid,
          secretRedacted: UnifiedApiKey.redact(secretKey),
          secretLength: secretKey.toString().length,
          expiresAt: d.input.expiresAt,
          canRevealUntil: limitReveal ? addMinutes(new Date(), 5) : null,
          canRevealForever: !limitReveal
        },
        include: {
          machineAccess: {
            include: {
              organization: true,
              user: true,
              instance: { include: { project: true } },
              actor: true
            }
          }
        }
      });

      let secret = await db.apiKeySecret.create({
        data: {
          id: await ID.generateId('apiKeySecret'),
          secret: secretKey.toString(),
          secretSha512: await Hash.sha512(secretKey.toString()),
          expiresAt: d.input.expiresAt,

          apiKeyOid: apiKey.oid
        }
      });

      return {
        apiKey,
        secret
      };
    });

    addAfterTransactionHook(() =>
      Fabric.fire('machine_access.api_key.created:after', {
        ...d,
        apiKey: res.apiKey,
        machineAccess: res.apiKey.machineAccess
      })
    );

    return res;
  }

  async updateApiKey(d: {
    apiKey: ApiKey & { machineAccess: MachineAccess };
    input: {
      name?: string;
      description?: string;
      expiresAt?: Date;
      ipFilters?: string[];
    };
    context: Context;
    performedBy: OrganizationActor;
  }) {
    await this.ensureApiKeyActive(d.apiKey);
    let ipFilters =
      d.input.ipFilters == undefined
        ? undefined
        : assertValidApiKeyIpFilters(d.input.ipFilters);

    let organization = await db.organization.findUniqueOrThrow({
      where: { oid: d.performedBy.organizationOid }
    });

    let res = await withTransaction(async db => {
      await Fabric.fire('machine_access.api_key.updated:before', {
        ...d,
        organization,
        machineAccess: d.apiKey.machineAccess
      });

      let apiKey = await db.apiKey.update({
        where: { oid: d.apiKey.oid },
        data: {
          name: d.input.name,
          description: d.input.description,
          expiresAt: d.input.expiresAt,
          ipFilters
        },
        include: {
          machineAccess: {
            include: {
              organization: true,
              user: true,
              instance: { include: { project: true } },
              actor: true
            }
          }
        }
      });

      await machineAccessService.updateMachineAccess({
        machineAccess: d.apiKey.machineAccess,
        input: {
          name: {
            instance_access_token_publishable: `INSTANCE TOKEN ${d.input.name}`,
            instance_access_token_secret: `INSTANCE TOKEN ${d.input.name}`,
            organization_management_token: `ORG TOKEN ${d.input.name}`
          }[d.apiKey.type]
        },
        performedBy: d.performedBy,
        context: d.context
      });

      return apiKey;
    });

    await Fabric.fire('machine_access.api_key.updated:after', {
      ...d,
      apiKey: res,
      organization,
      machineAccess: d.apiKey.machineAccess
    });

    return res;
  }

  async revokeApiKey(d: {
    apiKey: ApiKey & { machineAccess: MachineAccess };
    performedBy: OrganizationActor;
    context: Context;
  }) {
    await this.ensureApiKeyActive(d.apiKey);

    let organization = await db.organization.findUniqueOrThrow({
      where: { oid: d.performedBy.organizationOid }
    });

    let res = await withTransaction(async db => {
      await Fabric.fire('machine_access.api_key.revoked:before', {
        ...d,
        organization,
        machineAccess: d.apiKey.machineAccess
      });

      let apiKey = await db.apiKey.update({
        where: { oid: d.apiKey.oid },
        data: {
          status: 'deleted',
          deletedAt: new Date()
        },
        include: {
          machineAccess: {
            include: {
              organization: true,
              user: true,
              instance: { include: { project: true } },
              actor: true
            }
          }
        }
      });

      await machineAccessService.deleteMachineAccess({
        machineAccess: d.apiKey.machineAccess,
        performedBy: d.performedBy,
        context: d.context
      });

      return apiKey;
    });

    await Fabric.fire('machine_access.api_key.revoked:after', {
      ...d,
      apiKey: res,
      organization,
      machineAccess: d.apiKey.machineAccess
    });

    return res;
  }

  async rotateApiKey(d: {
    apiKey: ApiKey & { machineAccess: MachineAccess };
    performedBy: OrganizationActor;
    context: Context;
    input: { currentExpiresAt?: Date };
  }) {
    await this.ensureApiKeyActive(d.apiKey);

    let organization = await db.organization.findUniqueOrThrow({
      where: { oid: d.performedBy.organizationOid }
    });

    let res = await withTransaction(async db => {
      await Fabric.fire('machine_access.api_key.rotated:before', {
        ...d,
        organization,
        machineAccess: d.apiKey.machineAccess
      });

      let secretKey = UnifiedApiKey.create({
        type: d.apiKey.type,
        config: {
          url: getConfig().urls.apiUrl,
          instance: `v2-${env.service.METORIAL_REGION ?? 'ext'}`
        }
      });

      let currentSecrets = await db.apiKeySecret.findMany({
        where: {
          apiKeyOid: d.apiKey.oid,
          expiresAt: d.apiKey.expiresAt
        }
      });

      let newCurrentSecretExpiresAt = new Date(
        Math.min(
          d.apiKey.expiresAt?.getTime() ?? Infinity,
          d.input.currentExpiresAt?.getTime() ?? new Date().getTime()
        )
      );

      let apiKey = await db.apiKey.update({
        where: { oid: d.apiKey.oid },
        data: {
          secretRedacted: UnifiedApiKey.redact(secretKey),
          secretLength: secretKey.toString().length,

          canRevealUntil: d.apiKey.canRevealForever ? null : addMinutes(new Date(), 5)
        },
        include: {
          machineAccess: {
            include: {
              organization: true,
              user: true,
              instance: { include: { project: true } },
              actor: true
            }
          }
        }
      });

      let secret = await db.apiKeySecret.create({
        data: {
          id: await ID.generateId('apiKeySecret'),
          secret: secretKey.toString(),
          secretSha512: await Hash.sha512(secretKey.toString()),
          expiresAt: d.apiKey.expiresAt,
          apiKeyOid: apiKey.oid
        }
      });

      await db.apiKeySecret.updateMany({
        where: { id: { in: currentSecrets.map(s => s.id) } },
        data: {
          expiresAt: newCurrentSecretExpiresAt
        }
      });

      return {
        apiKey,
        secret
      };
    });

    await Fabric.fire('machine_access.api_key.rotated:after', {
      ...d,
      organization,
      apiKey: res.apiKey,
      machineAccess: d.apiKey.machineAccess
    });

    return res;
  }

  async revealApiKey(d: {
    apiKey: ApiKey & { machineAccess: MachineAccess };
    performedBy: OrganizationActor;
    context: Context;
  }) {
    await this.ensureApiKeyActive(d.apiKey);

    if (
      !d.apiKey.canRevealForever &&
      d.apiKey.canRevealUntil &&
      d.apiKey.canRevealUntil < new Date()
    ) {
      throw new ServiceError(
        forbiddenError({
          message: 'Cannot reveal this api key anymore'
        })
      );
    }

    let organization = await db.organization.findUniqueOrThrow({
      where: { oid: d.performedBy.organizationOid }
    });

    await Fabric.fire('machine_access.api_key:revealed', {
      ...d,
      organization,
      machineAccess: d.apiKey.machineAccess
    });

    let activeSecret = await db.apiKeySecret.findFirst({
      where: {
        apiKeyOid: d.apiKey.oid,
        expiresAt: d.apiKey.expiresAt
      }
    });

    if (!activeSecret) {
      throw new ServiceError(
        forbiddenError({
          message: 'Cannot reveal this api key anymore'
        })
      );
    }

    return activeSecret;
  }

  async getApiKeyById(d: { apiKeyId: string; organization: Organization }) {
    let apiKey = await db.apiKey.findFirst({
      where: {
        id: d.apiKeyId,
        kind: 'user_created',

        machineAccess: {
          organizationOid: d.organization.oid
        }
      },
      include: {
        machineAccess: {
          include: {
            organization: true,
            user: true,
            instance: { include: { project: true } },
            actor: true
          }
        }
      }
    });
    if (!apiKey) throw new ServiceError(notFoundError('api_key', d.apiKeyId));

    return apiKey;
  }

  async getApiKeyByIdForUser(d: { apiKeyId: string; user: User }) {
    let apiKey = await db.apiKey.findFirst({
      where: {
        id: d.apiKeyId,
        kind: 'user_created',

        machineAccess: {
          OR: [
            {
              organization: {
                members: {
                  some: {
                    userOid: d.user.oid
                  }
                }
              }
            },

            {
              instance: {
                organization: {
                  members: {
                    some: {
                      userOid: d.user.oid
                    }
                  }
                }
              }
            },

            {
              userOid: d.user.oid
            }
          ]
        }
      },
      include: {
        machineAccess: {
          include: {
            organization: true,
            user: true,
            instance: { include: { project: true } },
            actor: true
          }
        }
      }
    });
    if (!apiKey) throw new ServiceError(notFoundError('api_key', d.apiKeyId));

    return apiKey;
  }

  async listApiKeys(d: { filter: ListApiKeysFilter }) {
    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.apiKey.findMany({
            ...opts,
            where: {
              status: 'active',
              kind: 'user_created',

              ...(d.filter.type == 'organization_management_token'
                ? {
                    type: 'organization_management_token',
                    machineAccess: { organizationOid: d.filter.organization.oid }
                  }
                : {}),

              ...(d.filter.type == 'instance_access_token'
                ? {
                    type: {
                      in: ['instance_access_token_secret', 'instance_access_token_publishable']
                    },
                    machineAccess: {
                      instanceOid: d.filter.instance.oid,
                      organizationOid: d.filter.organization.oid
                    }
                  }
                : {})
            },
            include: {
              machineAccess: {
                include: {
                  organization: true,
                  user: true,
                  instance: {
                    include: {
                      project: true
                    }
                  },
                  actor: true
                }
              }
            }
          })
      )
    );
  }
}

export let apiKeyService = Service.create('apiKeyService', () => new ApiKeyService()).build();
