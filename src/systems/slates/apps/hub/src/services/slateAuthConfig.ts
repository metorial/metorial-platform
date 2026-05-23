import { badRequestError, notFoundError, ServiceError } from '@mtsrc/error';
import { Paginator } from '@mtsrc/pagination';
import { Service } from '@mtsrc/service';
import type {
  Slate,
  SlateAuthConfig,
  SlateVersion,
  Tenant
} from '../../prisma/generated/client';
import { db } from '../db';
import { ID, snowflake } from '../id';
import { extractExpiresAt } from '../lib/extractExpiresAt';
import { validateJsonSchema } from '../lib/validateJsonSchema';
import { processAuthQueue } from '../queues/instance/processAuth';
import { secretService } from './secret';

let include = {
  slate: true,
  authMethod: true,
  instance: true,
  oauthCredentials: true
};

class slateAuthConfigServiceImpl {
  async createSlateAuthConfig(d: {
    tenant: Tenant;
    slate: Slate;
    // slateInstance?: SlateInstance;
    slateVersion?: SlateVersion;
    input: {
      authMethodId?: string;
      authConfig: Record<string, any>;
    };
  }) {
    let fullVersion = await this.getVersion({
      slate: d.slate,
      currentVersionOid: d.slateVersion?.oid
    });

    let defaultAuthMethod =
      fullVersion.specification?.slateAuthMethods.find(m => m.authMethod.type === 'token') ??
      fullVersion.specification?.slateAuthMethods[0];

    let method = d.input.authMethodId
      ? fullVersion.specification?.slateAuthMethods.find(
          m =>
            m.authMethod.id === d.input.authMethodId ||
            m.authMethod.identifier === d.input.authMethodId ||
            m.authMethod.type === d.input.authMethodId ||
            m.authMethod.key === d.input.authMethodId
        )
      : defaultAuthMethod;
    if (!method) {
      if (d.input.authMethodId) {
        throw new ServiceError(
          badRequestError({
            code: 'invalid_auth_method_id',
            message: 'Invalid authentication method ID.'
          })
        );
      }

      throw new ServiceError(
        badRequestError({
          code: 'auto_not_supported',
          message: 'Authentication is not supported for this provider.'
        })
      );
    }

    // For oauth we use the output schema since we are manually setting oauth credentials here
    let schema =
      method.authMethod.type === 'oauth'
        ? method.authMethod.spec.outputSchema
        : method.authMethod.spec.inputSchema;

    let storedConfig = d.input.authConfig;
    if (method.authMethod.type === 'oauth') {
      storedConfig.refreshToken = '0'; // Placeholder to pass schema validation

      if (schema?.properties?.expiresAt) {
        schema.required = [...new Set([...(schema.required ?? []), 'expiresAt'])];
      }
    }

    storedConfig = validateJsonSchema({
      schema,
      data: storedConfig,
      entity: 'provider.auth_config',
      message: 'Invalid provider authentication configuration.'
    });

    let configId = await ID.generateId('slateAuthConfig');
    let secret = await secretService.createSecret({
      tenant: d.tenant,
      purpose: 'slate_authentication_configuration',
      secretData:
        method.authMethod.type === 'oauth' ? { output: storedConfig } : { input: storedConfig }
    });

    let tokenExpiresAt = extractExpiresAt(storedConfig);

    let config = await db.slateAuthConfig.create({
      data: {
        oid: snowflake.nextId(),
        id: configId,
        type: method.authMethod.type === 'oauth' ? 'oauth_manual' : 'manual',
        isProcessing: true,
        tokenExpiresAt,

        // instanceOid: d.slateInstance?.oid,
        slateOid: d.slate.oid,
        authMethodOid: method.authMethod.oid,
        tenantOid: d.tenant.oid,
        secretOid: secret.oid
      },
      include
    });

    await processAuthQueue.add({
      configId: config.id
    });

    return config;
  }

  async getSlateAuthConfigById(d: { tenant: Tenant; id: string }) {
    let slateAuthConfig = await db.slateAuthConfig.findFirst({
      where: {
        tenantOid: d.tenant.oid,
        id: d.id
      },
      include
    });
    if (!slateAuthConfig) throw new ServiceError(notFoundError('slate.auth_config'));
    return slateAuthConfig;
  }

  async deleteSlateAuthConfig(d: { tenant: Tenant; slateAuthConfig: SlateAuthConfig }) {
    return await db.$transaction(async db => {
      await db.slateAuthConfigUsedForInstance.deleteMany({
        where: {
          configOid: d.slateAuthConfig.oid
        }
      });

      await db.slateInstance.updateMany({
        where: {
          tenantOid: d.tenant.oid,
          defaultAuthConfigOid: d.slateAuthConfig.oid
        },
        data: {
          defaultAuthConfigOid: null
        }
      });

      await db.slateInstanceOAuthSetup.updateMany({
        where: {
          tenantOid: d.tenant.oid,
          slateAuthConfigOid: d.slateAuthConfig.oid
        },
        data: {
          slateAuthConfigOid: null
        }
      });

      await secretService.DANGEROUSLY_deleteSecret({
        secretOid: d.slateAuthConfig.secretOid,
        tenant: d.tenant,
        db
      });

      await db.slateAuthConfig.deleteMany({
        where: {
          oid: d.slateAuthConfig.oid
        }
      });
    });
  }

  async listSlateAuthConfigs(d: {
    tenant: Tenant;
    slateInstanceIds?: string[];
    slateIds?: string[];
  }) {
    let slateInstances = d.slateInstanceIds
      ? await db.slateInstance.findMany({
          where: { id: { in: d.slateInstanceIds }, tenantOid: d.tenant.oid }
        })
      : undefined;
    let slates = d.slateIds
      ? await db.slate.findMany({
          where: { id: { in: d.slateIds } }
        })
      : undefined;

    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.slateAuthConfig.findMany({
            ...opts,
            where: {
              tenantOid: d.tenant.oid,

              instanceOid: slateInstances
                ? { in: slateInstances.map(si => si.oid) }
                : undefined,

              slateOid: slates ? { in: slates.map(s => s.oid) } : undefined
            },
            include
          })
      )
    );
  }

  async DANGEROUSLY_decryptAuthConfig(d: {
    slateAuthConfig: SlateAuthConfig;
    tenant: Tenant;
    note: string;
  }) {
    let secret = await secretService.DANGEROUSLY_decryptSecret({
      secretOid: d.slateAuthConfig.secretOid,
      purpose: 'slate_authentication_configuration',
      tenant: d.tenant
    });

    await db.slateAuthConfigManualDecrypt.create({
      data: {
        oid: snowflake.nextId(),
        configOid: d.slateAuthConfig.oid,
        note: d.note
      }
    });

    return (
      (d.slateAuthConfig.type === 'manual'
        ? secret.input
        : {
            ...secret.input,
            ...secret.output
          }) ?? {}
    );
  }

  private async getVersion(d: { currentVersionOid?: bigint; slate: Slate }) {
    if (!d.slate.currentVersionOid) {
      throw new ServiceError(
        badRequestError({
          message: 'Provider does not have a current version set.'
        })
      );
    }

    let fullVersion = await db.slateVersion.findFirstOrThrow({
      where: {
        slateOid: d.slate.oid,
        oid: d.currentVersionOid ?? d.slate.currentVersionOid
      },
      include: {
        specification: {
          include: {
            slateAuthMethods: {
              include: {
                authMethod: true
              }
            }
          }
        }
      }
    });
    if (fullVersion.status !== 'active' || !fullVersion.specification) {
      throw new ServiceError(
        badRequestError({
          message: 'Provider version has not been deployed yet.'
        })
      );
    }

    return fullVersion;
  }

  async getManySlateAuthConfigsByIds(d: { ids: string[]; tenant: Tenant }) {
    return db.slateAuthConfig.findMany({
      where: {
        tenantOid: d.tenant.oid,
        id: { in: d.ids }
      },
      include
    });
  }
}

export let slateAuthConfigService = Service.create(
  'slateAuthConfigService',
  () => new slateAuthConfigServiceImpl()
).build();
