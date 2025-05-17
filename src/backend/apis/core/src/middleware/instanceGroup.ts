import { badRequestError, ServiceError } from '@metorial/error';
import { accessService } from '@metorial/module-access';
import { Path } from '@metorial/rest';
import { apiGroup } from './apiGroup';

export let instanceGroup = apiGroup.use(async ctx => {
  if (ctx.auth.type == 'machine' && ctx.auth.restrictions.type == 'instance') {
    return {
      type: 'actor' as const,
      instance: {
        ...ctx.auth.restrictions.instance,
        organization: ctx.auth.restrictions.organization
      },
      organization: ctx.auth.restrictions.organization,
      actor: ctx.auth.restrictions.actor,
      member: undefined
    };
  }

  let instanceId = ctx.headers['metorial-instance-id'] ?? ctx.params.instanceId;
  if (!instanceId) {
    throw new ServiceError(
      badRequestError({
        message: 'Missing instance id in header metorial-instance-id'
      })
    );
  }

  return await accessService.accessInstance({
    authInfo: ctx.auth,
    instanceId
  });
});

export let instancePath = (path: string, sdkPath: string) => [
  Path(`/${path}`, sdkPath),
  Path(`/instances/:instanceId/${path}`, `management.instance.${sdkPath}`),
  Path(`/dashboard/instances/:instanceId/${path}`, `dashboard.instance.${sdkPath}`)
];
