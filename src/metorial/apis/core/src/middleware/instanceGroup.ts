import { badRequestError, ServiceError } from '@lowerdeck/error';
import { createAuditScope } from '@metorial/audit-scope';
import { getConsumerAccessContextForConsumerProfile } from '@metorial/consumer-auth';
import { accessService } from '@metorial/module-access';
import { consumerProfileService } from '@metorial/module-consumer';
import { resourceActorService } from '@metorial/module-resource-tenant';
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
      resourceActor: undefined,
      auditScope: ctx.auth.auditScope,
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
      project: ctx.auth.restrictions.instance.project,
      actor: ctx.auth.restrictions.actor,
      resourceActor: ctx.auth.restrictions.resourceActor,
      auditScope: ctx.auth.auditScope,
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
  let organizationActor = res.actor;
  if (!organizationActor) {
    throw new Error('Instance access did not resolve an organization actor');
  }

  let consumerId = ctx.headers['metorial-consumer-profile-id'];

  if (consumerId) {
    let consumerProfile = await consumerProfileService.getConsumerProfileByIdForInstance({
      instance: res.instance,
      consumerProfileId: consumerId
    });
    if (consumerProfile.surface.type != 'portal' || !consumerProfile.surface.portal) {
      throw new ServiceError(
        badRequestError({
          message: 'Only portal consumer profiles can be used as restricted resources.'
        })
      );
    }

    let consumerRes = await getConsumerAccessContextForConsumerProfile({
      profile: consumerProfile
    });
    let resourceActor =
      consumerProfile.resourceActors.find(actor => actor.projectOid == res.project.oid) ??
      (await resourceActorService.ensureConsumerProfileActor({
        project: res.project,
        consumerProfile
      }));

    return Object.assign(res, consumerPlaceholder, {
      consumerGroups: consumerRes.consumerGroups,
      accessTags: consumerRes.accessTags,

      consumerSurface: consumerProfile.surface,
      portal: consumerProfile.surface.portal,
      consumerProfile: consumerProfile,
      resourceActor,
      auditScope: createAuditScope({
        organization: res.organization,
        instance: res.instance,
        actor: {
          type: 'consumer_profile',
          id: consumerProfile.id
        },
        context: ctx.context
      }),
      member: undefined
    });
  }

  return Object.assign(res, consumerPlaceholder, {
    auditScope: createAuditScope({
      organization: res.organization,
      instance: res.instance,
      organizationActor,
      actor: {
        type: 'org_actor',
        id: organizationActor.id
      },
      context: ctx.context
    })
  });
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
