import {
  badRequestError,
  forbiddenError,
  notFoundError,
  ServiceError
} from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import type { AuditScope } from '@metorial/audit-scope';
import {
  addAfterTransactionHook,
  ConsumerProfile,
  db,
  ID,
  OAuthApplication,
  OAuthApplicationClientSecret,
  OAuthAuthorizationStatus,
  Organization,
  Portal,
  ServiceAccount,
  ServiceAccountStatus,
  withTransaction
} from '@metorial/db';
import { Fabric } from '@metorial/fabric';
import { validateOAuthScopes } from '../lib/oauthScopeValidation';
import { machineAccessInclude } from './machineAccessAuth';
import { oauthApplicationService } from './oauthApplication';
import { authorizationInclude } from './oauthAuthorization';

export let serviceAccountInclude = {
  organization: true,
  portal: true,
  consumerProfile: true,
  policies: {
    include: {
      accessPolicy: true
    }
  },
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

  private assertConsumerTarget(d: {
    organization: Organization;
    consumer: { portal: Portal; consumerProfile: ConsumerProfile };
  }) {
    let { portal, consumerProfile } = d.consumer;

    if (
      portal.organizationOid != d.organization.oid ||
      consumerProfile.organizationOid != d.organization.oid ||
      consumerProfile.surfaceOid != portal.surfaceOid
    ) {
      throw new ServiceError(
        badRequestError({
          message:
            'The consumer profile must belong to the selected portal of this organization'
        })
      );
    }

    if (portal.status != 'active' || consumerProfile.status != 'active') {
      throw new ServiceError(
        forbiddenError({
          message: 'Consumer service accounts require an active portal and consumer profile'
        })
      );
    }
  }

  async createServiceAccount(d: {
    organization: Organization;
    auditScope: AuditScope;
    consumer?: { portal: Portal; consumerProfile: ConsumerProfile };
    input: {
      name: string;
      description?: string;
      scopes: string[];
    };
  }) {
    if (d.consumer) {
      this.assertConsumerTarget({ organization: d.organization, consumer: d.consumer });
    }

    let subjectType = d.consumer ? ('consumer' as const) : ('organization_member' as const);
    let scopes = validateOAuthScopes(d.input.scopes, subjectType);

    let fabricSubject = {
      portal: d.consumer?.portal ?? null,
      consumerProfile: d.consumer?.consumerProfile ?? null,
      subjectType
    };

    return withTransaction(async db => {
      await Fabric.fire('machine_access.service_account.created:before', {
        ...d,
        ...fabricSubject
      });

      let oauthApplication = await oauthApplicationService.createOAuthApplication({
        organization: d.organization,
        auditScope: d.auditScope,
        consumer: d.consumer ? { consumerProfile: d.consumer.consumerProfile } : undefined,
        input: {
          type: 'server_side',
          accessLevel: 'organization',
          subjectType,
          name: d.input.name,
          description: d.input.description,
          scopes,
          redirectUris: []
        }
      });

      let serviceAccount = await db.serviceAccount.create({
        data: {
          id: await ID.generateId('serviceAccount'),
          status: 'active',
          subjectType,
          name: d.input.name,
          description: d.input.description,
          scopes,
          organizationOid: d.organization.oid,
          oauthApplicationOid: oauthApplication.oid,
          portalOid: d.consumer?.portal.oid,
          consumerProfileOid: d.consumer?.consumerProfile.oid
        },
        include: serviceAccountInclude
      });

      addAfterTransactionHook(() =>
        Fabric.fire('machine_access.service_account.created:after', {
          ...d,
          ...fabricSubject,
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
    auditScope: AuditScope;
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
        auditScope: d.auditScope,
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
          previousServiceAccount: {
            ...d.serviceAccount,
            organization: d.organization,
            oauthApplication: {
              ...d.serviceAccount.oauthApplication,
              organization: d.organization
            }
          },
          oauthApplication: {
            ...d.serviceAccount.oauthApplication,
            organization: d.organization
          }
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
    auditScope: AuditScope;
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
        auditScope: d.auditScope
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
          oauthApplication: {
            ...d.serviceAccount.oauthApplication,
            organization: d.organization
          }
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
    auditScope?: AuditScope;
  }) {
    await this.assertServiceAccountActive(d.serviceAccount);

    return await oauthApplicationService.createOAuthApplicationClientSecret({
      oauthApplication: d.serviceAccount.oauthApplication,
      auditScope: d.auditScope
    });
  }

  async deleteServiceAccountClientSecret(d: {
    oauthApplicationClientSecret: OAuthApplicationClientSecret;
    auditScope?: AuditScope;
  }) {
    return await oauthApplicationService.deleteOAuthApplicationClientSecret({
      oauthApplicationClientSecret: d.oauthApplicationClientSecret,
      auditScope: d.auditScope
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
