import { badRequestError, ServiceError } from '@lowerdeck/error';
import { Service } from '@lowerdeck/service';
import {
  type Environment,
  type Provider,
  type ProviderVariant,
  type ProviderVersion,
  type Solution,
  type Tenant,
  withTransaction
} from '@metorial-subspace/db';
import { checkDeletedRelation } from '@metorial-subspace/list-utils';
import {
  providerConfigService,
  providerDeploymentService
} from '@metorial-subspace/module-deployment';
import { providerDeploymentInternalService } from '@metorial-subspace/module-provider-internal';
import { normalizeJsonSchema } from '@metorial-subspace/provider-utils';

export type ProviderCombinationInput = {
  deploymentId?: string;
  configId?: string;
  authConfigId?: string;

  __allowEphemeral?: boolean;
};

let providerMismatchError = badRequestError({
  message: 'Provider session inputs have mismatched providers'
});

let deploymentMismatchError = badRequestError({
  message: 'Provider session inputs cannot be used with the selected deployment'
});

let checkProviderMatch = (
  a: { providerOid: bigint } | null,
  b: { providerOid: bigint } | null
) => {
  if (a && b && a.providerOid !== b.providerOid) throw new ServiceError(providerMismatchError);
};

class providerCombinationServiceImpl {
  async getCombinations(d: {
    tenant: Tenant;
    solution: Solution;
    environment: Environment;

    providers: ProviderCombinationInput[];

    allowEphemeral?: boolean;
    limit?: number;
  }) {
    return withTransaction(
      async db => {
        let ts = {
          solutionOid: d.solution.oid,
          tenantOid: d.tenant.oid,
          environmentOid: d.environment.oid
        };

        for (let s of d.providers) {
          if (!s.configId && !s.deploymentId && !s.authConfigId) {
            throw new ServiceError(
              badRequestError({
                message:
                  'Please provide at least a provider config, auth config, or deployment'
              })
            );
          }
        }

        let limit = d.limit ?? 100;
        if (d.providers.length > limit) {
          throw new ServiceError(
            badRequestError({
              message: `Cannot associate more than ${limit} providers`
            })
          );
        }

        let res = await Promise.all(
          d.providers.map(async s => {
            let config = s.configId
              ? await db.providerConfig.findFirst({ where: { ...ts, id: s.configId } })
              : null;
            let authConfig = s.authConfigId
              ? await db.providerAuthConfig.findFirst({ where: { ...ts, id: s.authConfigId } })
              : null;
            let deployment = s.deploymentId
              ? await db.providerDeployment.findFirst({
                  where: { ...ts, id: s.deploymentId },
                  include: { currentVersion: true }
                })
              : null;

            checkDeletedRelation(config, d);
            checkDeletedRelation(deployment, d);
            checkDeletedRelation(authConfig, d);

            let providerOid =
              config?.providerOid ?? authConfig?.providerOid ?? deployment?.providerOid;

            checkProviderMatch(config, deployment);
            checkProviderMatch(authConfig, deployment);
            checkProviderMatch(config, authConfig);

            let provider:
              | (Provider & {
                  defaultVariant:
                    | (ProviderVariant & { currentVersion: ProviderVersion | null })
                    | null;
                })
              | null = null;

            // Try to infer deployment from config or auth config
            if (!deployment) {
              let deploymentOid = config?.deploymentOid ?? authConfig?.deploymentOid;

              if (deploymentOid) {
                let fetchedDeployment = await db.providerDeployment.findFirstOrThrow({
                  where: { ...ts, oid: deploymentOid },
                  include: {
                    provider: {
                      include: { defaultVariant: { include: { currentVersion: true } } }
                    },
                    currentVersion: true
                  }
                });
                checkDeletedRelation(fetchedDeployment, d);

                provider = fetchedDeployment.provider;
                deployment = fetchedDeployment;
              }
            }

            // Get default deployment if still not set
            if (!provider && providerOid) {
              provider = await db.provider.findFirstOrThrow({
                where: { oid: providerOid },
                include: { defaultVariant: { include: { currentVersion: true } } }
              });
              checkDeletedRelation(provider, d);

              deployment =
                deployment ??
                (await providerDeploymentService.ensureDefaultProviderDeployment({
                  tenant: d.tenant,
                  solution: d.solution,
                  environment: d.environment,
                  provider
                }));
            }

            if (!provider || !deployment) {
              throw new ServiceError(
                badRequestError({
                  message:
                    'Please provide at least a provider config, auth config, or deployment'
                })
              );
            }

            if (provider.oid !== deployment.providerOid) {
              throw new ServiceError(deploymentMismatchError);
            }

            if (config?.deploymentOid && config.deploymentOid !== deployment.oid)
              throw new ServiceError(deploymentMismatchError);
            if (authConfig?.deploymentOid && authConfig.deploymentOid !== deployment.oid)
              throw new ServiceError(deploymentMismatchError);

            let version = await providerDeploymentInternalService.getCurrentVersion({
              environment: d.environment,
              deployment,
              provider
            });
            if (!version?.specificationOid) {
              throw new ServiceError(
                badRequestError({ message: 'Provider has no usable version' })
              );
            }

            let spec = await db.providerSpecification.findFirstOrThrow({
              where: { oid: version.specificationOid }
            });

            if (!config) {
              if (deployment.defaultConfigOid) {
                config = await db.providerConfig.findFirstOrThrow({
                  where: { ...ts, oid: deployment.defaultConfigOid }
                });
                checkDeletedRelation(config, d);
              } else {
                let schema = normalizeJsonSchema(spec.value.specification.configJsonSchema);
                let hasRequired = true;

                if (schema) {
                  try {
                    if (schema.type === 'object' && schema.properties) {
                      let required = schema.required || [];
                      if (!required.length) hasRequired = false;
                    }
                  } catch {}
                } else {
                  hasRequired = false;
                }

                if (hasRequired) {
                  throw new ServiceError(
                    badRequestError({
                      message: 'Provider requires a config to be provided',
                      code: 'config_required'
                    })
                  );
                }

                config = await providerConfigService.ensureDefaultEmptyProviderConfig({
                  tenant: d.tenant,
                  solution: d.solution,
                  environment: d.environment,
                  provider,
                  providerDeployment: deployment
                });
                checkDeletedRelation(config, d);
              }
            }

            if (!authConfig && spec.value.authMethods.length > 0) {
              if (deployment.defaultAuthConfigOid) {
                authConfig = await db.providerAuthConfig.findFirstOrThrow({
                  where: { ...ts, oid: deployment.defaultAuthConfigOid }
                });
                checkDeletedRelation(authConfig, d);
              } else {
                throw new ServiceError(
                  badRequestError({
                    message: 'Provider requires an auth config to be provided',
                    code: 'auth_config_required'
                  })
                );
              }
            }

            if (spec.value.authMethods.length > 0 && !authConfig) {
              throw new ServiceError(
                badRequestError({ message: 'Provider requires an auth config to be provided' })
              );
            }
            if (spec.value.authMethods.length === 0 && authConfig) {
              throw new ServiceError(
                badRequestError({ message: 'Provider does not support auth configs' })
              );
            }

            checkDeletedRelation(config, d);
            checkDeletedRelation(deployment, d);
            checkDeletedRelation(authConfig, d);

            checkProviderMatch(config, deployment);
            checkProviderMatch(authConfig, deployment);
            checkProviderMatch(config, authConfig);

            return {
              deployment,
              provider,
              config,
              authConfig
            };
          })
        );

        return res;
      },
      { ifExists: true }
    );
  }
}

export let providerCombinationService = Service.create(
  'providerCombinationService',
  () => new providerCombinationServiceImpl()
).build();
