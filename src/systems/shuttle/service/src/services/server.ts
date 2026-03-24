import {
  badRequestError,
  forbiddenError,
  notFoundError,
  ServiceError
} from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import z from 'zod';
import type { Server, ServerRemoteProtocol, Tenant } from '../../prisma/generated/client';
import { db } from '../db';
import { getId } from '../id';
import { checkJsonata } from '../lib/jsonata/check';
import { validateJsonSchema } from '../lib/jsonSchema/validateSchema';
import { serverCreatedQueue } from '../queues/lifecycle/server';
import { addAfterTransactionHook, withTransaction } from '../transaction';
import { serverDeploymentCreateService } from './serverDeploymentCreate';

export type ServerFrom =
  | {
      type: 'container.from_image_ref';
      imageRef: string;
      username?: string;
      password?: string;
    }
  | {
      type: 'remote';
      remoteUrl: string;
      protocol: ServerRemoteProtocol;
      oauthConfig?: Record<string, any>;
    }
  | {
      type: 'function';
      files: {
        filename: string;
        content: string;
        encoding?: 'utf-8' | 'base64';
      }[];
      env: Record<string, string>;
      runtime:
        | { identifier: 'nodejs'; version: '24.x' | '22.x' }
        | { identifier: 'python'; version: '3.14' | '3.13' | '3.12' };
    };

export type ServerConfig = {
  schema: Record<string, any>;
  transformer: string;
};

let include = {
  draftRepositoryTag: {
    include: {
      tenant: true,
      currentVersion: true,
      repository: {
        include: {
          registry: true
        }
      }
    }
  },
  currentVersion: true,
  remoteOauthConfig: true,
  delegatedOauthConfig: true,
  tenant: true
};

let defaultConfigs = {
  container: {
    schema: z
      .object({
        env: z.record(z.string(), z.string()).optional(),
        cmd: z.array(z.string()).optional(),
        args: z.array(z.string()).optional()
      })
      .toJSONSchema(),

    transformer: `{
  "env": $.config.env,
  "cmd": $.config.cmd,
  "args": $.config.args
}`
  },

  remote: {
    schema: z
      .object({
        headers: z.record(z.string(), z.string()).optional(),
        query: z.record(z.string(), z.string()).optional()
      })
      .toJSONSchema(),
    transformer: `{
  "headers": $.config.headers,
  "query": $.config.query
}`
  },

  function: {
    schema: z.object({}).toJSONSchema(),
    transformer: `$.config`
  }
};

class serverServiceImpl {
  async createServer(d: {
    scope: { type: 'global' } | { type: 'tenant'; tenant: Tenant };

    input: {
      from: ServerFrom;
      config?: ServerConfig;

      name: string;
      description?: string;
      metadata?: Record<string, any>;
    };
  }) {
    if (d.input.config) {
      let schemaOk = validateJsonSchema({
        schema: d.input.config.schema
      });

      if (!schemaOk) {
        throw new ServiceError(
          badRequestError({
            message: 'Invalid server configuration schema provided.'
          })
        );
      }

      let jsonataOk = await checkJsonata(d.input.config.transformer);
      if (!jsonataOk) {
        throw new ServiceError(
          badRequestError({
            message: 'Invalid server configuration transformer provided.'
          })
        );
      }
    }

    if (d.input.from.type == 'container.from_image_ref') {
      return await this.createServerContainer({
        scope: d.scope,
        input: {
          imageRef: d.input.from.imageRef,
          username: d.input.from.username,
          password: d.input.from.password,
          config: d.input.config,
          name: d.input.name,
          description: d.input.description,
          metadata: d.input.metadata
        }
      });
    }

    if (d.input.from.type == 'function') {
      if (d.input.config) {
        throw new ServiceError(
          badRequestError({ message: 'Custom providers cannot have custom configurations.' })
        );
      }

      return await this.createServerFunction({
        scope: d.scope,
        input: {
          files: d.input.from.files,
          env: d.input.from.env,
          runtime: d.input.from.runtime,
          name: d.input.name,
          description: d.input.description,
          metadata: d.input.metadata
        }
      });
    }

    if (d.input.from.type == 'remote') {
      if (d.input.config) {
        throw new ServiceError(
          badRequestError({ message: 'Remote providers cannot have custom configurations.' })
        );
      }

      return await this.createServerRemote({
        scope: d.scope,
        input: {
          remoteUrl: d.input.from.remoteUrl,
          protocol: d.input.from.protocol,
          oauthConfig: d.input.from.oauthConfig,
          name: d.input.name,
          description: d.input.description,
          metadata: d.input.metadata
        }
      });
    }

    throw new ServiceError(badRequestError({ message: 'Invalid server creation input.' }));
  }

  async getServerById(d: { tenant: Tenant; serverId: string }) {
    let server = await db.server.findFirst({
      where: {
        id: d.serverId,
        OR: [{ tenantOid: d.tenant.oid }, { tenantOid: null }]
      },
      include
    });
    if (!server) throw new ServiceError(notFoundError('server'));
    return server;
  }

  async listServers(d: { tenant: Tenant }) {
    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.server.findMany({
            ...opts,
            where: {
              OR: [{ tenantOid: d.tenant.oid }, { tenantOid: null }]
            },
            include
          })
      )
    );
  }

  async getManyServersByIds(d: { tenant?: Tenant; serverIds: string[] }) {
    return await db.server.findMany({
      where: {
        id: { in: d.serverIds },
        OR: d.tenant ? [{ tenantOid: d.tenant.oid }, { tenantOid: null }] : undefined
      },
      include
    });
  }

  async updateServer(d: {
    tenant: Tenant;
    server: Server;
    input: { name?: string; description?: string };
  }) {
    if (!d.server.tenantOid) {
      throw new ServiceError(
        forbiddenError({
          message: 'Cannot update a public server.'
        })
      );
    }
    if (d.tenant.oid !== d.server.tenantOid) {
      throw new ServiceError(
        forbiddenError({
          message: 'Cannot update a server in another tenant.'
        })
      );
    }

    return await db.server.update({
      where: {
        oid: d.server.oid
      },
      data: {
        name: d.input.name,
        description: d.input.description
      },
      include
    });
  }

  async createServerVersion(d: {
    tenant: Tenant;
    server: Server;
    input: {
      from: ServerFrom;
      config?: ServerConfig;
    };
  }) {
    if (!d.server.tenantOid) {
      throw new ServiceError(
        forbiddenError({
          message: 'Cannot update a public server.'
        })
      );
    }
    if (d.tenant.oid !== d.server.tenantOid) {
      throw new ServiceError(
        forbiddenError({
          message: 'Cannot create a server version for a server in another tenant.'
        })
      );
    }

    if (d.input.config) {
      let schemaOk = validateJsonSchema({
        schema: d.input.config.schema
      });

      if (!schemaOk) {
        throw new ServiceError(
          badRequestError({
            message: 'Invalid server configuration schema provided.'
          })
        );
      }

      let jsonataOk = await checkJsonata(d.input.config.transformer);
      if (!jsonataOk) {
        throw new ServiceError(
          badRequestError({
            message: 'Invalid server configuration transformer provided.'
          })
        );
      }
    }

    if (d.server.type == 'container') {
      let from = d.input.from;
      if (from.type != 'container.from_image_ref') {
        throw new ServiceError(
          badRequestError({
            message: 'Cannot change server type when creating a new version.'
          })
        );
      }

      if (d.input.config) {
        await db.server.update({
          where: { oid: d.server.oid },
          data: {
            draftConfigSchema: d.input.config.schema,
            draftConfigTransformer: d.input.config.transformer
          }
        });
      }

      return await serverDeploymentCreateService.deployContainerServer({
        scope: { type: 'tenant', tenant: d.tenant },
        server: d.server,
        input: {
          imageRef: from.imageRef,
          username: from.username,
          password: from.password
        }
      });
    }

    if (d.server.type == 'remote') {
      if (d.input.config) {
        throw new ServiceError(
          badRequestError({ message: 'Remote providers cannot have custom configurations.' })
        );
      }

      let from = d.input.from;
      if (from.type != 'remote') {
        throw new ServiceError(
          badRequestError({
            message: 'Cannot change server type when creating a new version.'
          })
        );
      }

      let parsedNew = new URL(from.remoteUrl);
      let parsedCurrent = new URL(d.server.draftRemoteUrl!);
      if (parsedNew.origin != parsedCurrent.origin) {
        throw new ServiceError(
          badRequestError({
            message: 'Cannot change remote server host when creating a new version.'
          })
        );
      }

      return await serverDeploymentCreateService.deployRemoteServer({
        scope: { type: 'tenant', tenant: d.tenant },
        server: d.server,
        input: {
          remoteUrl: from.remoteUrl,
          protocol: from.protocol
        }
      });
    }

    if (d.server.type == 'function') {
      if (d.input.config) {
        throw new ServiceError(
          badRequestError({ message: 'Custom providers cannot have custom configurations.' })
        );
      }

      let from = d.input.from;
      if (from.type != 'function') {
        throw new ServiceError(
          badRequestError({
            message: 'Cannot change server type when creating a new version.'
          })
        );
      }

      return await serverDeploymentCreateService.deployFunctionServer({
        scope: { type: 'tenant', tenant: d.tenant },
        server: d.server,
        input: {
          files: from.files,
          env: from.env,
          runtime: from.runtime
        }
      });
    }

    throw new ServiceError(badRequestError({ message: 'Invalid server creation input.' }));
  }

  private async createServerContainer(d: {
    scope: { type: 'global' } | { type: 'tenant'; tenant: Tenant };

    input: {
      imageRef: string;
      username?: string;
      password?: string;

      config?: {
        schema: Record<string, any>;
        transformer: string;
      };

      name: string;
      description?: string;
      metadata?: Record<string, any>;
    };
  }) {
    return await withTransaction(async db => {
      let server = await db.server.create({
        data: {
          ...getId('server'),

          type: 'container',
          name: d.input.name,
          description: d.input.description,
          metadata: d.input.metadata,

          draftConfigSchema: d.input.config?.schema ?? defaultConfigs.container.schema,
          draftConfigTransformer:
            d.input.config?.transformer ?? defaultConfigs.container.transformer,

          tenantOid: d.scope.type === 'tenant' ? d.scope.tenant.oid : null
        },
        include
      });
      await addAfterTransactionHook(() => serverCreatedQueue.add({ serverId: server.id }));

      let deployment = await serverDeploymentCreateService.deployContainerServer({
        scope: d.scope,
        server,
        input: {
          imageRef: d.input.imageRef,
          username: d.input.username,
          password: d.input.password
        }
      });

      return { server, deployment };
    });
  }

  private async createServerFunction(d: {
    scope: { type: 'global' } | { type: 'tenant'; tenant: Tenant };

    input: {
      files: {
        filename: string;
        content: string;
        encoding?: 'utf-8' | 'base64';
      }[];
      env: Record<string, string>;
      runtime:
        | { identifier: 'nodejs'; version: '24.x' | '22.x' }
        | { identifier: 'python'; version: '3.14' | '3.13' | '3.12' };

      name: string;
      description?: string;
      metadata?: Record<string, any>;
    };
  }) {
    return await withTransaction(async db => {
      let server = await db.server.create({
        data: {
          ...getId('server'),

          type: 'function',
          name: d.input.name,
          description: d.input.description,
          metadata: d.input.metadata,

          draftConfigSchema: defaultConfigs.function.schema,
          draftConfigTransformer: defaultConfigs.function.transformer,

          tenantOid: d.scope.type === 'tenant' ? d.scope.tenant.oid : null
        },
        include
      });
      await addAfterTransactionHook(() => serverCreatedQueue.add({ serverId: server.id }));

      let deployment = await serverDeploymentCreateService.deployFunctionServer({
        scope: d.scope,
        server,
        input: {
          files: d.input.files,
          env: d.input.env,
          runtime: d.input.runtime
        }
      });

      return {
        server,
        deployment
      };
    });
  }

  private async createServerRemote(d: {
    scope: { type: 'global' } | { type: 'tenant'; tenant: Tenant };

    input: {
      remoteUrl: string;
      protocol: ServerRemoteProtocol;
      oauthConfig?: Record<string, any>;

      name: string;
      description?: string;
      metadata?: Record<string, any>;
    };
  }) {
    return withTransaction(async db => {
      let server = await db.server.create({
        data: {
          ...getId('server'),

          type: 'remote',
          name: d.input.name,
          description: d.input.description,
          metadata: d.input.metadata,

          draftRemoteUrl: d.input.remoteUrl,
          draftRemoteProtocol: d.input.protocol,

          draftConfigSchema: defaultConfigs.remote.schema,
          draftConfigTransformer: defaultConfigs.remote.transformer,

          tenantOid: d.scope.type === 'tenant' ? d.scope.tenant.oid : null
        },
        include
      });
      await addAfterTransactionHook(() => serverCreatedQueue.add({ serverId: server.id }));

      let deployment = await serverDeploymentCreateService.deployRemoteServer({
        scope: d.scope,
        server,
        input: {
          remoteUrl: d.input.remoteUrl,
          protocol: d.input.protocol,
          oauthConfig: d.input.oauthConfig
        }
      });

      return {
        server,
        deployment
      };
    });
  }
}

export let serverService = Service.create(
  'serverService',
  () => new serverServiceImpl()
).build();
