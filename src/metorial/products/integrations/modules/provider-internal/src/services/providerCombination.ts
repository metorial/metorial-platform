import { badRequestError, notFoundError, ServiceError } from '@lowerdeck/error';
import { Service } from '@lowerdeck/service';
import {
  db as defaultDb,
  dbPrimary,
  type Environment,
  Prisma,
  type Provider,
  type ProviderAuthConfig,
  type ProviderAuthConfigVersion,
  type ProviderAuthMethod,
  type ProviderConfig,
  type ProviderConfigVersion,
  type ProviderDeployment,
  type ProviderDeploymentVersion,
  type ProviderVariant,
  type ProviderVersion,
  type Tenant,
  type TransactionDB,
  withTransaction
} from '@metorial-subspace/db';
import { checkDeletedRelation } from '@metorial-subspace/list-utils';
import {
  providerConfigService,
  providerDeploymentService
} from '@metorial-subspace/module-deployment';
import { providerDeploymentInternalService } from './providerDeployment';
import {
  getMetorialSolution,
  type MetorialFacing,
  resolveMetorialFacing
} from '@metorial-subspace/module-tenant';
import { normalizeJsonSchema } from '@metorial-subspace/provider-utils';
import { assertNotPublicMcpOwned } from '@metorial-subspace/public-mcp-guard';

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

let missingInputError = badRequestError({
  message: 'Please provide at least a provider config, auth config, or deployment'
});

let providerInclude = { defaultVariant: { include: { currentVersion: true } } } as const;

let checkProviderMatch = (
  a: { providerOid: bigint } | null,
  b: { providerOid: bigint } | null
) => {
  if (a && b && a.providerOid !== b.providerOid) throw new ServiceError(providerMismatchError);
};

let uniqueOids = (oids: (bigint | null | undefined)[]) => [
  ...new Set(oids.filter((oid): oid is bigint => oid != null))
];

let requireByOid = <T>(records: Map<bigint, T>, oid: bigint, entity: string) => {
  let record = records.get(oid);
  if (!record) throw new ServiceError(notFoundError(entity, oid.toString()));
  return record;
};

let isConfigSchemaRequired = (configJsonSchema: unknown) => {
  let schema = normalizeJsonSchema(configJsonSchema as any);
  if (!schema) return false;

  try {
    if (schema.type === 'object' && schema.properties) {
      let required = schema.required || [];
      if (!required.length) return false;
    }
  } catch {}

  return true;
};

type CombinationProvider = Provider & {
  defaultVariant: (ProviderVariant & { currentVersion: ProviderVersion | null }) | null;
};

type CombinationDeployment = ProviderDeployment & {
  currentVersion: ProviderDeploymentVersion | null;
};

type CombinationConfig = ProviderConfig & { currentVersion: ProviderConfigVersion | null };

type CombinationAuthConfig = ProviderAuthConfig & {
  currentVersion: ProviderAuthConfigVersion | null;
  authMethod: ProviderAuthMethod;
};

export type GetCombinationsParams = {
  tenant: Tenant;
  environment: Environment;

  providers: ProviderCombinationInput[];

  allowEphemeral?: boolean;
  allowMissingAuthConfig?: boolean;
  limit?: number;
};

class providerCombinationServiceImpl {
  async getCombinations(d: MetorialFacing<GetCombinationsParams>) {
    let { instance, organizationActor, ...rest } = d;
    let { tenant, environment } = await resolveMetorialFacing({ instance, organizationActor });
    return this.getCombinationsInternal({ ...rest, tenant, environment });
  }

  async getCombinationsInternal(d: GetCombinationsParams) {
    let solution = await getMetorialSolution();

    return withTransaction(
      async tdb => {
        // Without an enclosing transaction withTransaction hands back the replica-routed
        // client; inputs created moments ago must be visible, so read from the primary.
        let db = (tdb === defaultDb ? dbPrimary : tdb) as TransactionDB;

        let ts = {
          solutionOid: solution.oid,
          tenantOid: d.tenant.oid,
          environmentOid: d.environment.oid
        };

        for (let s of d.providers) {
          if (!s.configId && !s.deploymentId && !s.authConfigId) {
            throw new ServiceError(missingInputError);
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

        if (!d.providers.length) return [];

        let configIds = [
          ...new Set(d.providers.flatMap(s => (s.configId ? [s.configId] : [])))
        ];
        let authConfigIds = [
          ...new Set(d.providers.flatMap(s => (s.authConfigId ? [s.authConfigId] : [])))
        ];
        let deploymentIds = [
          ...new Set(d.providers.flatMap(s => (s.deploymentId ? [s.deploymentId] : [])))
        ];

        let configs = configIds.length
          ? await db.providerConfig.findMany({
              where: { ...ts, id: { in: configIds } },
              include: { currentVersion: true }
            })
          : [];
        let authConfigs = authConfigIds.length
          ? await db.providerAuthConfig.findMany({
              where: { ...ts, id: { in: authConfigIds } },
              include: { currentVersion: true, authMethod: true }
            })
          : [];
        let deployments = deploymentIds.length
          ? await db.providerDeployment.findMany({
              where: { ...ts, id: { in: deploymentIds } },
              include: { currentVersion: true }
            })
          : [];

        let configsById = new Map(configs.map(c => [c.id, c]));
        let authConfigsById = new Map(authConfigs.map(c => [c.id, c]));
        let deploymentsById = new Map(deployments.map(dep => [dep.id, dep]));

        let items = d.providers.map(s => {
          let config: CombinationConfig | null = s.configId
            ? (configsById.get(s.configId) ?? null)
            : null;
          let authConfig: CombinationAuthConfig | null = s.authConfigId
            ? (authConfigsById.get(s.authConfigId) ?? null)
            : null;
          let deployment: CombinationDeployment | null = s.deploymentId
            ? (deploymentsById.get(s.deploymentId) ?? null)
            : null;

          checkDeletedRelation(config, d);
          checkDeletedRelation(deployment, d);
          checkDeletedRelation(authConfig, d);

          checkProviderMatch(config, deployment);
          checkProviderMatch(authConfig, deployment);
          checkProviderMatch(config, authConfig);

          return {
            config,
            authConfig,
            deployment,
            provider: null as CombinationProvider | null,
            providerOid:
              config?.providerOid ?? authConfig?.providerOid ?? deployment?.providerOid
          };
        });

        // Infer the deployment from the config or auth config
        let inferredDeploymentOids = uniqueOids(
          items
            .filter(item => !item.deployment)
            .map(item => item.config?.deploymentOid ?? item.authConfig?.deploymentOid)
        );
        let inferredDeployments = inferredDeploymentOids.length
          ? await db.providerDeployment.findMany({
              where: { ...ts, oid: { in: inferredDeploymentOids } },
              include: { provider: { include: providerInclude }, currentVersion: true }
            })
          : [];
        let inferredDeploymentsByOid = new Map(inferredDeployments.map(dep => [dep.oid, dep]));

        for (let item of items) {
          if (item.deployment) continue;

          let deploymentOid = item.config?.deploymentOid ?? item.authConfig?.deploymentOid;
          if (!deploymentOid) continue;

          let fetchedDeployment = requireByOid(
            inferredDeploymentsByOid,
            deploymentOid,
            'provider.deployment'
          );
          checkDeletedRelation(fetchedDeployment, d);

          item.provider = fetchedDeployment.provider;
          item.deployment = fetchedDeployment;
        }

        let providerOids = uniqueOids(
          items.filter(item => !item.provider).map(item => item.providerOid)
        );
        let providers = providerOids.length
          ? await db.provider.findMany({
              where: { oid: { in: providerOids } },
              include: providerInclude
            })
          : [];
        let providersByOid = new Map(providers.map(p => [p.oid, p]));

        let versioned = await Promise.all(
          items.map(async item => {
            let provider = item.provider;
            let deployment = item.deployment;

            if (!provider && item.providerOid) {
              provider = requireByOid(providersByOid, item.providerOid, 'provider');
              checkDeletedRelation(provider, d);

              deployment =
                deployment ??
                (await providerDeploymentService.ensureDefaultProviderDeploymentInternal({
                  tenant: d.tenant,
                  environment: d.environment,
                  provider
                }));
            }

            if (!provider || !deployment) throw new ServiceError(missingInputError);

            if (provider.oid !== deployment.providerOid) {
              throw new ServiceError(deploymentMismatchError);
            }

            if (item.config?.deploymentOid && item.config.deploymentOid !== deployment.oid)
              throw new ServiceError(deploymentMismatchError);
            if (
              item.authConfig?.deploymentOid &&
              item.authConfig.deploymentOid !== deployment.oid
            )
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

            return {
              ...item,
              provider,
              deployment,
              specificationOid: version.specificationOid
            };
          })
        );

        // The full specification JSON holds every tool definition; only these two parts are needed
        let specificationOids = uniqueOids(versioned.map(item => item.specificationOid));
        let specifications = await db.$queryRaw<
          { oid: bigint; authMethodCount: number; configJsonSchema: unknown }[]
        >`
          SELECT
            "oid",
            CASE
              WHEN jsonb_typeof("value"->'authMethods') = 'array'
              THEN jsonb_array_length("value"->'authMethods')
              ELSE 0
            END::int AS "authMethodCount",
            "value"->'specification'->'configJsonSchema' AS "configJsonSchema"
          FROM "ProviderSpecification"
          WHERE "oid" IN (${Prisma.join(specificationOids)})
        `;
        let specificationsByOid = new Map(specifications.map(spec => [spec.oid, spec]));

        let withSpecification = versioned.map(item => ({
          ...item,
          specification: requireByOid(
            specificationsByOid,
            item.specificationOid,
            'provider.specification'
          )
        }));

        let defaultConfigOids = uniqueOids(
          withSpecification
            .filter(item => !item.config)
            .map(item => item.deployment.defaultConfigOid)
        );
        let defaultConfigs = defaultConfigOids.length
          ? await db.providerConfig.findMany({
              where: { ...ts, oid: { in: defaultConfigOids } },
              include: { currentVersion: true }
            })
          : [];
        let defaultConfigsByOid = new Map(defaultConfigs.map(c => [c.oid, c]));

        let withConfig = await Promise.all(
          withSpecification.map(async item => {
            if (item.config) return { ...item, config: item.config };

            if (item.deployment.defaultConfigOid) {
              let config = requireByOid(
                defaultConfigsByOid,
                item.deployment.defaultConfigOid,
                'provider.config'
              );
              checkDeletedRelation(config, d);

              return { ...item, config };
            }

            if (isConfigSchemaRequired(item.specification.configJsonSchema)) {
              throw new ServiceError(
                badRequestError({
                  message: 'Provider requires a config to be provided',
                  code: 'config_required'
                })
              );
            }

            let config = await providerConfigService.ensureDefaultEmptyProviderConfigInternal({
              tenant: d.tenant,
              environment: d.environment,
              provider: item.provider,
              providerDeployment: item.deployment
            });
            checkDeletedRelation(config, d);

            return { ...item, config };
          })
        );

        let needsAuthConfig = (item: (typeof withConfig)[number]) =>
          !item.authConfig &&
          item.specification.authMethodCount > 0 &&
          !d.allowMissingAuthConfig;

        for (let item of withConfig) {
          if (needsAuthConfig(item) && !item.deployment.defaultAuthConfigOid) {
            throw new ServiceError(
              badRequestError({
                message: 'Provider requires an auth config to be provided',
                code: 'auth_config_required'
              })
            );
          }
        }

        let defaultAuthConfigOids = uniqueOids(
          withConfig.filter(needsAuthConfig).map(item => item.deployment.defaultAuthConfigOid)
        );
        let defaultAuthConfigs = defaultAuthConfigOids.length
          ? await db.providerAuthConfig.findMany({
              where: { ...ts, oid: { in: defaultAuthConfigOids } },
              include: { currentVersion: true, authMethod: true }
            })
          : [];
        let defaultAuthConfigsByOid = new Map(defaultAuthConfigs.map(c => [c.oid, c]));

        return withConfig.map(item => {
          let { deployment, provider, config } = item;
          let authConfig = item.authConfig;

          if (needsAuthConfig(item)) {
            authConfig = requireByOid(
              defaultAuthConfigsByOid,
              item.deployment.defaultAuthConfigOid!,
              'provider.auth_config'
            );
            checkDeletedRelation(authConfig, d);
          }

          if (
            item.specification.authMethodCount > 0 &&
            !authConfig &&
            !d.allowMissingAuthConfig
          ) {
            throw new ServiceError(
              badRequestError({ message: 'Provider requires an auth config to be provided' })
            );
          }
          if (item.specification.authMethodCount === 0 && authConfig) {
            throw new ServiceError(
              badRequestError({ message: 'Provider does not support auth configs' })
            );
          }

          checkDeletedRelation(config, d);
          checkDeletedRelation(deployment, d);
          checkDeletedRelation(authConfig, d);

          assertNotPublicMcpOwned(config, 'provider_config');
          assertNotPublicMcpOwned(authConfig, 'provider_auth_config');

          checkProviderMatch(config, deployment);
          checkProviderMatch(authConfig, deployment);
          checkProviderMatch(config, authConfig);

          return {
            deployment,
            provider,
            config,
            authConfig
          };
        });
      },
      { ifExists: true }
    );
  }
}

export let providerCombinationService = Service.create(
  'providerCombinationService',
  () => new providerCombinationServiceImpl()
).build();
