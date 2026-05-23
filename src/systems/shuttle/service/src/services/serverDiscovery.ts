import { delay } from '@mtsrc/delay';
import { badRequestError, notFoundError, ServiceError } from '@mtsrc/error';
import { Service } from '@mtsrc/service';
import { subHours } from 'date-fns';
import type {
  Server,
  ServerAuthConfig,
  ServerConfig,
  ServerDiscovery,
  ServerVersion,
  Tenant
} from '../../prisma/generated/client';
import { db } from '../db';
import { getId } from '../id';
import { discoverServerQueue } from '../queues/discovery/server';
import { serverConnectionService } from './serverConnection';

let include = {
  serverConfig: true,
  serverAuthConfig: true,
  specification: true,
  serverVersion: {
    include: { functionServer: true }
  }
};

class serverDiscoveryServiceImpl {
  async createServerDiscovery(d: {
    tenant: Tenant;
    input: {
      serverConfig: ServerConfig;
      serverAuthConfig?: ServerAuthConfig;
      serverVersion: ServerVersion & { server: Server };
    };
  }) {
    let paramRes = await serverConnectionService.resolveServerConnectionParams(d);

    if (process.env.NODE_ENV == 'production') {
      let recentDiscovery = await db.serverDiscovery.findFirst({
        where: {
          tenantOid: d.tenant.oid,
          serverConfigOid: d.input.serverConfig.oid,
          serverVersionOid: d.input.serverVersion.oid,
          serverAuthConfigOid: d.input.serverAuthConfig?.oid,
          createdAt: {
            gt: subHours(new Date(), 24)
          }
        },
        include
      });
      if (recentDiscovery) return recentDiscovery;
    }

    let discovery = await db.serverDiscovery.create({
      data: {
        ...getId('serverDiscovery'),
        ...paramRes.params,
        status: 'pending',
        tenantOid: d.tenant.oid
      },
      include
    });

    await discoverServerQueue.add({
      serverDiscoveryId: discovery.id
    });

    return discovery;
  }

  async getDiscoveryById(d: { tenant: Tenant; serverDiscoveryId: string }) {
    let discovery = await db.serverDiscovery.findFirst({
      where: {
        id: d.serverDiscoveryId,
        tenantOid: d.tenant.oid
      },
      include
    });
    if (!discovery) throw new ServiceError(notFoundError('server_discovery'));
    return discovery;
  }

  async waitForServerDiscovery(d: { serverDiscovery: ServerDiscovery }) {
    for (let i = 0; i < 150; i++) {
      let discovery = await db.serverDiscovery.findFirstOrThrow({
        where: { oid: d.serverDiscovery.oid },
        include
      });
      if (discovery?.status != 'pending') return discovery;
      await delay(i > 5 ? 5000 : 1000);
    }

    throw new ServiceError(
      badRequestError({
        message: 'Timeout waiting for server discovery to complete'
      })
    );
  }

  async getServerDiscoveryForVersion(d: { tenant: Tenant; serverVersion: ServerVersion }) {
    return await db.serverDiscovery.findFirst({
      where: {
        tenantOid: d.tenant.oid,
        serverVersionOid: d.serverVersion.oid
      },
      include
    });
  }
}

export let serverDiscoveryService = Service.create(
  'serverDiscoveryService',
  () => new serverDiscoveryServiceImpl()
).build();
