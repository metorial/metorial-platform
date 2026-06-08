import { badRequestError, ServiceError } from '@lowerdeck/error';
import { v } from '@lowerdeck/validation';

export let monitorTargetValidator = v.enumOf(['protoguard_filter', 'schema_change'] as const);
export let monitorStatusValidator = v.enumOf(['active', 'inactive'] as const);
export let monitorAlertStatusValidator = v.enumOf(['pending', 'resolved', 'ignored'] as const);
export let monitorAlertSourceValidator = v.enumOf([
  'protoguard',
  'specification_change'
] as const);
export let notificationTargetValidator = v.enumOf([
  'version',
  'deployment_config_pair'
] as const);

export let stringOrArray = () => v.union([v.string(), v.array(v.string())]);

export let getRequiredParam = (params: Record<string, string | undefined>, key: string) => {
  let value = params[key];
  if (!value) {
    throw new ServiceError(
      badRequestError({
        message: `${key} is required`,
        description: `The ${key} path parameter is required.`
      })
    );
  }

  return value;
};

export let actorInput = (ctx: any) => (ctx.actor ? { organizationActor: ctx.actor } : {});
