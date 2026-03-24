import { forbiddenError, notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import { Context } from '@metorial/context';
import {
  addAfterTransactionHook,
  db,
  ID,
  OAuthApplication,
  OAuthApplicationClientSecret,
  OAuthAuthorizationStatus,
  Organization,
  OrganizationActor,
  ServiceAccount,
  ServiceAccountStatus,
  withTransaction
} from '@metorial/db';
import { Fabric } from '@metorial/fabric';
import { machineAccessInclude } from './machineAccessAuth';
import { oauthApplicationService } from './oauthApplication';
import { authorizationInclude } from './oauthAuthorization';

export let serviceAccountInclude = {
  organization: true,
  oauthApplication: {
    include: {
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
    }
  }
} as const;

export let serviceAccountCredentialInclude = {
  serviceAccount: {
    include: serviceAccountInclude
  },
  oauthAuthorization: {
    include: authorizationInclude
  }
} as const;

class ServiceAccountService {
  private async assertServiceAccountActive(serviceAccount: ServiceAccount) {
    if (serviceAccount.status != 'active') {
      throw new ServiceError(
        forbiddenError({
          message: 'Cannot perform this action on an archived service account'
        })
      );
    }
  }

  async createServiceAccount(d: {
    organization: Organization;
    performedBy: OrganizationActor;
    context: Context;
    input: {
      name: string;
      description?: string;
      scopes: string[];
    };
  }) {
    return withTransaction(async db => {
      await Fabric.fire('machine_access.service_account.created:before', d);

      let oauthApplication = await oauthApplicationService.createOAuthApplication({
        organization: d.organization,
        performedBy: d.performedBy,
        context: d.context,
        input: {
          type: 'server_side',
          accessLevel: 'organization',
          name: d.input.name,
          description: d.input.description,
          scopes: d.input.scopes,
          redirectUris: []
        }
      });

      let serviceAccount = await db.serviceAccount.create({
        data: {
          id: await ID.generateId('serviceAccount'),
          status: 'active',
          name: d.input.name,
          description: d.input.description,
          scopes: d.input.scopes,
          organizationOid: d.organization.oid,
          oauthApplicationOid: oauthApplication.oid
        },
        include: serviceAccountInclude
      });

      addAfterTransactionHook(() =>
        Fabric.fire('machine_access.service_account.created:after', {
          ...d,
          serviceAccount,
          oauthApplication
        })
      );

      return serviceAccount;
    });
  }

  async updateServiceAccount(d: {
    serviceAccount: ServiceAccount & {
      oauthApplication: OAuthApplication;
    };
    organization: Organization;
    performedBy: OrganizationActor;
    context: Context;
    input: {
      name?: string;
      description?: string | null;
      scopes?: string[];
    };
  }) {
    await this.assertServiceAccountActive(d.serviceAccount);

    return withTransaction(async db => {
      await Fabric.fire('machine_access.service_account.updated:before', {
        ...d,
        oauthApplication: d.serviceAccount.oauthApplication
      });

      await oauthApplicationService.updateOAuthApplication({
        oauthApplication: d.serviceAccount.oauthApplication,
        organization: d.organization,
        performedBy: d.performedBy,
        context: d.context,
        input: {
          name: d.input.name,
          description: d.input.description,
          scopes: d.input.scopes
        }
      });

      let serviceAccount = await db.serviceAccount.update({
        where: {
          oid: d.serviceAccount.oid
        },
        data: {
          name: d.input.name,
          description: d.input.description,
          scopes: d.input.scopes
        },
        include: serviceAccountInclude
      });

      addAfterTransactionHook(() =>
        Fabric.fire('machine_access.service_account.updated:after', {
          ...d,
          serviceAccount,
          oauthApplication: d.serviceAccount.oauthApplication
        })
      );

      return serviceAccount;
    });
  }

  async archiveServiceAccount(d: {
    serviceAccount: ServiceAccount & {
      oauthApplication: OAuthApplication;
    };
    organization: Organization;
    performedBy: OrganizationActor;
    context: Context;
  }) {
    await this.assertServiceAccountActive(d.serviceAccount);

    return withTransaction(async db => {
      await Fabric.fire('machine_access.service_account.archived:before', {
        ...d,
        oauthApplication: d.serviceAccount.oauthApplication
      });

      await oauthApplicationService.archiveOAuthApplication({
        oauthApplication: d.serviceAccount.oauthApplication,
        organization: d.organization,
        performedBy: d.performedBy,
        context: d.context
      });

      let serviceAccount = await db.serviceAccount.update({
        where: {
          oid: d.serviceAccount.oid
        },
        data: {
          status: 'archived'
        },
        include: serviceAccountInclude
      });

      addAfterTransactionHook(() =>
        Fabric.fire('machine_access.service_account.archived:after', {
          ...d,
          serviceAccount,
          oauthApplication: d.serviceAccount.oauthApplication
        })
      );

      return serviceAccount;
    });
  }

  async getServiceAccountById(d: { organization: Organization; serviceAccountId: string }) {
    let serviceAccount = await db.serviceAccount.findFirst({
      where: {
        id: d.serviceAccountId,
        organizationOid: d.organization.oid
      },
      include: serviceAccountInclude
    });

    if (!serviceAccount) {
      throw new ServiceError(notFoundError('service_account', d.serviceAccountId));
    }

    return serviceAccount;
  }

  async listServiceAccounts(d: {
    organization: Organization;
    statuses?: ServiceAccountStatus[];
  }) {
    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.serviceAccount.findMany({
            ...opts,
            where: {
              organizationOid: d.organization.oid,
              status: d.statuses ? { in: d.statuses } : 'active'
            },
            include: serviceAccountInclude
          })
      )
    );
  }

  async getServiceAccountClientSecretById(d: {
    serviceAccount: ServiceAccount & {
      oauthApplication: OAuthApplication;
    };
    oauthApplicationClientSecretId: string;
  }) {
    return await oauthApplicationService.getOAuthApplicationClientSecretById({
      oauthApplication: d.serviceAccount.oauthApplication,
      oauthApplicationClientSecretId: d.oauthApplicationClientSecretId
    });
  }

  async createServiceAccountClientSecret(d: {
    serviceAccount: ServiceAccount & {
      oauthApplication: OAuthApplication;
    };
  }) {
    await this.assertServiceAccountActive(d.serviceAccount);

    return await oauthApplicationService.createOAuthApplicationClientSecret({
      oauthApplication: d.serviceAccount.oauthApplication
    });
  }

  async deleteServiceAccountClientSecret(d: {
    oauthApplicationClientSecret: OAuthApplicationClientSecret;
  }) {
    return await oauthApplicationService.deleteOAuthApplicationClientSecret({
      oauthApplicationClientSecret: d.oauthApplicationClientSecret
    });
  }

  async listServiceAccountCredentials(d: {
    serviceAccount: ServiceAccount;
    statuses?: OAuthAuthorizationStatus[];
  }) {
    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.serviceAccountCredential.findMany({
            ...opts,
            where: {
              serviceAccountOid: d.serviceAccount.oid,
              deletedAt: null,
              oauthAuthorization: d.statuses
                ? {
                    status: {
                      in: d.statuses
                    }
                  }
                : undefined
            },
            include: serviceAccountCredentialInclude
          })
      )
    );
  }

  async getServiceAccountCredentialById(d: {
    serviceAccount: ServiceAccount;
    serviceAccountCredentialId: string;
  }) {
    let serviceAccountCredential = await db.serviceAccountCredential.findFirst({
      where: {
        id: d.serviceAccountCredentialId,
        serviceAccountOid: d.serviceAccount.oid,
        deletedAt: null
      },
      include: serviceAccountCredentialInclude
    });

    if (!serviceAccountCredential) {
      throw new ServiceError(
        notFoundError('service_account_credential', d.serviceAccountCredentialId)
      );
    }

    return serviceAccountCredential;
  }
}

export let serviceAccountService = Service.create(
  'serviceAccountService',
  () => new ServiceAccountService()
).build();
