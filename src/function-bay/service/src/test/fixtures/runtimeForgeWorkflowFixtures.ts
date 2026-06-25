import { randomBytes } from 'crypto';
import type {
  PrismaClient,
  RuntimeForgeWorkflow,
  Runtime,
  Tenant,
  Provider
} from '../../../prisma/generated/client';
import { snowflake } from '../../id';
import { defineFactory } from '@lowerdeck/testing-tools';
import { RuntimeFixtures } from './runtimeFixtures';
import { TenantFixtures } from './tenantFixtures';

export const RuntimeForgeWorkflowFixtures = (db: PrismaClient) => {
  const runtimeFixtures = RuntimeFixtures(db);
  const tenantFixtures = TenantFixtures(db);

  const defaultWorkflow = async (data: {
    runtimeOid: bigint;
    tenantOid: bigint;
    overrides?: Partial<RuntimeForgeWorkflow>;
  }): Promise<RuntimeForgeWorkflow> => {
    const oid = snowflake.nextId();

    const factory = defineFactory<RuntimeForgeWorkflow>(
      {
        oid,
        runtimeOid: data.runtimeOid,
        tenantOid: data.tenantOid,
        forgeWorkflowId: data.overrides?.forgeWorkflowId ?? `wf_${randomBytes(8).toString('hex')}`,
        forgeTenantId: data.overrides?.forgeTenantId ?? `ft_${randomBytes(8).toString('hex')}`,
        forgeWorkflowVersionId:
          data.overrides?.forgeWorkflowVersionId ?? `wfv_${randomBytes(8).toString('hex')}`
      } as RuntimeForgeWorkflow,
      {
        persist: value => db.runtimeForgeWorkflow.create({ data: value })
      }
    );

    return factory.create(data.overrides ?? {});
  };

  const withRuntimeAndTenant = async (data?: {
    runtimeOverrides?: Partial<Runtime>;
    tenantOverrides?: Partial<Tenant>;
    workflowOverrides?: Partial<RuntimeForgeWorkflow>;
  }): Promise<
    RuntimeForgeWorkflow & {
      runtime: Runtime & { provider: Provider };
      tenant: Tenant;
    }
  > => {
    const runtime = await runtimeFixtures.nodejs22({
      runtimeOverrides: data?.runtimeOverrides
    });
    const tenant = await tenantFixtures.default(data?.tenantOverrides);

    const workflow = await defaultWorkflow({
      runtimeOid: runtime.oid,
      tenantOid: tenant.oid,
      overrides: data?.workflowOverrides
    });

    return db.runtimeForgeWorkflow.findUniqueOrThrow({
      where: { oid: workflow.oid },
      include: {
        runtime: { include: { provider: true } },
        tenant: true
      }
    }) as Promise<
      RuntimeForgeWorkflow & {
        runtime: Runtime & { provider: Provider };
        tenant: Tenant;
      }
    >;
  };

  return {
    default: defaultWorkflow,
    withRuntimeAndTenant
  };
};
