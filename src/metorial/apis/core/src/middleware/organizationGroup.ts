import { badRequestError, forbiddenError, ServiceError } from '@lowerdeck/error';
import { createAuditScope } from '@metorial/audit-scope';
import { accessService } from '@metorial/module-access';
import { flagService } from '@metorial/module-flags';
import { Path } from '@metorial/rest';
import { managementGroup } from './managementGroup';

export let organizationGroup = managementGroup.use(async ctx => {
  if (ctx.auth.type == 'fine_grained') {
    throw new ServiceError(
      forbiddenError({
        message: 'Fine grained token is not allowed to access this endpoint'
      })
    );
  }

  if (ctx.auth.type == 'machine') {
    // if (ctx.auth.restrictions.type == 'instance') {
    //   throw new ServiceError(
    //     forbiddenError({
    //       message: 'Your API key is not authorized to access this endpoint'
    //     })
    //   );
    // }

    return {
      type: 'actor' as const,
      organization: ctx.auth.restrictions.organization,
      actor: ctx.auth.restrictions.actor,
      member: undefined,
      auditScope: ctx.auth.auditScope,
      flags: await flagService.getFlags({
        organization: ctx.auth.restrictions.organization,
        machineAccess: ctx.auth.machineAccess
      })
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

  let res = await accessService.accessOrganization({
    authInfo: ctx.auth,
    organizationId
  });
  let organizationActor = res.actor;
  if (!organizationActor) {
    throw new Error('Organization access did not resolve an organization actor');
  }

  return {
    ...res,
    auditScope: createAuditScope({
      organization: res.organization,
      organizationActor,
      actor: {
        type: 'org_actor',
        id: organizationActor.id
      },
      context: ctx.context
    }),
    flags: await flagService.getFlags({
      organization: res.organization,
      user: ctx.auth.user,
      machineAccess: ctx.auth.machineAccess
    })
  };
});

export let organizationManagementPath = (path: string, sdkPath: string) => [
  Path(`/organization/${path}`, `management.organization.${sdkPath}`),
  Path(
    `/dashboard/organizations/:organizationId/${path}`,
    `dashboard.organizations.${sdkPath}`
  )
];
