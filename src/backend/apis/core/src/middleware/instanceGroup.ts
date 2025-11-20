import { badRequestError, ServiceError } from '@metorial/error';
import { accessService } from '@metorial/module-access';
import { consumerAuthService, consumerProfileService } from '@metorial/module-consumer';
import { Path } from '@metorial/rest';
import { apiGroup } from './apiGroup';

export let instanceGroup = apiGroup.use(async ctx => {
  let consumerPlaceholder = {
    consumerGroups: undefined,
    consumerSurface: undefined,
    consumerSession: undefined,
    consumerProfile: undefined
  };

  if (ctx.auth.type == 'machine' && ctx.auth.restrictions.type == 'instance') {
    let base = {
      type: 'actor' as const,
      instance: {
        ...ctx.auth.restrictions.instance,
        organization: ctx.auth.restrictions.organization
      },
      organization: ctx.auth.restrictions.organization,
      actor: ctx.auth.restrictions.actor,
      member: undefined,
      ...consumerPlaceholder
    };

    let consumerSessionClientSecret =
      ctx.query['consumer_session_client_secret'] ??
      ctx.headers['metorial-consumer-session-client-secret'];

    if (consumerSessionClientSecret) {
      let res = await consumerAuthService.authenticateWithConsumerToken({
        token: consumerSessionClientSecret,
        organization: ctx.auth.restrictions.organization
      });

      let consumerGroups = await consumerProfileService.getGroupsForProfile({
        consumerProfile: res.consumerProfile
      });

      return {
        ...base,
        consumerGroups,
        consumerSurface: res.surface,
        consumerSession: res.session,
        consumerProfile: res.consumerProfile
      };
    }

    return base;
  }

  let instanceId = ctx.headers['metorial-instance-id'] ?? ctx.params.instanceId;
  if (!instanceId) {
    throw new ServiceError(
      badRequestError({
        message: 'Missing instance id in header metorial-instance-id'
      })
    );
  }

  let res = await accessService.accessInstance({
    authInfo: ctx.auth,
    instanceId
  });

  return Object.assign(res, consumerPlaceholder);
});

export let instancePath = (path: string, sdkPath: string) => [
  Path(`/${path}`, sdkPath),
  Path(`/instances/:instanceId/${path}`, `management.instance.${sdkPath}`),
  Path(`/dashboard/instances/:instanceId/${path}`, `dashboard.instance.${sdkPath}`)
];
