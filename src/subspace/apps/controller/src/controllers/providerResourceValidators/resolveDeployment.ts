import { v, type ValidationTypeValue } from '@lowerdeck/validation';
import type { TenantSelector } from '@metorial-subspace/list-utils';
import { providerService, providerVersionService } from '@metorial-subspace/module-catalog';
import { providerDeploymentService } from '@metorial-subspace/module-deployment';
import { configValidator, resolveConfigSource } from './resolveConfig';

export let deploymentValidator = v.union([
  v.object({ type: v.literal('reference'), providerDeploymentId: v.string() }),
  v.object({
    type: v.literal('ephemeral'),
    providerId: v.string(),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    metadata: v.optional(v.record(v.any())),
    lockedProviderVersionId: v.optional(v.string()),
    config: v.optional(configValidator)
  })
]);

type DeploymentInput = ValidationTypeValue<typeof deploymentValidator>;

export let resolveDeployment = async (
  ctx: TenantSelector,
  input: DeploymentInput | undefined | null
) => {
  if (!input) return undefined;

  if (input.type === 'reference') {
    let deployment = await providerDeploymentService.getProviderDeploymentById({
      tenant: ctx.tenant,
      solution: ctx.solution,
      environment: ctx.environment,
      providerDeploymentId: input.providerDeploymentId
    });

    return {
      id: input.providerDeploymentId,
      isEphemeral: false,
      deployment
    };
  }

  if (input.type === 'ephemeral') {
    let provider = await providerService.getProviderById({
      tenant: ctx.tenant,
      solution: ctx.solution,
      environment: ctx.environment,
      providerId: input.providerId
    });

    let lockedVersion = input.lockedProviderVersionId
      ? await providerVersionService.getProviderVersionById({
          tenant: ctx.tenant,
          solution: ctx.solution,
          environment: ctx.environment,
          providerVersionId: input.lockedProviderVersionId
        })
      : undefined;

    let config = await resolveConfigSource(ctx, input.config);

    let newDeployment = await providerDeploymentService.createProviderDeployment({
      tenant: ctx.tenant,
      solution: ctx.solution,
      environment: ctx.environment,
      provider,
      lockedVersion,
      input: {
        name: input.name ?? `Ephemeral deployment for ${provider.name}`,
        description: input.description,
        metadata: input.metadata,
        config,
        isEphemeral: true
      }
    });

    return {
      id: newDeployment.id,
      hasEphemeral: true,
      deployment: newDeployment
    };
  }

  throw new Error('Invalid deployment input');
};
