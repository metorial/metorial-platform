import { forbiddenError, ServiceError } from '@metorial/error';
import { Path } from '@metorial/rest';
import { providerApiGroup } from './providerGroup';

export let providerInstanceGroup = providerApiGroup.use(async ctx => {
  // Provider API requires instance-scoped machine access
  if (ctx.auth.type !== 'machine' || ctx.auth.restrictions.type !== 'instance') {
    throw new ServiceError(
      forbiddenError({
        message: 'Instance-scoped API key required',
        description: 'The Provider API requires an instance-scoped API key.'
      })
    );
  }

  return {
    instance: ctx.auth.restrictions.instance,
    organization: ctx.auth.restrictions.organization,
    actor: ctx.auth.restrictions.actor
  };
});

// Path helper for provider API routes
export let providerPath = (path: string, sdkPath: string) => [Path(`/${path}`, sdkPath)];
