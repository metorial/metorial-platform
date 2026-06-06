import { forbiddenError, notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import { Context } from '@metorial/context';
import {
  addAfterTransactionHook,
  db,
  ID,
  MachineAccess,
  OAuthApplication,
  OAuthApplicationClientSecret,
  OAuthApplicationStatus,
  OAuthApplicationType,
  OAuthAuthorizationAccessLevel,
  Organization,
  OrganizationActor,
  withTransaction
} from '@metorial/db';
import { Fabric } from '@metorial/fabric';
import { generateCustomId } from '@metorial/id';
import { validateOAuthScopes } from '../lib/oauthScopeValidation';
import { validateUri } from '../lib/oauthUrls';
import { machineAccessService } from './machineAccess';

let machineAccessInclude = {
  organization: true,
  user: true,
  instance: {
    include: {
      project: true
    }
  },
  actor: true
} as const;

let include = {
  organization: true,
  clientSecrets: {
    where: {
      deletedAt: null
    }
  },
  serverSideMachineAccess: {
    include: machineAccessInclude
  },
  scopedInstallation: {
    include: {
      organization: true,
      serverSideMachineAccess: {
        include: machineAccessInclude
      }
    }
  }
} as const;

class OAuthApplicationService {
  private buildClientSecretPreview(secret: string) {
    return `${secret.slice(0, 4)}••••${secret.slice(-4)}`;
  }

  private assertApplicationOwnedLocally(oauthApplication: OAuthApplication) {
    if (!oauthApplication.isImportedFromOtherInstance) return;

    throw new ServiceError(
      forbiddenError({
        message: 'This oauth application is managed by another deployment'
      })
    );
  }

  private async createClientSecret(d: { oauthApplication: OAuthApplication }) {
    let existingSecrets = await db.oAuthApplicationClientSecret.findMany({
      where: {
        oauthApplicationOid: d.oauthApplication.oid,
        deletedAt: null
      }
    });
    if (existingSecrets.length >= 25) {
      throw new ServiceError(
        forbiddenError({
          message: 'Cannot have more than 25 client secrets for an oauth application'
        })
      );
    }

    let secret = generateCustomId('mt_oauth_secret', 50);

    return await withTransaction(async db => {
      let newSecret = await db.oAuthApplicationClientSecret.create({
        data: {
          id: await ID.generateId('clientSecret'),
          secret,
          secretPreview: this.buildClientSecretPreview(secret),
          oauthApplicationOid: d.oauthApplication.oid
        }
      });

      await Fabric.fire('machine_access.oauth_application.client_secret.create:after', {
        oauthApplication: d.oauthApplication
      });

      return newSecret;
    });
  }

  private async assertApplicationActive(oauthApplication: OAuthApplication) {
    if (oauthApplication.status != 'active') {
      throw new ServiceError(
        forbiddenError({
          message: 'Cannot perform this action on an archived oauth application'
        })
      );
    }
  }

  private assertSupportedType(type: OAuthApplicationType) {
    if (type == 'cli_auth') {
      throw new ServiceError(
        forbiddenError({
          message: 'CLI auth oauth applications are not supported by this service yet'
        })
      );
    }
  }

  private assertGlobalUserFacingApplication(oauthApplication: OAuthApplication) {
    if (
      oauthApplication.type == 'user_facing' &&
      oauthApplication.accessLevel == 'global' &&
      oauthApplication.organizationOid == null
    ) {
      return;
    }

    throw new ServiceError(
      forbiddenError({
        message: 'Only global user-facing oauth applications are supported by this action'
      })
    );
  }

  private assertAllowedAccessLevel(d: {
    type: Exclude<OAuthApplicationType, 'cli_auth'>;
    accessLevel: OAuthAuthorizationAccessLevel;
    organization: Organization;
  }) {
    if (d.type == 'server_side' && d.accessLevel != 'organization') {
      throw new ServiceError(
        forbiddenError({
          message: 'Server-side oauth applications must be organization-scoped'
        })
      );
    }
  }

  private buildMachineAccessName(name: string) {
    return `SERVICE ACCOUNT${name}`;
  }

  private async createScopedInstallation(d: {
    oauthApplication: OAuthApplication;
    organization: Organization;
    serverSideMachineAccess?: MachineAccess | null;
  }) {
    return withTransaction(async db => {
      return await db.oAuthInstallation.create({
        data: {
          id: await ID.generateId('oauthInstallation'),
          status: 'active',
          scopes: d.oauthApplication.scopes,
          oauthApplicationOid: d.oauthApplication.oid,
          organizationOid: d.organization.oid,
          serverSideMachineAccessOid: d.serverSideMachineAccess?.oid
        },
        include: {
          organization: true,
          serverSideMachineAccess: {
            include: machineAccessInclude
          }
        }
      });
    });
  }

  async createOAuthApplication(d: {
    organization: Organization;
    performedBy: OrganizationActor;
    context: Context;
    input: {
      type: 'user_facing' | 'server_side';
      accessLevel: OAuthAuthorizationAccessLevel;
      allowClientSecretlessTokenExchange?: boolean;
      name: string;
      description?: string;
      websiteUrl?: string;
      privacyPolicyUrl?: string;
      termsOfServiceUrl?: string;
      redirectUris?: string[];
      scopes: string[];
      image?: PrismaJson.EntityImage;
    };
  }) {
    this.assertSupportedType(d.input.type);
    this.assertAllowedAccessLevel({
      type: d.input.type,
      accessLevel: d.input.accessLevel,
      organization: d.organization
    });

    let scopes = validateOAuthScopes(d.input.scopes);
    let redirectUris = (d.input.redirectUris ?? []).map(uri => {
      validateUri(uri);
      return uri;
    });

    let res = await withTransaction(async db => {
      let serverSideMachineAccess =
        d.input.type == 'server_side'
          ? await machineAccessService.createMachineAccess({
              type: 'organization_management',
              organization: d.organization,
              performedBy: d.performedBy,
              context: d.context,
              input: {
                name: this.buildMachineAccessName(d.input.name),
                hasCustomScopes: true,
                scopes
              }
            })
          : null;

      await Fabric.fire('machine_access.oauth_application.created:before', {
        ...d,
        serverSideMachineAccess
      });

      let oauthApplication = await db.oAuthApplication.create({
        data: {
          id: await ID.generateId('oauthApplication'),
          status: 'active',
          type: d.input.type,
          accessLevel: d.input.accessLevel,
          allowClientSecretlessTokenExchange:
            d.input.allowClientSecretlessTokenExchange ?? false,
          name: d.input.name,
          description: d.input.description,
          websiteUrl: d.input.websiteUrl,
          privacyPolicyUrl: d.input.privacyPolicyUrl,
          termsOfServiceUrl: d.input.termsOfServiceUrl,
          redirectUris,
          scopes,
          clientId: generateCustomId('mt_oauth_', 32),
          image: d.input.image ?? { type: 'default' },
          organizationOid: d.organization.oid,
          serverSideMachineAccessOid: serverSideMachineAccess?.oid
        }
      });

      if (d.input.type == 'server_side' || d.input.accessLevel == 'organization') {
        let scopedInstallation = await this.createScopedInstallation({
          oauthApplication,
          organization: d.organization,
          serverSideMachineAccess
        });

        oauthApplication = await db.oAuthApplication.update({
          where: { oid: oauthApplication.oid },
          data: {
            scopedInstallationOid: scopedInstallation.oid
          }
        });
      }

      let res = {
        oauthApplication: await db.oAuthApplication.findUniqueOrThrow({
          where: { oid: oauthApplication.oid },
          include
        }),
        serverSideMachineAccess
      };

      addAfterTransactionHook(() =>
        Fabric.fire('machine_access.oauth_application.created:after', {
          ...d,
          oauthApplication: res.oauthApplication,
          serverSideMachineAccess: res.serverSideMachineAccess
        })
      );

      return res;
    });

    return res.oauthApplication;
  }

  async updateOAuthApplication(d: {
    oauthApplication: OAuthApplication;
    organization: Organization;
    performedBy: OrganizationActor;
    context: Context;
    input: {
      accessLevel?: OAuthAuthorizationAccessLevel;
      allowClientSecretlessTokenExchange?: boolean;
      name?: string;
      description?: string | null;
      websiteUrl?: string | null;
      privacyPolicyUrl?: string | null;
      termsOfServiceUrl?: string | null;
      redirectUris?: string[];
      scopes?: string[];
      image?: PrismaJson.EntityImage;
    };
  }) {
    await this.assertApplicationActive(d.oauthApplication);
    this.assertApplicationOwnedLocally(d.oauthApplication);
    this.assertSupportedType(d.oauthApplication.type);

    let nextAccessLevel = d.input.accessLevel ?? d.oauthApplication.accessLevel;
    this.assertAllowedAccessLevel({
      type: d.oauthApplication.type as Exclude<OAuthApplicationType, 'cli_auth'>,
      accessLevel: nextAccessLevel,
      organization: d.organization
    });

    let scopes = d.input.scopes ? validateOAuthScopes(d.input.scopes) : undefined;
    let redirectUris = d.input.redirectUris
      ? d.input.redirectUris.map(uri => {
          validateUri(uri);
          return uri;
        })
      : undefined;

    return await withTransaction(async db => {
      await Fabric.fire('machine_access.oauth_application.updated:before', d);

      let oauthApplication = await db.oAuthApplication.update({
        where: { oid: d.oauthApplication.oid },
        data: {
          accessLevel: d.input.accessLevel,
          allowClientSecretlessTokenExchange: d.input.allowClientSecretlessTokenExchange,
          name: d.input.name,
          description: d.input.description,
          websiteUrl: d.input.websiteUrl,
          privacyPolicyUrl: d.input.privacyPolicyUrl,
          termsOfServiceUrl: d.input.termsOfServiceUrl,
          redirectUris,
          scopes,
          image: d.input.image
        },
        include
      });

      if (oauthApplication.serverSideMachineAccess) {
        await machineAccessService.updateMachineAccess({
          machineAccess: oauthApplication.serverSideMachineAccess,
          input: {
            name: d.input.name ? this.buildMachineAccessName(d.input.name) : undefined,
            hasCustomScopes: scopes ? true : undefined,
            scopes
          },
          performedBy: d.performedBy,
          context: d.context
        });
      }

      if (scopes && oauthApplication.scopedInstallation) {
        await db.oAuthInstallation.update({
          where: { oid: oauthApplication.scopedInstallation.oid },
          data: { scopes }
        });
      }

      if (
        oauthApplication.accessLevel == 'organization' &&
        !oauthApplication.scopedInstallation &&
        oauthApplication.organization
      ) {
        let scopedInstallation = await this.createScopedInstallation({
          oauthApplication,
          organization: oauthApplication.organization,
          serverSideMachineAccess: oauthApplication.serverSideMachineAccess
        });

        oauthApplication = await db.oAuthApplication.update({
          where: { oid: oauthApplication.oid },
          data: {
            scopedInstallationOid: scopedInstallation.oid
          },
          include
        });
      }

      let updatedOauthApplication = await db.oAuthApplication.findUniqueOrThrow({
        where: { oid: d.oauthApplication.oid },
        include
      });

      addAfterTransactionHook(() =>
        Fabric.fire('machine_access.oauth_application.updated:after', {
          ...d,
          oauthApplication: updatedOauthApplication
        })
      );

      return updatedOauthApplication;
    });
  }

  async archiveOAuthApplication(d: {
    oauthApplication: OAuthApplication;
    organization: Organization;
    performedBy: OrganizationActor;
    context: Context;
  }) {
    await this.assertApplicationActive(d.oauthApplication);
    this.assertApplicationOwnedLocally(d.oauthApplication);
    this.assertSupportedType(d.oauthApplication.type);

    let now = new Date();

    return await withTransaction(async db => {
      await Fabric.fire('machine_access.oauth_application.archived:before', d);

      await db.oAuthAuthorization.updateMany({
        where: {
          oauthApplicationOid: d.oauthApplication.oid,
          status: 'active'
        },
        data: {
          status: 'revoked',
          revokedAt: now
        }
      });

      await db.oAuthInstallation.updateMany({
        where: {
          oauthApplicationOid: d.oauthApplication.oid,
          status: 'active'
        },
        data: {
          status: 'revoked',
          revokedAt: now
        }
      });

      let oauthApplication = await db.oAuthApplication.update({
        where: { oid: d.oauthApplication.oid },
        data: {
          status: 'archived'
        },
        include
      });

      addAfterTransactionHook(() =>
        Fabric.fire('machine_access.oauth_application.archived:after', {
          ...d,
          oauthApplication
        })
      );

      return oauthApplication;
    });
  }

  async createGlobalUserFacingOAuthApplication(d: {
    input: {
      allowClientSecretlessTokenExchange?: boolean;
      name: string;
      description?: string;
      websiteUrl?: string;
      privacyPolicyUrl?: string;
      termsOfServiceUrl?: string;
      redirectUris?: string[];
      scopes: string[];
      image?: PrismaJson.EntityImage;
    };
  }) {
    let scopes = validateOAuthScopes(d.input.scopes);
    let redirectUris = (d.input.redirectUris ?? []).map(uri => {
      validateUri(uri);
      return uri;
    });

    let input = {
      status: 'active' as const,
      type: 'user_facing' as const,
      accessLevel: 'global' as const,
      allowClientSecretlessTokenExchange: d.input.allowClientSecretlessTokenExchange ?? false,
      name: d.input.name,
      description: d.input.description,
      websiteUrl: d.input.websiteUrl,
      privacyPolicyUrl: d.input.privacyPolicyUrl,
      termsOfServiceUrl: d.input.termsOfServiceUrl,
      redirectUris,
      scopes,
      image: d.input.image ?? { type: 'default' as const }
    };

    return await withTransaction(async db => {
      await Fabric.fire('machine_access.oauth_application.created:before', {
        organization: null,
        performedBy: null,
        context: null,
        input,
        serverSideMachineAccess: null
      });

      let oauthApplication = await db.oAuthApplication.create({
        data: {
          id: await ID.generateId('oauthApplication'),
          clientId: generateCustomId('mt_oauth_', 32),
          ...input,
          organizationOid: null,
          serverSideMachineAccessOid: null,
          scopedInstallationOid: null
        },
        include
      });

      addAfterTransactionHook(() =>
        Fabric.fire('machine_access.oauth_application.created:after', {
          organization: null,
          performedBy: null,
          context: null,
          input,
          serverSideMachineAccess: null,
          oauthApplication
        })
      );

      return oauthApplication;
    });
  }

  async updateGlobalUserFacingOAuthApplication(d: {
    oauthApplication: OAuthApplication;
    input: {
      allowClientSecretlessTokenExchange?: boolean;
      name?: string;
      description?: string | null;
      websiteUrl?: string | null;
      privacyPolicyUrl?: string | null;
      termsOfServiceUrl?: string | null;
      redirectUris?: string[];
      scopes?: string[];
      image?: PrismaJson.EntityImage;
    };
  }) {
    await this.assertApplicationActive(d.oauthApplication);
    this.assertApplicationOwnedLocally(d.oauthApplication);
    this.assertGlobalUserFacingApplication(d.oauthApplication);

    let scopes = d.input.scopes ? validateOAuthScopes(d.input.scopes) : undefined;
    let redirectUris = d.input.redirectUris
      ? d.input.redirectUris.map(uri => {
          validateUri(uri);
          return uri;
        })
      : undefined;

    return await withTransaction(async db => {
      await Fabric.fire('machine_access.oauth_application.updated:before', {
        oauthApplication: d.oauthApplication,
        organization: null,
        performedBy: null,
        context: null,
        input: {
          ...d.input,
          scopes,
          redirectUris
        }
      });

      let oauthApplication = await db.oAuthApplication.update({
        where: { oid: d.oauthApplication.oid },
        data: {
          allowClientSecretlessTokenExchange: d.input.allowClientSecretlessTokenExchange,
          name: d.input.name,
          description: d.input.description,
          websiteUrl: d.input.websiteUrl,
          privacyPolicyUrl: d.input.privacyPolicyUrl,
          termsOfServiceUrl: d.input.termsOfServiceUrl,
          redirectUris,
          scopes,
          image: d.input.image
        },
        include
      });

      addAfterTransactionHook(() =>
        Fabric.fire('machine_access.oauth_application.updated:after', {
          oauthApplication,
          organization: null,
          performedBy: null,
          context: null,
          input: {
            ...d.input,
            scopes,
            redirectUris
          }
        })
      );

      return oauthApplication;
    });
  }

  async archiveGlobalUserFacingOAuthApplication(d: { oauthApplication: OAuthApplication }) {
    await this.assertApplicationActive(d.oauthApplication);
    this.assertApplicationOwnedLocally(d.oauthApplication);
    this.assertGlobalUserFacingApplication(d.oauthApplication);

    let now = new Date();

    return await withTransaction(async db => {
      await Fabric.fire('machine_access.oauth_application.archived:before', {
        oauthApplication: d.oauthApplication,
        organization: null,
        performedBy: null,
        context: null
      });

      await db.oAuthAuthorization.updateMany({
        where: {
          oauthApplicationOid: d.oauthApplication.oid,
          status: 'active'
        },
        data: {
          status: 'revoked',
          revokedAt: now
        }
      });

      await db.oAuthInstallation.updateMany({
        where: {
          oauthApplicationOid: d.oauthApplication.oid,
          status: 'active'
        },
        data: {
          status: 'revoked',
          revokedAt: now
        }
      });

      let oauthApplication = await db.oAuthApplication.update({
        where: { oid: d.oauthApplication.oid },
        data: {
          status: 'archived'
        },
        include
      });

      addAfterTransactionHook(() =>
        Fabric.fire('machine_access.oauth_application.archived:after', {
          oauthApplication,
          organization: null,
          performedBy: null,
          context: null
        })
      );

      return oauthApplication;
    });
  }

  async getOAuthApplicationById(d: {
    organization: Organization;
    oauthApplicationId: string;
  }) {
    let oauthApplication = await db.oAuthApplication.findFirst({
      where: {
        id: d.oauthApplicationId,
        organizationOid: d.organization.oid,
        type: {
          in: ['user_facing', 'server_side']
        }
      },
      include
    });
    if (!oauthApplication) {
      throw new ServiceError(notFoundError('oauth_application', d.oauthApplicationId));
    }

    return oauthApplication;
  }

  async getGlobalUserFacingOAuthApplicationById(d: { oauthApplicationId: string }) {
    let oauthApplication = await db.oAuthApplication.findFirst({
      where: {
        id: d.oauthApplicationId,
        organizationOid: null,
        type: 'user_facing',
        accessLevel: 'global'
      },
      include
    });
    if (!oauthApplication) {
      throw new ServiceError(notFoundError('oauth_application', d.oauthApplicationId));
    }

    return oauthApplication;
  }

  async listOAuthApplications(d: {
    organization: Organization;
    statuses?: OAuthApplicationStatus[];
  }) {
    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.oAuthApplication.findMany({
            ...opts,
            where: {
              organizationOid: d.organization.oid,
              status: d.statuses ? { in: d.statuses } : 'active',
              type: {
                in: ['user_facing']
              }
            },
            include
          })
      )
    );
  }

  async listGlobalUserFacingOAuthApplications(d: {
    statuses?: OAuthApplicationStatus[];
    search?: string;
  }) {
    let search = d.search?.trim();

    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.oAuthApplication.findMany({
            ...opts,
            where: {
              organizationOid: null,
              accessLevel: 'global',
              status: d.statuses ? { in: d.statuses } : 'active',
              type: 'user_facing',
              OR: search
                ? [
                    { id: { contains: search, mode: 'insensitive' } },
                    { clientId: { contains: search, mode: 'insensitive' } },
                    { name: { contains: search, mode: 'insensitive' } },
                    { description: { contains: search, mode: 'insensitive' } }
                  ]
                : undefined
            },
            include
          })
      )
    );
  }

  async createOAuthApplicationClientSecret(d: { oauthApplication: OAuthApplication }) {
    await this.assertApplicationActive(d.oauthApplication);
    this.assertApplicationOwnedLocally(d.oauthApplication);

    return await this.createClientSecret({
      oauthApplication: d.oauthApplication
    });
  }

  async getOAuthApplicationClientSecretById(d: {
    oauthApplication: OAuthApplication;
    oauthApplicationClientSecretId: string;
  }) {
    let oauthApplicationClientSecret = await db.oAuthApplicationClientSecret.findFirst({
      where: {
        id: d.oauthApplicationClientSecretId,
        oauthApplicationOid: d.oauthApplication.oid,
        deletedAt: null
      }
    });

    if (!oauthApplicationClientSecret) {
      throw new ServiceError(
        notFoundError('oauth_application_client_secret', d.oauthApplicationClientSecretId)
      );
    }

    return oauthApplicationClientSecret;
  }

  async deleteOAuthApplicationClientSecret(d: {
    oauthApplicationClientSecret: OAuthApplicationClientSecret;
  }) {
    let oauthApplication = await db.oAuthApplication.findUniqueOrThrow({
      where: {
        oid: d.oauthApplicationClientSecret.oauthApplicationOid
      }
    });
    this.assertApplicationOwnedLocally(oauthApplication);

    return await withTransaction(async db => {
      let updatedSecret = await db.oAuthApplicationClientSecret.update({
        where: {
          oid: d.oauthApplicationClientSecret.oid
        },
        data: {
          deletedAt: new Date()
        },
        include: {
          oauthApplication: true
        }
      });

      await Fabric.fire('machine_access.oauth_application.client_secret.revoked:after', {
        oauthApplication: updatedSecret.oauthApplication
      });

      return updatedSecret;
    });
  }

  async getCliAuthOAuthApplication() {
    return await db.oAuthApplication.findFirst({
      where: {
        type: 'cli_auth',
        status: 'active'
      },
      include
    });
  }

  async upsertCliAuthOAuthApplication(d: { scopes: string[] }) {
    let scopes = validateOAuthScopes(d.scopes);

    let existing = await db.oAuthApplication.findFirst({
      where: {
        type: 'cli_auth'
      },
      include
    });

    let inner = {
      status: 'active' as const,
      type: 'cli_auth' as const,
      accessLevel: 'global' as const,
      allowClientSecretlessTokenExchange: true,
      name: 'Metorial CLI',
      description: 'Authenticate the Metorial CLI',
      redirectUris: [],
      scopes,
      image: {
        type: 'url' as const,
        url: 'https://cdn.metorial.com/2025-06-13--14-59-55/logos/metorial/primary_logo/raw.svg'
      }
    };

    if (existing) {
      this.assertApplicationOwnedLocally(existing);

      await Fabric.fire('machine_access.oauth_application.updated:before', {
        oauthApplication: existing,
        input: inner,
        organization: null,
        performedBy: null,
        context: null
      });

      let res = await db.oAuthApplication.update({
        where: { oid: existing.oid },
        data: {
          ...inner,
          websiteUrl: null,
          privacyPolicyUrl: null,
          termsOfServiceUrl: null,
          organizationOid: null,
          serverSideMachineAccessOid: null,
          scopedInstallationOid: null
        },
        include
      });

      await Fabric.fire('machine_access.oauth_application.updated:after', {
        oauthApplication: res,
        input: inner,
        organization: null,
        performedBy: null,
        context: null
      });

      return res;
    }

    await Fabric.fire('machine_access.oauth_application.created:before', {
      organization: null,
      performedBy: null,
      context: null,
      input: inner,
      serverSideMachineAccess: null
    });

    let res = await db.oAuthApplication.create({
      data: {
        id: await ID.generateId('oauthApplication'),
        clientId: generateCustomId('mt_oauth_', 32),
        ...inner
      },
      include
    });

    await Fabric.fire('machine_access.oauth_application.created:after', {
      organization: null,
      performedBy: null,
      context: null,
      input: inner,
      serverSideMachineAccess: null,
      oauthApplication: res
    });

    return res;
  }
}

export let oauthApplicationService = Service.create(
  'oauthApplicationService',
  () => new OAuthApplicationService()
).build();
