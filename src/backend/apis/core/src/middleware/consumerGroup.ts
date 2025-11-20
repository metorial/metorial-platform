import { ServiceError, unauthorizedError } from '@metorial/error';
import { consumerAuthService, consumerProfileService } from '@metorial/module-consumer';
import { Path } from '@metorial/rest';
import { apiGroup } from './apiGroup';

export let consumerGroup = apiGroup.use(async ctx => {
  if (ctx.auth.type != 'machine' || ctx.auth.restrictions.type != 'instance') {
    throw new ServiceError(
      unauthorizedError({
        message: 'Invalid authentication type for consumer group'
      })
    );
  }

  let instance = ctx.auth.restrictions.instance;
  let organization = ctx.auth.restrictions.organization;
  let actor = ctx.auth.restrictions.actor;

  let consumerSessionClientSecret =
    ctx.query['consumer_session_client_secret'] ??
    ctx.headers['metorial-consumer-session-client-secret'];

  if (!consumerSessionClientSecret) {
    throw new ServiceError(
      unauthorizedError({
        message: 'Missing consumer session client secret'
      })
    );
  }

  let res = await consumerAuthService.authenticateWithConsumerToken({
    token: consumerSessionClientSecret,
    organization
  });

  let consumerGroups = await consumerProfileService.getGroupsForProfile({
    consumerProfile: res.consumerProfile
  });

  return {
    actor,
    instance,
    organization,
    consumerGroups,
    consumerSurface: res.surface,
    consumerSession: res.session,
    consumerProfile: res.consumerProfile
  };
});

export let consumerPath = (path: string, sdkPath: string) => [
  Path(`/consumer/${path}`, `consumer.${sdkPath}`)
];
