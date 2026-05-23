import type {
  PrismaClient,
  ServerDeployment,
  Server,
  Tenant
} from '../../../prisma/generated/client';
import { ServerDeploymentStatus } from '../../../prisma/generated/client';
import { getId } from '../../id';
import { defineFactory } from '@mtsrc/testing-tools';
import { ServerFixtures } from './serverFixtures';
import { TenantFixtures } from './tenantFixtures';

export const ServerDeploymentFixtures = (db: PrismaClient) => {
  const defaultDeployment = async (data: {
    serverOid: bigint;
    tenantOid: bigint;
    overrides?: Partial<ServerDeployment>;
  }): Promise<ServerDeployment> => {
    const { oid, id } = getId('serverDeployment');

    const factory = defineFactory<ServerDeployment>(
      {
        oid,
        id,
        status: ServerDeploymentStatus.queued,
        serverOid: data.serverOid,
        tenantOid: data.tenantOid,
        functionServerOid: data.overrides?.functionServerOid ?? null,
        createdAt: new Date(),
        updatedAt: new Date(),
        startedAt: null,
        endedAt: null,
        ...data.overrides
      } as ServerDeployment,
      {
        persist: value => db.serverDeployment.create({ data: value })
      }
    );

    return factory.create(data.overrides ?? {});
  };

  const withServer = async (data: {
    tenantOid: bigint;
    serverOverrides?: Partial<Server>;
    deploymentOverrides?: Partial<ServerDeployment>;
  }): Promise<ServerDeployment & { server: Server }> => {
    const serverFixtures = ServerFixtures(db);
    const server = await serverFixtures.default({
      tenantOid: data.tenantOid,
      overrides: data.serverOverrides
    });

    const deployment = await defaultDeployment({
      serverOid: server.oid,
      tenantOid: data.tenantOid,
      overrides: data.deploymentOverrides
    });

    return db.serverDeployment.findUniqueOrThrow({
      where: { id: deployment.id },
      include: { server: true }
    }) as Promise<ServerDeployment & { server: Server }>;
  };

  const withTenant = async (data?: {
    tenantOverrides?: Partial<Tenant>;
    serverOverrides?: Partial<Server>;
    deploymentOverrides?: Partial<ServerDeployment>;
  }): Promise<ServerDeployment & { tenant: Tenant; server: Server }> => {
    const tenantFixtures = TenantFixtures(db);
    const tenant = await tenantFixtures.default(data?.tenantOverrides);

    const serverFixtures = ServerFixtures(db);
    const server = await serverFixtures.default({
      tenantOid: tenant.oid,
      overrides: data?.serverOverrides
    });

    const deployment = await defaultDeployment({
      serverOid: server.oid,
      tenantOid: tenant.oid,
      overrides: data?.deploymentOverrides
    });

    return db.serverDeployment.findUniqueOrThrow({
      where: { id: deployment.id },
      include: { tenant: true, server: true }
    }) as Promise<ServerDeployment & { tenant: Tenant; server: Server }>;
  };

  return {
    default: defaultDeployment,
    withServer,
    withTenant
  };
};
