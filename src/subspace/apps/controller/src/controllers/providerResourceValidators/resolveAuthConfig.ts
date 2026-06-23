import { badRequestError, ServiceError } from '@lowerdeck/error';
import { v, type ValidationTypeValue } from '@lowerdeck/validation';
import type { TenantSelector } from '@metorial-subspace/list-utils';
import { providerAuthConfigService } from '@metorial-subspace/module-auth';
import { providerService } from '@metorial-subspace/module-catalog';
import { providerDeploymentService } from '@metorial-subspace/module-deployment';

export let authConfigValidator = v.union([
  v.object({ type: v.literal('reference'), providerAuthConfigId: v.string() }),
  v.object({
    type: v.literal('ephemeral'),
    name: v.optional(v.string()),
    providerAuthMethodId: v.string(),
    credentials: v.record(v.any()),
    providerId: v.optional(v.string())
  })
]);

type AuthConfigInput = ValidationTypeValue<typeof authConfigValidator>;

export let resolveAuthConfig = async (
  ctx: TenantSelector & {
    providerId?: string;
    deploymentId?: string;
  },
  input: AuthConfigInput | undefined | null,
  opts: {
    ip?: string;
    ua?: string;
  }
) => {
  if (!input) return undefined;

  if (input.type === 'reference') {
    return {
      id: input.providerAuthConfigId,
      hasEphemeral: false
    };
  }

  if (input.type === 'ephemeral') {
    let providerId = input.providerId || ctx.providerId;

    let provider = providerId
      ? await providerService.getProviderById({
          tenant: ctx.tenant,
          solution: ctx.solution,
          environment: ctx.environment,
          providerId
        })
      : undefined;

    let providerDeployment = ctx.deploymentId
      ? await providerDeploymentService.getProviderDeploymentById({
          tenant: ctx.tenant,
          solution: ctx.solution,
          environment: ctx.environment,
          providerDeploymentId: ctx.deploymentId
        })
      : undefined;

    if (!provider && providerDeployment) {
      provider = await providerService.getProviderById({
        tenant: ctx.tenant,
        solution: ctx.solution,
        environment: ctx.environment,
        providerId: providerDeployment.provider.id
      });
    }

    if (!provider) {
      throw new ServiceError(
        badRequestError({
          message: 'Unable to resolve provider. Please provide a valid provider ID.'
        })
      );
    }

    let ac = await providerAuthConfigService.createProviderAuthConfig({
      tenant: ctx.tenant,
      solution: ctx.solution,
      environment: ctx.environment,
      provider,
      providerDeployment,
      source: 'manual',
      import: {
        ip: opts.ip,
        ua: opts.ua,
        note: 'Created via ephemeral provider configuration'
      },
      input: {
        name: input.name ?? 'Ephemeral auth config',
        authMethodId: input.providerAuthMethodId,
        config: input.credentials,
        isEphemeral: true
      }
    });

    return {
      id: ac.id,
      hasEphemeral: true
    };
  }

  return undefined;
};
