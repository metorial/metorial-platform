import { Context } from '@metorial/context';
import {
  db,
  ID,
  Instance,
  Organization,
  OrganizationActor,
  ServerConfigVault
} from '@metorial/db';
import { notFoundError, ServiceError } from '@metorial/error';
import { secretService } from '@metorial/module-secret';
import { Paginator } from '@metorial/pagination';
import { Service } from '@metorial/service';

let include = {
  secret: true
};

class serverConfigVaultServiceImpl {
  async listServerConfigVaults(d: { instance: Instance }) {
    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.serverConfigVault.findMany({
            ...opts,
            where: {
              instanceOid: d.instance.oid
            },
            include
          })
      )
    );
  }

  async getServerConfigVaultById(d: { instance: Instance; serverConfigVaultId: string }) {
    let serverConfigVault = await db.serverConfigVault.findFirst({
      where: {
        id: d.serverConfigVaultId,
        instanceOid: d.instance.oid
      },
      include
    });
    if (!serverConfigVault)
      throw new ServiceError(notFoundError('server_config_vault', d.serverConfigVaultId));

    return serverConfigVault;
  }

  async createServerConfigVault(d: {
    organization: Organization;
    performedBy: OrganizationActor;
    instance: Instance;
    context: Context;
    input: {
      name: string;
      description?: string;
      metadata?: Record<string, any>;
      config: Record<string, any>;
    };
  }) {
    let secret = await secretService.createSecret({
      organization: d.organization,
      performedBy: d.performedBy,
      instance: d.instance,
      input: {
        type: 'server_config_vault',
        secretData: d.input.config
      }
    });

    return await db.serverConfigVault.create({
      data: {
        id: await ID.generateId('serverConfigVault'),
        name: d.input.name,
        description: d.input.description,
        metadata: d.input.metadata,
        secretOid: secret.oid,
        instanceOid: d.instance.oid
      },
      include
    });
  }

  async updateServerConfigVault(d: {
    instance: Instance;
    serverConfigVault: ServerConfigVault;
    input: {
      name?: string;
      description?: string;
      metadata?: Record<string, any>;
    };
  }) {
    return await db.serverConfigVault.update({
      where: {
        oid: d.serverConfigVault.oid,
        instanceOid: d.instance.oid
      },
      data: {
        name: d.input.name ?? d.serverConfigVault.name,
        description: d.input.description ?? d.serverConfigVault.description,
        metadata: d.input.metadata ?? d.serverConfigVault.metadata
      },
      include
    });
  }
}

export let serverConfigVaultService = Service.create(
  'serverConfigVault',
  () => new serverConfigVaultServiceImpl()
).build();
