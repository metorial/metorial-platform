import { ServiceError, unauthorizedError } from '@lowerdeck/error';
import { Path } from '@metorial/rest';
import { instanceGroup } from './instanceGroup';

export let consumerGroup = instanceGroup.use(async ctx => {
  if (
    !ctx.consumerGroups ||
    !ctx.consumerProfile ||
    !ctx.consumerSession ||
    !ctx.consumerSurface
  ) {
    throw new ServiceError(
      unauthorizedError({
        message: 'Missing consumer session client secret'
      })
    );
  }

  return {
    consumerGroups: ctx.consumerGroups,
    consumerSurface: ctx.consumerSurface,
    consumerSession: ctx.consumerSession,
    consumerProfile: ctx.consumerProfile
  };
});

export let consumerPath = (path: string, sdkPath: string) => [
  Path(`/consumer/${path}`, `consumer.${sdkPath}`)
];
