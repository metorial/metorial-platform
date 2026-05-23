import { badRequestError, notFoundError, ServiceError } from '@mtsrc/error';
import { Paginator } from '@mtsrc/pagination';
import { Service } from '@mtsrc/service';
import { v } from '@mtsrc/validation';
import type { Server, ServerVersion, Tenant } from '../../prisma/generated/client';
import { db } from '../db';
import { getId } from '../id';
import { processJsonata } from '../lib/jsonata/process';
import { validateWithJsonSchema } from '../lib/jsonSchema/validateData';
import { secretService } from './secret';

let include = {
  server: true,
  tenant: true
};

class serverConfigServiceImpl {
  async createServerConfig(d: {
    tenant: Tenant;

    input: {
      config: Record<string, unknown>;

      server: Server;
      serverVersion?: ServerVersion;
    };
  }) {
    if (!d.input.server.currentVersionOid) {
      throw new ServiceError(
        badRequestError({
          message: 'Provider has not been deployed yet'
        })
      );
    }

    let version =
      d.input.serverVersion ??
      (await db.serverVersion.findFirstOrThrow({
        where: { oid: d.input.server.currentVersionOid }
      }));

    let config = validateWithJsonSchema({
      schema: version.configSchema,
      data: d.input.config,
      entity: 'config',
      message: 'The provided configuration is not valid for this provider.'
    });

    let configOutput: Record<string, unknown> = {};
    try {
      configOutput = (await processJsonata(version.configTransformer, { config })) as any;
    } catch (err) {
      throw new ServiceError(
        badRequestError({
          message: 'Error processing configuration transformer.'
        })
      );
    }

    if (d.input.server.type == 'container') {
      let valRes = v
        .object({
          env: v.nullable(v.optional(v.record(v.string()))),
          cmd: v.nullable(v.optional(v.array(v.string()))),
          args: v.nullable(v.optional(v.array(v.string())))
        })
        .validate(configOutput);

      if (!valRes.success) {
        throw new ServiceError(
          badRequestError({
            message: 'Transformed configuration is not valid for container providers.',
            description:
              'Please ensure that the transform outputs env, cmd, and args correctly.'
          })
        );
      }

      configOutput = valRes.value;
    } else if (d.input.server.type == 'remote') {
      let valRes = v
        .object({
          headers: v.nullable(v.optional(v.record(v.string()))),
          query: v.nullable(v.optional(v.record(v.string())))
        })
        .validate(configOutput);

      if (!valRes.success) {
        throw new ServiceError(
          badRequestError({
            message: 'Transformed configuration is not valid for remote providers.'
          })
        );
      }

      configOutput = valRes.value;
    }

    let secret = await secretService.createSecret({
      purpose: 'server_config_value',
      tenant: d.tenant,
      secretData: {
        input: config,
        transformed: configOutput
      }
    });

    return await db.serverConfig.create({
      data: {
        ...getId('serverConfig'),

        secretOid: secret.oid,
        serverOid: d.input.server.oid,
        tenantOid: d.tenant.oid
      },
      include
    });
  }

  async getServerConfigById(d: { tenant: Tenant; serverConfigId: string }) {
    let serverConfig = await db.serverConfig.findFirst({
      where: {
        tenantOid: d.tenant.oid,
        id: d.serverConfigId
      },
      include
    });
    if (!serverConfig) throw new ServiceError(notFoundError('server_config'));
    return serverConfig;
  }

  async deleteServerConfig(d: {
    tenant: Tenant;
    serverConfig: {
      oid: bigint;
      secretOid: bigint;
    };
  }) {
    return await db.$transaction(async db => {
      let connections = await db.serverConnection.findMany({
        where: {
          serverConfigOid: d.serverConfig.oid
        },
        select: { oid: true }
      });
      let connectionOids = connections.map(connection => connection.oid);

      await db.serverDiscovery.deleteMany({
        where: {
          OR: [
            { serverConfigOid: d.serverConfig.oid },
            connectionOids.length ? { connectionOid: { in: connectionOids } } : undefined!
          ].filter(Boolean)
        }
      });

      if (connectionOids.length) {
        await db.serverConnectionNetworkRule.deleteMany({
          where: {
            serverConnectionOid: { in: connectionOids }
          }
        });

        await db.serverConnectionLogsTemp.deleteMany({
          where: {
            serverConnectionOid: { in: connectionOids }
          }
        });

        await db.functionServerInvocation.updateMany({
          where: {
            connectionOid: { in: connectionOids }
          },
          data: {
            connectionOid: null
          }
        });

        await db.serverConnection.deleteMany({
          where: {
            oid: { in: connectionOids }
          }
        });
      }

      await secretService.DANGEROUSLY_deleteSecret({
        secretOid: d.serverConfig.secretOid,
        tenant: d.tenant,
        db
      });

      await db.serverConfig.deleteMany({
        where: {
          oid: d.serverConfig.oid
        }
      });
    });
  }

  async listServerConfigs(d: { tenant: Tenant }) {
    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.serverConfig.findMany({
            ...opts,
            where: { tenantOid: d.tenant.oid },
            include
          })
      )
    );
  }
}

export let serverConfigService = Service.create(
  'serverConfigService',
  () => new serverConfigServiceImpl()
).build();
