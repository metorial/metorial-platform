import { randomBytes } from 'crypto';
import type {
  PrismaClient,
  Workflow,
  Tenant,
  Provider
} from '../../../prisma/generated/client';
import { WorkflowStatus } from '../../../prisma/generated/client';
import { ID, snowflake } from '../../id';
import { defineFactory } from '@lowerdeck/testing-tools';
import { TenantFixtures } from './tenantFixtures';
import { ProviderFixtures } from './providerFixtures';

export const WorkflowFixtures = (db: PrismaClient) => {
  const tenantFixtures = TenantFixtures(db);
  const providerFixtures = ProviderFixtures(db);

  const defaultWorkflow = async (data: {
    tenantOid: bigint;
    providerOid: bigint;
    overrides?: Partial<Workflow>;
  }): Promise<Workflow> => {
    const oid = data.overrides?.oid ?? snowflake.nextId();
    const id = data.overrides?.id ?? (await ID.generateId('workflow'));
    const identifier =
      data.overrides?.identifier ?? `test-workflow-${randomBytes(4).toString('hex')}`;

    const factory = defineFactory<Workflow>(
      {
        oid,
        id,
        status: data.overrides?.status ?? WorkflowStatus.active,
        identifier,
        name: data.overrides?.name ?? `Test Workflow ${identifier}`,
        tenantOid: data.tenantOid,
        providerOid: data.providerOid,
        currentVersionOid: data.overrides?.currentVersionOid ?? null,
        createdAt: data.overrides?.createdAt ?? new Date(),
        updatedAt: data.overrides?.updatedAt ?? new Date(),
        deletedAt: data.overrides?.deletedAt ?? null
      } as Workflow,
      {
        persist: value => db.workflow.create({ data: value })
      }
    );

    return factory.create(data.overrides ?? {});
  };

  const withTenant = async (data?: {
    tenantOverrides?: Partial<Tenant>;
    providerOverrides?: Partial<Provider>;
    workflowOverrides?: Partial<Workflow>;
  }): Promise<Workflow & { tenant: Tenant; provider: Provider }> => {
    const tenant = await tenantFixtures.default(data?.tenantOverrides);
    const provider = await providerFixtures.awsCodeBuild(data?.providerOverrides);

    const workflow = await defaultWorkflow({
      tenantOid: tenant.oid,
      providerOid: provider.oid,
      overrides: data?.workflowOverrides
    });

    return db.workflow.findUniqueOrThrow({
      where: { id: workflow.id },
      include: { tenant: true, provider: true }
    }) as Promise<Workflow & { tenant: Tenant; provider: Provider }>;
  };

  return {
    default: defaultWorkflow,
    withTenant
  };
};
