import { badRequestError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import { serviceAccountService } from '@metorial/module-machine-access';
import {
  accessPolicyAssignmentService,
  accessPolicyService
} from '@metorial/module-organization';
import { Controller } from '@metorial/rest';
import { normalizeArrayParam } from '../../../lib/normalizeArrayParam';
import { checkAccess } from '../../../middleware/checkAccess';
import {
  organizationGroup,
  organizationManagementPath
} from '../../../middleware/organizationGroup';
import {
  oauthApplicationClientSecretPresenter,
  serviceAccountCredentialPresenter,
  serviceAccountPresenter
} from '../../../presenters';

let serviceAccountManagementGroup = organizationGroup.use(async ctx => {
  if (!ctx.params.serviceAccountId) {
    throw new ServiceError(
      badRequestError({
        message: 'serviceAccountId is required'
      })
    );
  }

  let serviceAccount = await serviceAccountService.getServiceAccountById({
    organization: ctx.organization,
    serviceAccountId: ctx.params.serviceAccountId
  });

  return { serviceAccount };
});

let serviceAccountClientSecretManagementGroup = serviceAccountManagementGroup.use(
  async ctx => {
    if (!ctx.params.oauthApplicationClientSecretId) {
      throw new ServiceError(
        badRequestError({
          message: 'oauthApplicationClientSecretId is required'
        })
      );
    }

    let oauthApplicationClientSecret =
      await serviceAccountService.getServiceAccountClientSecretById({
        serviceAccount: ctx.serviceAccount,
        oauthApplicationClientSecretId: ctx.params.oauthApplicationClientSecretId
      });

    return { oauthApplicationClientSecret };
  }
);

let serviceAccountCredentialManagementGroup = serviceAccountManagementGroup.use(async ctx => {
  if (!ctx.params.serviceAccountCredentialId) {
    throw new ServiceError(
      badRequestError({
        message: 'serviceAccountCredentialId is required'
      })
    );
  }

  let serviceAccountCredential = await serviceAccountService.getServiceAccountCredentialById({
    serviceAccount: ctx.serviceAccount,
    serviceAccountCredentialId: ctx.params.serviceAccountCredentialId
  });

  return { serviceAccountCredential };
});

export let serviceAccountManagementController = Controller.create(
  {
    name: 'Service Account',
    description: 'Create and manage service accounts for an organization'
  },
  {
    list: organizationGroup
      .get(organizationManagementPath('service-accounts', 'serviceAccounts.list'), {
        name: 'List organization service accounts',
        description: 'Returns a paginated list of service accounts owned by the organization.'
      })
      .use(checkAccess({ possibleScopes: ['organization.oauth_app:read'] }))
      .outputList(serviceAccountPresenter)
      .query(
        'default',
        Paginator.validate(
          v.object({
            status: v.optional(
              v.union([
                v.enumOf(['active', 'archived']),
                v.array(v.enumOf(['active', 'archived']))
              ])
            )
          })
        )
      )
      .do(async ctx => {
        let paginator = await serviceAccountService.listServiceAccounts({
          organization: ctx.organization,
          statuses: normalizeArrayParam(ctx.query.status)
        });

        let list = await paginator.run(ctx.query);

        return Paginator.present(list, serviceAccount =>
          serviceAccountPresenter.present({ serviceAccount })
        );
      }),

    get: serviceAccountManagementGroup
      .get(
        organizationManagementPath(
          'service-accounts/:serviceAccountId',
          'serviceAccounts.get'
        ),
        {
          name: 'Get organization service account',
          description: 'Retrieves a specific service account owned by the organization.'
        }
      )
      .use(checkAccess({ possibleScopes: ['organization.oauth_app:read'] }))
      .output(serviceAccountPresenter)
      .do(async ctx => {
        return serviceAccountPresenter.present({
          serviceAccount: ctx.serviceAccount
        });
      }),

    create: organizationGroup
      .post(organizationManagementPath('service-accounts', 'serviceAccounts.create'), {
        name: 'Create organization service account',
        description: 'Creates a new service account for machine-to-machine authentication.'
      })
      .use(checkAccess({ possibleScopes: ['organization.oauth_app:write'] }))
      .body(
        'default',
        v.object({
          name: v.string(),
          description: v.optional(v.string()),
          scopes: v.array(v.string())
        })
      )
      .output(serviceAccountPresenter)
      .do(async ctx => {
        let serviceAccount = await serviceAccountService.createServiceAccount({
          organization: ctx.organization,
          performedBy: ctx.actor,
          context: ctx.context,
          input: {
            name: ctx.body.name,
            description: ctx.body.description,
            scopes: ctx.body.scopes
          }
        });

        return serviceAccountPresenter.present({ serviceAccount });
      }),

    update: serviceAccountManagementGroup
      .patch(
        organizationManagementPath(
          'service-accounts/:serviceAccountId',
          'serviceAccounts.update'
        ),
        {
          name: 'Update organization service account',
          description: 'Updates an existing service account owned by the organization.'
        }
      )
      .use(checkAccess({ possibleScopes: ['organization.oauth_app:write'] }))
      .body(
        'default',
        v.object({
          name: v.optional(v.string()),
          description: v.optional(v.nullable(v.string())),
          scopes: v.optional(v.array(v.string()))
        })
      )
      .output(serviceAccountPresenter)
      .do(async ctx => {
        let serviceAccount = await serviceAccountService.updateServiceAccount({
          serviceAccount: ctx.serviceAccount,
          organization: ctx.organization,
          performedBy: ctx.actor,
          context: ctx.context,
          input: {
            name: ctx.body.name,
            description: ctx.body.description,
            scopes: ctx.body.scopes
          }
        });

        return serviceAccountPresenter.present({ serviceAccount });
      }),

    delete: serviceAccountManagementGroup
      .delete(
        organizationManagementPath(
          'service-accounts/:serviceAccountId',
          'serviceAccounts.delete'
        ),
        {
          name: 'Delete organization service account',
          description: 'Archives a service account owned by the organization.'
        }
      )
      .use(checkAccess({ possibleScopes: ['organization.oauth_app:write'] }))
      .output(serviceAccountPresenter)
      .do(async ctx => {
        let serviceAccount = await serviceAccountService.archiveServiceAccount({
          serviceAccount: ctx.serviceAccount,
          organization: ctx.organization,
          performedBy: ctx.actor,
          context: ctx.context
        });

        return serviceAccountPresenter.present({ serviceAccount });
      }),

    createClientSecret: serviceAccountManagementGroup
      .post(
        organizationManagementPath(
          'service-accounts/:serviceAccountId/client-secrets',
          'serviceAccounts.clientSecrets.create'
        ),
        {
          name: 'Create service account client secret',
          description: 'Creates a new client secret for a service account.'
        }
      )
      .use(checkAccess({ possibleScopes: ['organization.oauth_app:write'] }))
      .output(oauthApplicationClientSecretPresenter)
      .do(async ctx => {
        let oauthApplicationClientSecret =
          await serviceAccountService.createServiceAccountClientSecret({
            serviceAccount: ctx.serviceAccount
          });

        return oauthApplicationClientSecretPresenter.present({
          oauthApplicationClientSecret,
          secret: oauthApplicationClientSecret.secret
        });
      }),

    deleteClientSecret: serviceAccountClientSecretManagementGroup
      .delete(
        organizationManagementPath(
          'service-accounts/:serviceAccountId/client-secrets/:oauthApplicationClientSecretId',
          'serviceAccounts.clientSecrets.delete'
        ),
        {
          name: 'Delete service account client secret',
          description: 'Deletes a client secret from a service account.'
        }
      )
      .use(checkAccess({ possibleScopes: ['organization.oauth_app:write'] }))
      .output(oauthApplicationClientSecretPresenter)
      .do(async ctx => {
        let oauthApplicationClientSecret =
          await serviceAccountService.deleteServiceAccountClientSecret({
            oauthApplicationClientSecret: ctx.oauthApplicationClientSecret
          });

        return oauthApplicationClientSecretPresenter.present({
          oauthApplicationClientSecret
        });
      }),

    listCredentials: serviceAccountManagementGroup
      .get(
        organizationManagementPath(
          'service-accounts/:serviceAccountId/credentials',
          'serviceAccounts.credentials.list'
        ),
        {
          name: 'List service account credentials',
          description: 'Returns a paginated list of credentials for a service account.'
        }
      )
      .use(checkAccess({ possibleScopes: ['organization.oauth_authorization:read'] }))
      .outputList(serviceAccountCredentialPresenter)
      .query(
        'default',
        Paginator.validate(
          v.object({
            status: v.optional(
              v.union([
                v.enumOf(['active', 'revoked']),
                v.array(v.enumOf(['active', 'revoked']))
              ])
            )
          })
        )
      )
      .do(async ctx => {
        let paginator = await serviceAccountService.listServiceAccountCredentials({
          serviceAccount: ctx.serviceAccount,
          statuses: normalizeArrayParam(ctx.query.status)
        });

        let list = await paginator.run(ctx.query);

        return Paginator.present(list, serviceAccountCredential =>
          serviceAccountCredentialPresenter.present({ serviceAccountCredential })
        );
      }),

    getCredential: serviceAccountCredentialManagementGroup
      .get(
        organizationManagementPath(
          'service-accounts/:serviceAccountId/credentials/:serviceAccountCredentialId',
          'serviceAccounts.credentials.get'
        ),
        {
          name: 'Get service account credential',
          description: 'Retrieves a specific credential for a service account.'
        }
      )
      .use(checkAccess({ possibleScopes: ['organization.oauth_authorization:read'] }))
      .output(serviceAccountCredentialPresenter)
      .do(async ctx => {
        return serviceAccountCredentialPresenter.present({
          serviceAccountCredential: ctx.serviceAccountCredential
        });
      }),

    assignPolicy: serviceAccountManagementGroup
      .post(
        organizationManagementPath(
          'service-accounts/:serviceAccountId/policies',
          'serviceAccounts.policies.create'
        ),
        {
          name: 'Assign service account policy',
          description: 'Assign an access policy to a service account'
        }
      )
      .use(checkAccess({ possibleScopes: ['organization.access_policy:write'] }))
      .body(
        'default',
        v.object({
          access_policy_id: v.string()
        })
      )
      .output(serviceAccountPresenter)
      .do(async ctx => {
        let accessPolicy = await accessPolicyService.getAccessPolicyById({
          organization: ctx.organization,
          accessPolicyId: ctx.body.access_policy_id
        });

        await accessPolicyAssignmentService.assignAccessPolicyToServiceAccount({
          organization: ctx.organization,
          serviceAccount: ctx.serviceAccount,
          accessPolicy,
          performedBy: ctx.actor,
          context: ctx.context
        });

        let serviceAccount = await serviceAccountService.getServiceAccountById({
          organization: ctx.organization,
          serviceAccountId: ctx.serviceAccount.id
        });

        return serviceAccountPresenter.present({ serviceAccount });
      }),

    removePolicy: serviceAccountManagementGroup
      .delete(
        organizationManagementPath(
          'service-accounts/:serviceAccountId/policies/:accessPolicyId',
          'serviceAccounts.policies.delete'
        ),
        {
          name: 'Remove service account policy',
          description: 'Remove an access policy from a service account'
        }
      )
      .use(checkAccess({ possibleScopes: ['organization.access_policy:write'] }))
      .output(serviceAccountPresenter)
      .do(async ctx => {
        let accessPolicy = await accessPolicyService.getAccessPolicyById({
          organization: ctx.organization,
          accessPolicyId: ctx.params.accessPolicyId
        });

        await accessPolicyAssignmentService.removeAccessPolicyFromServiceAccount({
          organization: ctx.organization,
          serviceAccount: ctx.serviceAccount,
          accessPolicy,
          performedBy: ctx.actor,
          context: ctx.context
        });

        let serviceAccount = await serviceAccountService.getServiceAccountById({
          organization: ctx.organization,
          serviceAccountId: ctx.serviceAccount.id
        });

        return serviceAccountPresenter.present({ serviceAccount });
      })
  }
);
