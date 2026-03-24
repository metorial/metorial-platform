import { badRequestError, notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import type {
  Slate,
  SlateConfigSchema,
  SlateInstance,
  SlateSpecification,
  SlateSpecificationConfigSchema,
  SlateVersion,
  Tenant
} from '../../prisma/generated/client';
import { db } from '../db';
import { getId } from '../id';
import { validateJsonSchema } from '../lib/validateJsonSchema';
import { slateInstanceConfigChangedQueue } from '../queues/instance/configChanged';

let include = {
  lockedSlateVersion: true,
  currentConfig: { include: { schema: true } },
  slate: true
};

class slateInstanceServiceImpl {
  async createSlateInstance(d: {
    slate: Slate;
    tenant: Tenant;
    input: {
      lockedVersion?: SlateVersion;
      config: Record<string, any>;
    };
  }) {
    let fullVersion = await this.getVersion({
      slate: d.slate,
      lockedVersion: d.input.lockedVersion
    });

    let { schema, storedConfig } = await this.getConfigSchema({
      slate: d.slate,
      version: fullVersion,
      config: d.input.config
    });

    return await db.$transaction(async db => {
      let instance = await db.slateInstance.create({
        data: {
          ...getId('slateInstance'),
          slateOid: d.slate.oid,
          tenantOid: d.tenant.oid,
          lockedSlateVersionOid: d.input.lockedVersion?.oid
        }
      });
      await db.slateInstanceEvent.createMany({
        data: {
          ...getId('slateInstanceEvent'),
          instanceOid: instance.oid,
          tenantOid: d.tenant.oid,
          type: 'slate_instance_created',
          payload: {}
        }
      });

      let config = await db.slateInstanceConfig.create({
        data: {
          ...getId('slateInstanceConfig'),
          instanceOid: instance.oid,
          tenantOid: d.tenant.oid,
          schemaOid: schema.oid,
          value: storedConfig
        }
      });
      await db.slateInstanceEvent.createMany({
        data: {
          ...getId('slateInstanceEvent'),
          instanceOid: instance.oid,
          tenantOid: d.tenant.oid,
          type: 'slate_config_set',
          payload: { configId: config.id }
        }
      });

      await slateInstanceConfigChangedQueue.add(
        { newConfigId: config.id, versionId: fullVersion.id },
        { delay: 100 }
      );

      return await db.slateInstance.update({
        where: { oid: instance.oid },
        data: { currentConfigOid: config.oid },
        include
      });
    });
  }

  async updateSlateInstance(d: {
    slateInstance: SlateInstance & { slate: Slate };
    input: {
      lockedVersion?: SlateVersion;
      config: Record<string, any>;
    };
  }) {
    let lockedVersionOid = d.input.lockedVersion?.oid ?? d.slateInstance.lockedSlateVersionOid;

    let fullVersion = await this.getVersion({
      slate: d.slateInstance.slate,
      lockedVersion: lockedVersionOid ? { oid: lockedVersionOid } : undefined
    });

    let { schema, storedConfig } = await this.getConfigSchema({
      slate: d.slateInstance.slate,
      version: fullVersion,
      config: d.input.config
    });

    return await db.$transaction(async db => {
      let config = await db.slateInstanceConfig.create({
        data: {
          ...getId('slateInstanceConfig'),
          instanceOid: d.slateInstance.oid,
          schemaOid: schema.oid,
          tenantOid: d.slateInstance.tenantOid,
          value: storedConfig
        }
      });
      await db.slateInstanceEvent.createMany({
        data: {
          ...getId('slateInstanceEvent'),
          instanceOid: d.slateInstance.oid,
          tenantOid: d.slateInstance.tenantOid,
          type: 'slate_config_set',
          payload: { configId: config.id }
        }
      });

      await slateInstanceConfigChangedQueue.add(
        { newConfigId: config.id, versionId: fullVersion.id },
        { delay: 100 }
      );

      return await db.slateInstance.update({
        where: { oid: d.slateInstance.oid },
        data: { currentConfigOid: config.oid },
        include
      });
    });
  }

  async getSlateInstanceById(d: { tenant: Tenant; id: string }) {
    let slateInstance = await db.slateInstance.findFirst({
      where: {
        tenantOid: d.tenant.oid,
        id: d.id
      },
      include
    });
    if (!slateInstance) throw new ServiceError(notFoundError('slate.instance'));
    return slateInstance;
  }

  async listSlateInstances(d: { tenant: Tenant; slateIds?: string[] }) {
    let slates = d.slateIds
      ? await db.slate.findMany({
          where: {
            id: { in: d.slateIds }
          }
        })
      : undefined;

    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.slateInstance.findMany({
            ...opts,
            where: {
              tenantOid: d.tenant.oid,
              slateOid: slates ? { in: slates.map(s => s.oid) } : undefined
            },
            include
          })
      )
    );
  }

  private async getVersion(d: { slate: Slate; lockedVersion?: { oid: bigint } }) {
    if (!d.slate.currentVersionOid) {
      throw new ServiceError(
        badRequestError({
          message: 'Provider does not have a current version set.'
        })
      );
    }

    let fullVersion = await db.slateVersion.findFirstOrThrow({
      where: {
        slateOid: d.slate.oid,
        oid: d.lockedVersion ? d.lockedVersion.oid : d.slate.currentVersionOid
      },
      include: {
        specification: {
          include: {
            slateConfigSchemas: {
              include: {
                configSchema: true
              }
            }
          }
        }
      }
    });
    if (fullVersion.status !== 'active' || !fullVersion.specification) {
      throw new ServiceError(
        badRequestError({
          message: 'Provider version has not been deployed yet.'
        })
      );
    }

    return fullVersion;
  }

  private async getConfigSchema(d: {
    slate: Slate;
    version: SlateVersion & {
      specification:
        | (SlateSpecification & {
            slateConfigSchemas: (SlateSpecificationConfigSchema & {
              configSchema: SlateConfigSchema | null;
            })[];
          })
        | null;
    };
    config: Record<string, any>;
  }) {
    let schema = d.version.specification?.slateConfigSchemas[0]?.configSchema;
    if (!schema) {
      throw new ServiceError(
        badRequestError({
          message: 'Provider version does not have a configuration schema.'
        })
      );
    }

    let storedConfig = validateJsonSchema({
      schema: schema.schema,
      data: d.config,
      entity: 'provider.config',
      message: 'Invalid provider configuration.'
    });

    return { schema, storedConfig };
  }

  async getManySlateInstancesByIds(d: { ids: string[]; tenant: Tenant }) {
    return db.slateInstance.findMany({
      where: {
        tenantOid: d.tenant.oid,
        id: { in: d.ids }
      },
      include
    });
  }
}

export let slateInstanceService = Service.create(
  'slateInstanceService',
  () => new slateInstanceServiceImpl()
).build();
