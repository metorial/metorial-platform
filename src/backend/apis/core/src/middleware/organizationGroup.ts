import { badRequestError, ServiceError, unauthorizedError } from '@metorial/error';
import { accessService } from '@metorial/module-access';
import { Path } from '@metorial/rest';
import { managementGroup } from './managementGroup';

export let organizationGroup = managementGroup.use(async ctx => {
  if (ctx.auth.type == 'machine') {
    if (ctx.auth.restrictions.type == 'instance') {
      throw new ServiceError(
        unauthorizedError({
          message: 'Your API key is not authorized to access this endpoint'
        })
      );
    }

    return {
      type: 'actor' as const,
      organization: ctx.auth.restrictions.organization,
      actor: ctx.auth.restrictions.actor,
      member: undefined
    };
  }

  let organizationId = ctx.headers['metorial-organization-id'] ?? ctx.params.organizationId;
  if (!organizationId) {
    throw new ServiceError(
      badRequestError({
        message: 'Missing organization id in header metorial-organization-id'
      })
    );
  }

  return await accessService.accessOrganization({
    authInfo: ctx.auth,
    organizationId
  });
});

export let organizationManagementPath = (path: string, sdkPath: string) => [
  Path(`/organization/${path}`, `management.organization.${sdkPath}`),
  Path(
    `/dashboard/organizations/:organizationId/${path}`,
    `dashboard.organizations.${sdkPath}`
  )
];
