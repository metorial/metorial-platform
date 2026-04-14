import { randomBytes } from 'crypto';
import type {
  PrismaClient,
  Function as FunctionModel,
  Tenant,
  Runtime,
  Provider
} from '../../../prisma/generated/client';
import { FunctionStatus } from '../../../prisma/generated/client';
import { getId } from '../../id';
import { defineFactory } from '@lowerdeck/testing-tools';
import { TenantFixtures } from './tenantFixtures';
import { RuntimeFixtures } from './runtimeFixtures';

export const FunctionFixtures = (db: PrismaClient) => {
  const tenantFixtures = TenantFixtures(db);
  const runtimeFixtures = RuntimeFixtures(db);

  const defaultFunction = async (data: {
    tenantOid: bigint;
    runtimeOid?: bigint;
    overrides?: Partial<FunctionModel>;
  }): Promise<FunctionModel> => {
    const { oid, id } = getId('function');
    const identifier =
      data.overrides?.identifier ?? `test-function-${randomBytes(4).toString('hex')}`;

    const factory = defineFactory<FunctionModel>(
      {
        oid,
        id,
        status: data.overrides?.status ?? FunctionStatus.active,
        identifier,
        name: data.overrides?.name ?? `Test Function ${identifier}`,
        tenantOid: data.tenantOid,
        runtimeOid: data.runtimeOid ?? null,
        currentVersionOid: data.overrides?.currentVersionOid ?? null
      } as FunctionModel,
      {
        persist: value => db.function.create({ data: value })
      }
    );

    return factory.create(data.overrides ?? {});
  };

  const withTenant = async (data?: {
    tenantOverrides?: Partial<Tenant>;
    functionOverrides?: Partial<FunctionModel>;
  }): Promise<FunctionModel & { tenant: Tenant }> => {
    const tenant = await tenantFixtures.default(data?.tenantOverrides);

    const func = await defaultFunction({
      tenantOid: tenant.oid,
      overrides: data?.functionOverrides
    });

    return db.function.findUniqueOrThrow({
      where: { id: func.id },
      include: { tenant: true }
    }) as Promise<FunctionModel & { tenant: Tenant }>;
  };

  const withTenantAndRuntime = async (data?: {
    tenantOverrides?: Partial<Tenant>;
    runtimeOverrides?: Partial<Runtime>;
    functionOverrides?: Partial<FunctionModel>;
  }): Promise<FunctionModel & { tenant: Tenant; runtime: Runtime & { provider: Provider } }> => {
    const tenant = await tenantFixtures.default(data?.tenantOverrides);
    const runtime = await runtimeFixtures.nodejs22({
      runtimeOverrides: data?.runtimeOverrides
    });

    const func = await defaultFunction({
      tenantOid: tenant.oid,
      runtimeOid: runtime.oid,
      overrides: data?.functionOverrides
    });

    return db.function.findUniqueOrThrow({
      where: { id: func.id },
      include: { tenant: true, runtime: { include: { provider: true } } }
    }) as Promise<
      FunctionModel & { tenant: Tenant; runtime: Runtime & { provider: Provider } }
    >;
  };

  return {
    default: defaultFunction,
    withTenant,
    withTenantAndRuntime
  };
};
