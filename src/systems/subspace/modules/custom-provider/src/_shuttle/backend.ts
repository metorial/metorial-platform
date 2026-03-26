import {
  type CustomProvider,
  type CustomProviderConfig,
  db,
  snowflake,
  type Tenant
} from '@metorial-subspace/db';
import { getTenantForShuttle, shuttle } from '@metorial-subspace/provider-shuttle/src/client';

export type CustomProviderFromInternal =
  | {
      type: 'container.from_image_ref';
      imageRef: string;
      username?: string;
      password?: string;
    }
  | {
      type: 'remote';
      remoteUrl: string;
      protocol: 'sse' | 'streamable_http';
      oauthConfig?: Record<string, any>;
    }
  | {
      type: 'function';
      env: Record<string, string>;
      runtime:
        | { identifier: 'nodejs'; version: '24.x' | '22.x' }
        | { identifier: 'python'; version: '3.14' | '3.13' | '3.12' };
      files: {
        filename: string;
        content: string;
        encoding?: 'utf-8' | 'base64';
      }[];
    };

export let backend = {
  createCustomProvider: async (d: {
    tenant: Tenant;

    name: string;
    description?: string;

    from: CustomProviderFromInternal;
    config: CustomProviderConfig | undefined;
  }) => {
    let shuttleTenant = await getTenantForShuttle(d.tenant);

    let { server, deployment } = await shuttle.server.create({
      tenantId: shuttleTenant.id,

      name: d.name,
      description: d.description,

      from: d.from,
      config: d.config
    });

    let shuttleServer = await db.shuttleServer.create({
      data: {
        oid: snowflake.nextId(),
        id: server.id,
        identifier: server.id,
        shuttleTenantId: server.tenantId,
        type: server.type
      }
    });
    let shuttleCustomServer = await db.shuttleCustomServer.create({
      data: {
        oid: snowflake.nextId(),
        id: server.id,
        identifier: server.id,
        tenantOid: d.tenant.oid,
        shuttleTenantId: shuttleTenant.id,
        serverOid: shuttleServer.oid
      }
    });

    let shuttleCustomDeployment = await db.shuttleCustomServerDeployment.create({
      data: {
        oid: snowflake.nextId(),
        id: deployment.id,
        identifier: deployment.id,
        tenantOid: d.tenant.oid,
        serverOid: shuttleServer.oid,
        customServerOid: shuttleCustomServer.oid
      }
    });

    return {
      shuttleServer,
      shuttleCustomServer,
      shuttleCustomDeployment
    };
  },

  createCustomProviderVersion: async (d: {
    tenant: Tenant;
    customProvider: CustomProvider;

    from: CustomProviderFromInternal;
    config: CustomProviderConfig | undefined;
  }) => {
    let shuttleTenant = await getTenantForShuttle(d.tenant);

    let fullCustomProvider = await db.customProvider.findUniqueOrThrow({
      where: { oid: d.customProvider.oid, tenantOid: d.tenant.oid },
      include: {
        shuttleCustomServer: {
          include: {
            server: true
          }
        }
      }
    });
    let shuttleCustomServer = fullCustomProvider.shuttleCustomServer;
    let shuttleServer = shuttleCustomServer?.server;
    if (!shuttleCustomServer || !shuttleServer) {
      throw new Error('WTF - custom provider has no shuttle custom server');
    }

    let deployment = await shuttle.server.createVersion({
      tenantId: shuttleTenant.id,
      serverId: shuttleServer.id,

      from: d.from,
      config: d.config
    });

    let shuttleCustomDeployment = await db.shuttleCustomServerDeployment.create({
      data: {
        oid: snowflake.nextId(),
        id: deployment.id,
        identifier: deployment.id,
        tenantOid: d.tenant.oid,
        serverOid: shuttleServer.oid,
        customServerOid: shuttleCustomServer.oid
      }
    });

    return {
      shuttleServer,
      shuttleCustomServer,
      shuttleCustomDeployment
    };
  }
};
