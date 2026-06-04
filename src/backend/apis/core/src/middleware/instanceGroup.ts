import { badRequestError, ServiceError } from '@lowerdeck/error';
import { getConsumerAccessContextForConsumerProfile } from '@metorial/consumer-auth';
import { accessService } from '@metorial/module-access';
import { consumerProfileService } from '@metorial/module-consumer';
import { Path } from '@metorial/rest';
import { apiGroup } from './apiGroup';

export let instanceGroup = apiGroup.use(async ctx => {
  let consumerPlaceholder = {
    consumerGroups: undefined,
    consumerSurface: undefined,
    consumerSession: undefined,
    consumerProfile: undefined,
    accessTags: undefined,
    portal: undefined
  };

  if (ctx.auth.type == 'fine_grained' && ctx.auth.restrictions.type == 'instance') {
    return {
      type: 'fine_grained' as const,
      instance: {
        ...ctx.auth.restrictions.instance,
        organization: ctx.auth.restrictions.organization
      },
      organization: ctx.auth.restrictions.organization,
      project: ctx.auth.restrictions.instance.project,
      accessTagGrants: ctx.auth.restrictions.accessTagGrants,
      member: undefined,
      ...consumerPlaceholder
    };
  }

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

    if (ctx.auth.restrictions.consumer) {
      return {
        ...base,
        consumerGroups: ctx.auth.restrictions.consumer.consumerGroups,
        consumerSurface: ctx.auth.restrictions.consumer.consumerSurface,
        consumerSession: ctx.auth.restrictions.consumer.consumerSession,
        consumerProfile: ctx.auth.restrictions.consumer.consumerProfile,
        accessTags: ctx.auth.restrictions.consumer.accessTags,
        portal: ctx.auth.restrictions.consumer.portal
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

  let consumerId = ctx.headers['metorial-consumer-profile-id'];

  if (consumerId) {
    let consumerProfile = await consumerProfileService.getConsumerProfileByIdForInstance({
      instance: res.instance,
      consumerProfileId: consumerId
    });

    let consumerRes = await getConsumerAccessContextForConsumerProfile({
      profile: consumerProfile
    });

    return Object.assign(res, consumerPlaceholder, {
      consumerGroups: consumerRes.consumerGroups,
      accessTags: consumerRes.accessTags,

      consumerSurface: consumerProfile.surface,
      portal: consumerProfile.surface.portal,
      consumerProfile: consumerProfile
    });
  }

  return Object.assign(res, consumerPlaceholder);
});

export let instancePath = (path: string, sdkPath: string) => [
  Path(`/${path}`, sdkPath),
  Path(`/instances/:instanceId/${path}`, `management.instance.${sdkPath}`),
  Path(`/dashboard/instances/:instanceId/${path}`, `dashboard.instance.${sdkPath}`)
];

export let instanceLegacyPath = (segment: string) => [
  `/${segment}`,
  `/instances/:instanceId/${segment}`,
  `/dashboard/instances/:instanceId/${segment}`
];
