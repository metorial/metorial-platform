import { badRequestError, notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import type { SlateInstanceOAuthSetup, SlateVersion } from '../../prisma/generated/browser';
import type {
  Slate,
  SlateInstanceConfiguration,
  SlateOAuthCredentials,
  Tenant
} from '../../prisma/generated/client';
import { db } from '../db';
import { getId } from '../id';
import { validateJsonSchema } from '../lib/validateJsonSchema';
import { type SecretSlateInstanceOauthSetup, secretService } from './secret';

let include = {
  slate: true,
  slateAuthConfig: {
    include: {
      authMethod: true
    }
  },
  oauthCredentials: true,
  instanceConfiguration: true
};

class slateOAuthSetupServiceImpl {
  async createSlateInstanceOAuthSetup(d: {
    tenant: Tenant;
    input: {
      oauthCredentials: SlateOAuthCredentials;
      slate: Slate;
      slateVersion?: SlateVersion;
      authMethodId?: string;
      redirectUrl: string;
      input: Record<string, any>;
      callbackUrlOverride?: string;
      instanceConfiguration?: SlateInstanceConfiguration;
    };
  }) {
    if (d.input.slateVersion && d.input.slateVersion.slateOid !== d.input.slate.oid) {
      throw new ServiceError(
        badRequestError({
          message: 'Slate Instance does not belong to the provided Slate.'
        })
      );
    }

    let version = await this.getVersion({
      slate: d.input.slate,
      lockedVersionOid: d.input.slateVersion?.oid ?? undefined
    });
    let authMethods = (version.specification?.slateAuthMethods ?? []).map(a => a.authMethod);

    let oauthAuthMethod = authMethods.find(m => m.type === 'oauth');
    if (!oauthAuthMethod) {
      throw new ServiceError(
        badRequestError({
          code: 'oauth_not_supported',
          message: 'OAuth is not supported by this provider.'
        })
      );
    }

    let authMethod = d.input.authMethodId
      ? authMethods.find(
          m =>
            m.id === d.input.authMethodId ||
            m.identifier === d.input.authMethodId ||
            m.type === d.input.authMethodId ||
            m.key === d.input.authMethodId
        )
      : oauthAuthMethod;

    if (!authMethod) {
      throw new ServiceError(notFoundError('slate.auth_method'));
    }

    let input = validateJsonSchema({
      schema: authMethod.spec.inputSchema,
      data: d.input.input,
      entity: 'oauth_setup.input',
      message: 'Invalid OAuth setup input.'
    });

    let secret = await secretService.createSecret({
      tenant: d.tenant,
      purpose: 'slate_oauth_setup',
      secretData: { input } satisfies SecretSlateInstanceOauthSetup
    });

    return await db.slateInstanceOAuthSetup.create({
      data: {
        ...getId('slateInstanceOAuthSetup'),
        status: 'unused',

        redirectUrl: d.input.redirectUrl,
        callbackUrlOverride: d.input.callbackUrlOverride,

        slateOid: d.input.slate.oid,
        tenantOid: d.tenant.oid,
        secretOid: secret.oid,
        oauthCredentialsOid: d.input.oauthCredentials.oid,
        authMethodOid: authMethod.oid,
        slateVersionOid: version.oid,
        instanceConfigurationOid: d.input.instanceConfiguration?.oid
      },
      include
    });
  }

  async getSlateInstanceOAuthSetupById(d: { tenant: Tenant; id: string }) {
    let slateInstanceOAuthSetup = await db.slateInstanceOAuthSetup.findFirst({
      where: {
        tenantOid: d.tenant.oid,
        id: d.id
      },
      include
    });
    if (!slateInstanceOAuthSetup)
      throw new ServiceError(notFoundError('slate.instance.oauth_setup'));
    return slateInstanceOAuthSetup;
  }

  async DANGEROUSLY_getSlateInstanceOAuthSetupById(d: { id: string }) {
    let slateInstanceOAuthSetup = await db.slateInstanceOAuthSetup.findFirst({
      where: {
        id: d.id
      },
      include
    });
    if (!slateInstanceOAuthSetup)
      throw new ServiceError(notFoundError('slate.instance.oauth_setup'));
    return slateInstanceOAuthSetup;
  }

  async listSlateInstanceOAuthSetups(d: { tenant: Tenant; slateIds?: string[] }) {
    let slates = d.slateIds
      ? await db.slate.findMany({
          where: {
            id: { in: d.slateIds }
          }
        })
      : undefined;

    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.slateInstanceOAuthSetup.findMany({
            ...opts,
            where: {
              tenantOid: d.tenant.oid,
              slateOid: slates ? { in: slates.map(s => s.oid) } : undefined
            },
            include
          })
      )
    );
  }

  async listIncompleteSlateInstanceOAuthSetups(d: { slateOAuthSetupIds?: string[] }) {
    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.slateInstanceOAuthSetup.findMany({
            ...opts,
            where: {
              id: d.slateOAuthSetupIds ? { in: d.slateOAuthSetupIds } : undefined,
              status: {
                in: ['unused', 'opened']
              }
            },
            include
          })
      )
    );
  }

  async getSlateInstanceOAuthSetupLogs(d: { setup: SlateInstanceOAuthSetup }) {
    return await db.slateInstanceOAuthSetup.findFirstOrThrow({
      where: { oid: d.setup.oid },
      include: {
        ...include,
        events: {
          include: {
            invocation: true
          }
        }
      }
    });
  }

  async DANGEROUSLY_getSlateInstanceOAuthSetupLogs(d: { id: string }) {
    let setup = await this.DANGEROUSLY_getSlateInstanceOAuthSetupById({ id: d.id });
    return this.getSlateInstanceOAuthSetupLogs({ setup });
  }

  private async getVersion(d: { slate: Slate; lockedVersionOid?: bigint }) {
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
        oid: d.lockedVersionOid ?? d.slate.currentVersionOid
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
    if (fullVersion.status !== 'active' || !fullVersion.activeDeploymentOid) {
      throw new ServiceError(
        badRequestError({
          message: 'Provider version has not been deployed yet.'
        })
      );
    }

    return fullVersion;
  }

  async getManySlateInstanceOAuthSetupsByIds(d: { ids: string[]; tenant: Tenant }) {
    return db.slateInstanceOAuthSetup.findMany({
      where: {
        tenantOid: d.tenant.oid,
        id: { in: d.ids }
      },
      include
    });
  }
}

export let slateOAuthSetupService = Service.create(
  'slateOAuthSetupService',
  () => new slateOAuthSetupServiceImpl()
).build();
