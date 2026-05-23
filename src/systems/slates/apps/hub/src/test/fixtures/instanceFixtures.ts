import { randomBytes } from 'crypto';
import type {
  PrismaClient,
  SlateConfigSchema,
  SlateInstance,
  SlateInstanceConfig
} from '../../../prisma/generated/client';
import { getId } from '../../id';
import { defineFactory } from '@mtsrc/testing-tools';

export const SlateConfigSchemaFixtures = (db: PrismaClient) => {
  const defaultSchema = async (data: {
    slateOid: bigint;
    specificationOid: bigint;
    overrides?: Partial<SlateConfigSchema>;
  }): Promise<SlateConfigSchema> => {
    const { oid, id } = getId('slateConfigSchema');
    const identifier = `config-schema-${randomBytes(4).toString('hex')}`;

    const factory = defineFactory<SlateConfigSchema>(
      {
        oid,
        id,
        identifier,
        hash: `hash_${randomBytes(8).toString('hex')}`,
        schema: {},
        slateOid: data.slateOid,
        mostRecentSpecificationOid: data.specificationOid,
        ...data.overrides
      } as SlateConfigSchema,
      {
        persist: value => db.slateConfigSchema.create({ data: value })
      }
    );

    return factory.create(data.overrides ?? {});
  };

  return {
    default: defaultSchema
  };
};

export const SlateInstanceConfigFixtures = (db: PrismaClient) => {
  const defaultConfig = async (data: {
    instanceOid: bigint;
    schemaOid: bigint;
    tenantOid: bigint;
    value?: Record<string, unknown>;
    overrides?: Partial<SlateInstanceConfig>;
  }): Promise<SlateInstanceConfig> => {
    const { oid, id } = getId('slateInstanceConfig');

    const factory = defineFactory<SlateInstanceConfig>(
      {
        oid,
        id,
        instanceOid: data.instanceOid,
        schemaOid: data.schemaOid,
        tenantOid: data.tenantOid,
        value: data.value ?? {},
        ...data.overrides
      } as SlateInstanceConfig,
      {
        persist: value => db.slateInstanceConfig.create({ data: value })
      }
    );

    return factory.create(data.overrides ?? {});
  };

  return {
    default: defaultConfig
  };
};

export const SlateInstanceFixtures = (db: PrismaClient) => {
  const defaultInstance = async (data: {
    slateOid: bigint;
    tenantOid: bigint;
    overrides?: Partial<SlateInstance>;
  }): Promise<SlateInstance> => {
    const { oid, id } = getId('slateInstance');

    const factory = defineFactory<SlateInstance>(
      {
        oid,
        id,
        slateOid: data.slateOid,
        tenantOid: data.tenantOid,
        ...data.overrides
      } as SlateInstance,
      {
        persist: value => db.slateInstance.create({ data: value })
      }
    );

    return factory.create(data.overrides ?? {});
  };

  const withConfig = async (data: {
    slateOid: bigint;
    tenantOid: bigint;
    specificationOid: bigint;
    configValue?: Record<string, unknown>;
    instanceOverrides?: Partial<SlateInstance>;
    schemaOverrides?: Partial<SlateConfigSchema>;
    configOverrides?: Partial<SlateInstanceConfig>;
  }): Promise<{
    instance: SlateInstance;
    configSchema: SlateConfigSchema;
    instanceConfig: SlateInstanceConfig;
  }> => {
    const configSchemaFixtures = SlateConfigSchemaFixtures(db);
    const configSchema = await configSchemaFixtures.default({
      slateOid: data.slateOid,
      specificationOid: data.specificationOid,
      overrides: data.schemaOverrides
    });

    const instance = await defaultInstance({
      slateOid: data.slateOid,
      tenantOid: data.tenantOid,
      overrides: data.instanceOverrides
    });

    const instanceConfigFixtures = SlateInstanceConfigFixtures(db);
    const instanceConfig = await instanceConfigFixtures.default({
      instanceOid: instance.oid,
      schemaOid: configSchema.oid,
      tenantOid: data.tenantOid,
      value: data.configValue,
      overrides: data.configOverrides
    });

    await db.slateInstance.update({
      where: { oid: instance.oid },
      data: { currentConfigOid: instanceConfig.oid }
    });

    const updatedInstance = await db.slateInstance.findUniqueOrThrow({
      where: { oid: instance.oid }
    });

    return {
      instance: updatedInstance,
      configSchema,
      instanceConfig
    };
  };

  return {
    default: defaultInstance,
    withConfig
  };
};
