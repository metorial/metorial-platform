import { canonicalize } from '@metorial/canonicalize';
import {
  CustomServer,
  CustomServerVersion,
  db,
  ID,
  Instance,
  Organization,
  OrganizationActor,
  ServerVersion,
  withTransaction
} from '@metorial/db';
import { badRequestError, notFoundError, ServiceError } from '@metorial/error';
import { Hash } from '@metorial/hash';
import { createLock } from '@metorial/lock';
import { providerOauthConfigService } from '@metorial/module-provider-oauth';
import { Paginator } from '@metorial/pagination';
import { Service } from '@metorial/service';
import { createShortIdGenerator } from '@metorial/slugify';
import { validateJsonSchema } from '../lib/jsonSchema';
import { initializeRemoteQueue } from '../queues/initializeRemote';

let include = {
  customServer: {
    include: {
      server: true,
      serverVariant: true
    }
  },
  serverVersion: {
    include: {
      schema: true
    }
  },
  remoteServerInstance: {
    include: {
      providerOAuthConfig: true
    }
  },
  deployment: true,
  currentVersionForServer: true
};

let getVersionIdentifier = createShortIdGenerator(
  async id => !(await db.serverVersion.findFirst({ where: { identifier: id } })),
  { length: 8 }
);

let lock = createLock({ name: 'csrv/vers' });

let defaultRemoteConfigSchema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  $id: 'https://schema.metorial.com/remote-server-config.json',
  title: 'Remote Server Config',
  type: 'object',
  properties: {}
};

let defaultLaunchParams = `(config, ctx) => ({
  query: {},
  headers: ctx.getHeadersWithAuthorization({})
});`;

class CustomServerVersionServiceImpl {
  async createVersion(d: {
    server: CustomServer;
    instance: Instance;
    organization: Organization;
    performedBy: OrganizationActor;

    serverInstance: {
      type: 'remote';
      implementation: {
        remoteUrl: string;
        oAuthConfig?: {
          config: any;
          scopes: string[];
        };
      };
      config?: {
        schema?: any;
        getLaunchParams?: string;
      };
    };

    isEphemeralUpdate?: boolean;
  }) {
    if (d.serverInstance.config?.schema) {
      await validateJsonSchema(d.serverInstance.config.schema);
    }

    if (d.server.status != 'active' && !d.isEphemeralUpdate) {
      throw new ServiceError(
        badRequestError({
          message: 'Cannot update inactive server version'
        })
      );
    }

    if (d.server.type != d.serverInstance.type) {
      throw new ServiceError(
        badRequestError({
          reason: 'server_type_mismatch',
          message: `Server type mismatch: expected ${d.server.type}, got ${d.serverInstance.type}`
        })
      );
    }

    return await lock.usingLock(
      d.server.id,
      async () =>
        await withTransaction(async db => {
          let server = await db.customServer.findFirstOrThrow({
            where: { oid: d.server.oid }
          });

          let getLaunchParams: string;
          let configSchema: any;
          let serverVersionParams: Partial<ServerVersion> = {};

          if (d.serverInstance.type == 'remote') {
            getLaunchParams = d.serverInstance.config?.getLaunchParams ?? defaultLaunchParams;
            configSchema = d.serverInstance.config?.schema ?? defaultRemoteConfigSchema;
            serverVersionParams = {
              remoteUrl: d.serverInstance.implementation.remoteUrl
            };
          } else {
            throw new Error('WTF - Unsupported implementation type');
          }

          let { maxVersionIndex } = await db.customServer.update({
            where: { oid: server.oid },
            data: { maxVersionIndex: { increment: 1 } },
            select: { maxVersionIndex: true }
          });

          let versionHash = await getVersionIdentifier();

          let schemaData = {
            id: await ID.generateId('serverConfigSchema'),
            fingerprint: await Hash.sha256(canonicalize(configSchema)),
            schema: configSchema,
            serverOid: server.serverOid
          };
          let schema = await db.serverConfigSchema.upsert({
            where: {
              fingerprint_serverOid: {
                fingerprint: schemaData.fingerprint,
                serverOid: schemaData.serverOid
              }
            },
            create: schemaData,
            update: {}
          });

          let serverVersionData: Omit<ServerVersion, 'oid' | 'createdAt' | 'updatedAt'> = {
            id: await ID.generateId('serverVersion'),
            identifier: versionHash,
            serverVariantOid: server.serverVariantOid,
            serverOid: server.serverOid,
            sourceType: 'remote',
            schemaOid: schema.oid,
            getLaunchParams,
            ...(serverVersionParams as any)
          };

          let customServerVersion = await db.customServerVersion.create({
            data: {
              id: await ID.generateId('customServerVersion'),

              status: 'deploying',

              versionHash,
              versionIndex: maxVersionIndex,

              customServerOid: server.oid,
              // serverVersionOid: serverVersion.oid,
              instanceOid: d.instance.oid
            }
          });

          if (d.serverInstance.type == 'remote') {
            let url = new URL(d.serverInstance.implementation.remoteUrl);
            let name = url.hostname.replace(/^www\./, '').replace(/^mcp\./, '');

            let config = d.serverInstance.implementation.oAuthConfig
              ? await providerOauthConfigService.createConfig({
                  instance: d.instance,
                  config: d.serverInstance.implementation.oAuthConfig.config,
                  scopes: d.serverInstance.implementation.oAuthConfig.scopes
                })
              : undefined;

            let remoteServer = await db.remoteServerInstance.create({
              data: {
                id: await ID.generateId('remoteServerInstance'),
                remoteUrl: d.serverInstance.implementation.remoteUrl,
                instanceOid: d.instance.oid,
                name,

                providerOAuthConfigOid: config?.oid,
                providerOAuthDiscoveryStatus: config ? 'manual_config' : 'pending'
              }
            });

            let deployment = await db.customServerDeployment.create({
              data: {
                id: await ID.generateId('customServerDeployment'),

                status: 'queued',
                trigger: 'manual',

                customServerOid: server.oid,
                creatorActorOid: d.performedBy.oid
              }
            });

            await db.customServerVersion.updateMany({
              where: { id: customServerVersion.id },
              data: {
                remoteServerInstanceOid: remoteServer.oid,
                deploymentOid: deployment.oid
              }
            });

            await initializeRemoteQueue.add(
              { remoteId: remoteServer.id, serverVersionData },
              { delay: 1000 }
            );
          } else {
            throw new Error('WTF - Unsupported implementation type');
          }

          return await db.customServerVersion.findFirstOrThrow({
            where: { oid: customServerVersion.oid },
            include
          });
        })
    );
  }

  private async setCurrentVersionWithoutLock(d: {
    server: CustomServer;
    version: CustomServerVersion & { serverVersion: ServerVersion | null };
  }) {
    let serverVersion = d.version.serverVersion;
    if (!serverVersion) throw new Error('WTF - Server version not found');

    return await withTransaction(async db => {
      let version = await db.customServerVersion.findFirstOrThrow({
        where: {
          oid: d.version.oid
        }
      });
      if (version.status != 'available') {
        throw new ServiceError(
          badRequestError({
            message: 'Cannot set current version that is not available',
            hint: 'Please wait for the version to become available before setting it as current.'
          })
        );
      }

      await db.customServer.updateMany({
        where: { oid: d.server.oid },
        data: {
          currentVersionOid: d.version.oid
        }
      });

      await db.serverVariant.updateMany({
        where: { oid: d.server.serverVariantOid },
        data: {
          currentVersionOid: d.version.serverVersionOid,
          remoteUrl: serverVersion.remoteUrl,
          dockerImage: serverVersion.dockerImage,

          tools: serverVersion.tools as any,
          prompts: serverVersion.prompts as any,
          resourceTemplates: serverVersion.resourceTemplates as any,

          serverCapabilities: serverVersion.serverCapabilities as any,
          serverInfo: serverVersion.serverInfo as any,

          lastDiscoveredAt: serverVersion.lastDiscoveredAt
        }
      });
    });
  }

  async setCurrentVersion(d: {
    server: CustomServer;
    version: CustomServerVersion & { serverVersion: ServerVersion | null };
    isEphemeralUpdate?: boolean;
  }) {
    if (d.server.status != 'active' && !d.isEphemeralUpdate) {
      throw new ServiceError(
        badRequestError({
          message: 'Cannot update inactive server version'
        })
      );
    }

    await lock.usingLock(d.server.id, async () => await this.setCurrentVersionWithoutLock(d));

    return await db.customServerVersion.findFirstOrThrow({
      where: { oid: d.version.oid },
      include
    });
  }

  async listVersions(d: {
    server: CustomServer;
    instance?: Instance & { organization: Organization };
  }) {
    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.customServerVersion.findMany({
            ...opts,
            where: {
              customServerOid: d.server.oid,
              instanceOid: d.instance?.oid
            },
            include
          })
      )
    );
  }

  async getVersionById(d: {
    server: CustomServer & { currentVersion: CustomServerVersion | null };
    instance?: Instance & { organization: Organization };
    versionId: string;
  }) {
    if (d.versionId == 'current' && d.server.currentVersion) {
      d.versionId = d.server.currentVersion.id;
    }

    let version = await db.customServerVersion.findFirst({
      where: {
        OR: [{ id: d.versionId }, { versionHash: d.versionId }],

        customServerOid: d.server.oid,
        instanceOid: d.instance?.oid
      },
      include
    });
    if (!version) throw new ServiceError(notFoundError('custom_server_version', d.versionId));

    return version;
  }
}

export let customServerVersionService = Service.create(
  'customServerVersion',
  () => new CustomServerVersionServiceImpl()
).build();
