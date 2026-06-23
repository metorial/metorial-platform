import type { ValidationTypeValue } from '@lowerdeck/validation';
import type { TenantSelector } from '@metorial-subspace/list-utils';
import { resolveAuthConfig, type authConfigValidator } from './resolveAuthConfig';
import { resolveConfig, type configValidator } from './resolveConfig';
import { resolveDeployment, type deploymentValidator } from './resolveDeployment';

export let resolveSessionProvider = async (
  ctx: TenantSelector,
  input: {
    providerDeployment?: ValidationTypeValue<typeof deploymentValidator> | null;
    providerConfig?: ValidationTypeValue<typeof configValidator> | null;
    providerAuthConfig?: ValidationTypeValue<typeof authConfigValidator> | null;
  },
  opts: {
    ua?: string;
    ip?: string;
  }
) => {
  let deployment = await resolveDeployment(ctx, input.providerDeployment);

  let selectorCtx = {
    ...ctx,
    providerId: deployment?.id,
    deploymentId: deployment?.id
  };

  let config = await resolveConfig(selectorCtx, input.providerConfig);
  let authConfig = await resolveAuthConfig(selectorCtx, input.providerAuthConfig, opts);

  return {
    deploymentId: deployment?.id,
    configId: config?.id,
    authConfigId: authConfig?.id,

    hasEphemeral: Boolean(
      deployment?.isEphemeral || config?.hasEphemeral || authConfig?.hasEphemeral
    )
  };
};
