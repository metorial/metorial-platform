import { canonicalize } from '@metorial/canonicalize';
import {
  CustomServer,
  CustomServerVersion,
  db,
  ensureServerConfig,
  ID,
  Instance,
  Organization,
  RemoteServerInstance,
  ServerVersion,
  withTransaction
} from '@metorial/db';
import { badRequestError, notFoundError, ServiceError } from '@metorial/error';
import { Hash } from '@metorial/hash';
import { createLock } from '@metorial/lock';
import { Paginator } from '@metorial/pagination';
import { Service } from '@metorial/service';
import { createShortIdGenerator } from '@metorial/slugify';
import { validateJsonSchema } from '../lib/jsonSchema';
import { customServerEnvironmentService } from './customServerEnvironment';

let include = {
  customServer: {
    include: { server: true }
  },
  environment: {
    include: { serverVariant: true }
  },
  instance: true,
  serverVersion: true,
  remoteServerInstance: {
    include: {
      connection: true
    }
  },
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
  properties: {
    accessToken: {
      type: 'string',
      description: 'The access token to authenticate with the remote server.'
    }
  }
};

let defaultLaunchParams = `(config) => ({
  headers: {
    Authorization: \`Bearer \${config.accessToken}\`
  }, 
  query: {}
})`;

class CustomServerVersionServiceImpl {
  async createVersion(d: {
    server: CustomServer;
    instance: Instance;
    organization: Organization;

    serverInstance: {
      type: 'remote';
      implementation: RemoteServerInstance;

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

    if (d.serverInstance.implementation.instanceOid != d.instance.oid) {
      throw new Error('WTF - Remote server instance does not match instance');
    }

    return await lock.usingLock(
      d.server.id,
      async () =>
        await withTransaction(async db => {
          let environment = await customServerEnvironmentService.ensureEnvironment({
            server: d.server,
            instance: d.instance,
            organization: d.organization
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

            if (!d.serverInstance.implementation.name) {
              await db.remoteServerInstance.update({
                where: { oid: d.serverInstance.implementation.oid },
                data: {
                  name: d.server.name,
                  description: d.server.description
                }
              });
            }
          } else {
            throw new Error('WTF - Unsupported implementation type');
          }

          let { maxVersionIndex } = await db.customServerEnvironment.update({
            where: { oid: environment.oid },
            data: { maxVersionIndex: { increment: 1 } },
            select: { maxVersionIndex: true }
          });

          let versionHash = await getVersionIdentifier();

          let schema = await ensureServerConfig(async () => ({
            fingerprint: await Hash.sha256(canonicalize(configSchema)),
            schema: configSchema,
            serverOid: d.server.serverOid,
            serverVariantOid: environment.serverVariantOid
          }));

          let serverVersion = await db.serverVersion.create({
            data: {
              id: await ID.generateId('serverVersion'),
              identifier: versionHash,
              serverVariantOid: environment.serverVariantOid,
              serverOid: d.server.serverOid,
              sourceType: 'remote',
              schemaOid: schema.oid,
              getLaunchParams,

              ...(serverVersionParams as any)
            }
          });

          let customServerVersion = await db.customServerVersion.create({
            data: {
              id: await ID.generateId('customServerVersion'),

              status: 'available',

              versionHash,
              versionIndex: maxVersionIndex,

              customServerOid: d.server.oid,
              environmentOid: environment.oid,
              serverVersionOid: serverVersion.oid,
              instanceOid: d.instance.oid,

              remoteServerInstanceOid:
                d.serverInstance.type == 'remote' ? d.serverInstance.implementation.oid : null
            },
            include
          });

          if (!environment.currentVersionOid) {
            await this.setCurrentVersionWithoutLock({
              server: d.server,
              instance: d.instance,
              organization: d.organization,
              version: customServerVersion,
              isEphemeralUpdate: true
            });
          }

          return customServerVersion;
        })
    );
  }

  // async importVersionFromOtherInstance(d: {
  //   server: CustomServer;
  //   organization: Organization;

  //   toInstance: Instance;
  //   fromInstance: Instance;

  //   specificVersionId?: string;
  // }) {
  //   if (d.server.status != 'active') {
  //     throw new ServiceError(
  //       badRequestError({
  //         message: 'Cannot update inactive server version'
  //       })
  //     );
  //   }

  //   return withTransaction(async db => {
  //     let otherEnvironment = await customServerEnvironmentService.ensureEnvironment({
  //       server: d.server,
  //       instance: d.fromInstance,
  //       organization: d.organization
  //     });
  //     if (!otherEnvironment.currentVersionOid && !d.specificVersionId) {
  //       throw new ServiceError(
  //         badRequestError({
  //           message: 'Cannot import version from instance without a current version'
  //         })
  //       );
  //     }

  //     let versionToImport = await db.customServerVersion.findFirst({
  //       where: {
  //         customServerOid: d.server.oid,
  //         environmentOid: otherEnvironment.oid,

  //         id: d.specificVersionId,
  //         oid: !d.specificVersionId ? otherEnvironment.currentVersionOid! : undefined
  //       },
  //       include: {
  //         remoteServerInstance: true,
  //         serverVersion: {
  //           include: {
  //             schema: true
  //           }
  //         }
  //       }
  //     });
  //     if (!versionToImport) {
  //       throw new ServiceError(
  //         badRequestError({
  //           message: 'Invalid version to import'
  //         })
  //       );
  //     }

  //     if (d.server.type == 'remote') {
  //       if (!versionToImport.remoteServerInstance) {
  //         throw new Error('WTF - Remote server instance not found for import');
  //       }

  //       return await this.createVersion({
  //         server: d.server,
  //         instance: d.toInstance,
  //         organization: d.organization,
  //         serverInstance: {
  //           type: 'remote',
  //           implementation: versionToImport.remoteServerInstance!,
  //           config: {
  //             schema: versionToImport.serverVersion.schema,
  //             getLaunchParams: versionToImport.serverVersion.getLaunchParams
  //           }
  //         }
  //       });
  //     } else {
  //       throw new Error('WTF - Unsupported server type for import');
  //     }
  //   });
  // }

  private async setCurrentVersionWithoutLock(d: {
    server: CustomServer;
    instance: Instance;
    organization: Organization;
    version: CustomServerVersion & { serverVersion: ServerVersion };
    isEphemeralUpdate?: boolean;
  }) {
    if (d.server.status != 'active' && !d.isEphemeralUpdate) {
      throw new ServiceError(
        badRequestError({
          message: 'Cannot update inactive server version'
        })
      );
    }

    return await withTransaction(async db => {
      let environment = await customServerEnvironmentService.ensureEnvironment({
        server: d.server,
        instance: d.instance,
        organization: d.organization
      });

      await db.customServerEnvironment.updateMany({
        where: { oid: environment.oid },
        data: {
          currentVersionOid: d.version.oid
        }
      });

      await db.serverVariant.updateMany({
        where: { oid: environment.serverVariantOid },
        data: {
          currentVersionOid: d.version.serverVersionOid,
          remoteUrl: d.version.serverVersion.remoteUrl,
          dockerImage: d.version.serverVersion.dockerImage,

          tools: d.version.serverVersion.tools as any,
          prompts: d.version.serverVersion.prompts as any,
          resourceTemplates: d.version.serverVersion.resourceTemplates as any,

          serverCapabilities: d.version.serverVersion.serverCapabilities as any,
          serverInfo: d.version.serverVersion.serverInfo as any,

          lastDiscoveredAt: d.version.serverVersion.lastDiscoveredAt
        }
      });
    });
  }

  async setCurrentVersion(d: {
    server: CustomServer;
    instance: Instance;
    organization: Organization;
    version: CustomServerVersion & { serverVersion: ServerVersion };
    isEphemeralUpdate?: boolean;
  }) {
    if (d.server.status != 'active' && !d.isEphemeralUpdate) {
      throw new ServiceError(
        badRequestError({
          message: 'Cannot update inactive server version'
        })
      );
    }

    return await lock.usingLock(
      d.server.id,
      async () => await this.setCurrentVersionWithoutLock(d)
    );
  }

  async listVersions(d: {
    server: CustomServer;
    instance?: Instance & { organization: Organization };
  }) {
    let environment = d.instance
      ? await customServerEnvironmentService.ensureEnvironment({
          server: d.server,
          instance: d.instance,
          organization: d.instance.organization
        })
      : undefined;

    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.customServerVersion.findMany({
            ...opts,
            where: {
              customServerOid: d.server.oid,
              environmentOid: environment?.oid
            },
            include
          })
      )
    );
  }

  async getVersionById(d: {
    server: CustomServer;
    instance?: Instance & { organization: Organization };
    versionId: string;
  }) {
    let environment = d.instance
      ? await customServerEnvironmentService.ensureEnvironment({
          server: d.server,
          instance: d.instance,
          organization: d.instance.organization
        })
      : undefined;

    let version = await db.customServerVersion.findFirst({
      where: {
        OR: [{ id: d.versionId }, { versionHash: d.versionId }],

        customServerOid: d.server.oid,
        environmentOid: environment?.oid
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
