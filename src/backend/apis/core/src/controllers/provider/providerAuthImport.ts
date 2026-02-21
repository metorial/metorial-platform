import { badRequestError, ServiceError } from '@metorial/error';
import { subspaceProviderAuthImportService } from '@metorial/module-subspace';
import { Paginator } from '@metorial/pagination';
import { Controller } from '@metorial/rest';
import { v } from '@metorial/validation';
import { normalizeArrayParam } from '../../lib/normalizeArrayParam';
import { checkAccess } from '../../middleware/checkAccess';
import { instanceGroup, instancePath } from '../../middleware/instanceGroup';
import { authImportSchemaPresenter, providerAuthImportPresenter } from '../../presenters';

export let providerAuthImportGroup = instanceGroup.use(async ctx => {
  if (!ctx.params.providerAuthImportId) {
    throw new ServiceError(
      badRequestError({
        message: 'providerAuthImportId is required',
        description: 'The providerAuthImportId path parameter is required.'
      })
    );
  }

  let authImport = await subspaceProviderAuthImportService.get({
    instance: ctx.instance,
    providerAuthImportId: ctx.params.providerAuthImportId
  });

  return { authImport };
});

export let providerAuthImportController = Controller.create(
  {
    name: 'Provider Auth Imports',
    description:
      "An auth import lets you bring in existing OAuth tokens or credentials from another system, so users don't need to re-authenticate to use Metorial."
  },
  {
    list: instanceGroup
      .get(
        instancePath(
          'provider-auth-config-imports',
          'providerDeployments.authConfigs.imports.list'
        ),
        {
          name: 'List provider auth imports',
          description: 'Returns a paginated list of provider auth imports.'
        }
      )
      .use(checkAccess({ possibleScopes: ['instance.provider.auth:read'] }))
      .outputList(providerAuthImportPresenter)
      .query(
        'default',
        Paginator.validate(
          v.object({
            id: v.optional(v.union([v.string(), v.array(v.string())]), {
              description: 'Filter by import ID(s)'
            }),
            provider_id: v.optional(v.union([v.string(), v.array(v.string())]), {
              description: 'Filter by provider ID(s)'
            }),
            provider_auth_credentials_id: v.optional(
              v.union([v.string(), v.array(v.string())]),
              { description: 'Filter by auth credentials ID(s)' }
            ),
            provider_auth_config_id: v.optional(v.union([v.string(), v.array(v.string())]), {
              description: 'Filter by auth config ID(s)'
            }),
            provider_deployment_id: v.optional(v.union([v.string(), v.array(v.string())]), {
              description: 'Filter by provider deployment ID(s)'
            })
          })
        )
      )
      .do(async ctx => {
        let paginator = await subspaceProviderAuthImportService.list({
          instance: ctx.instance,
          allowDeleted: false,
          ids: normalizeArrayParam(ctx.query.id),
          providerIds: normalizeArrayParam(ctx.query.provider_id),
          providerAuthCredentialsIds: normalizeArrayParam(
            ctx.query.provider_auth_credentials_id
          ),
          providerAuthConfigIds: normalizeArrayParam(ctx.query.provider_auth_config_id),
          providerDeploymentIds: normalizeArrayParam(ctx.query.provider_deployment_id)
        });

        let list = await paginator.run(ctx.query);

        return Paginator.present(list, authImport =>
          providerAuthImportPresenter.present({
            authImport
          })
        );
      }),

    get: providerAuthImportGroup
      .get(
        instancePath(
          'provider-auth-config-imports/:providerAuthImportId',
          'providerDeployments.authConfigs.imports.get'
        ),
        {
          name: 'Get provider auth import',
          description: 'Retrieves a specific provider auth import by ID.'
        }
      )
      .use(checkAccess({ possibleScopes: ['instance.provider.auth:read'] }))
      .output(providerAuthImportPresenter)
      .do(async ctx => {
        return providerAuthImportPresenter.present({ authImport: ctx.authImport });
      }),

    create: instanceGroup
      .post(
        instancePath(
          'provider-auth-config-imports',
          'providerDeployments.authConfigs.imports.create'
        ),
        {
          name: 'Create provider auth import',
          description: 'Imports authentication credentials for a provider.'
        }
      )
      .use(checkAccess({ possibleScopes: ['instance.provider.auth:write'] }))
      .body(
        'default',
        v.object({
          note: v.string({
            description: 'A note describing the import source or reason',
            examples: ['Migrated from legacy OAuth app']
          }),
          metadata: v.optional(v.record(v.any()), {
            description: 'Custom key-value pairs for storing additional information'
          }),
          providerAuthMethodId: v.optional(v.string({ examples: ['pam_3cDeFgHjKlMnPqRs'] }), {
            description: 'The authentication method used by these credentials'
          }),
          value: v.record(v.any(), {
            description: 'The credential data to import',
            examples: [
              {
                access_token: 'gho_xxxxxxxxxxxxxxxxxxxx',
                refresh_token: 'ghr_xxxxxxxxxxxxxxxxxxxx',
                token_type: 'bearer',
                scope: 'repo,read:user,read:org'
              }
            ]
          })
        })
      )
      .output(providerAuthImportPresenter)
      .do(async ctx => {
        let authImport = await subspaceProviderAuthImportService.create({
          instance: ctx.instance,
          providerId: ctx.deployment.providerId,
          providerDeploymentId: ctx.deployment.id,
          providerAuthConfigId: ctx.authConfig.id,
          providerAuthMethodId: ctx.body.providerAuthMethodId,
          note: ctx.body.note,
          config: ctx.body.value,
          ip: ctx.context.ip,
          ua: ctx.context.ua ?? '',
          metadata: ctx.body.metadata
        });

        return providerAuthImportPresenter.present({
          authImport
        });
      }),

    getSchema: instanceGroup
      .get(
        instancePath(
          'provider-auth-config-imports/schema',
          'providerDeployments.authConfigs.imports.getSchema'
        ),
        {
          name: 'Get auth import schema',
          description: 'Retrieves the JSON Schema for importing authentication credentials.'
        }
      )
      .use(checkAccess({ possibleScopes: ['instance.provider.auth:read'] }))
      .output(authImportSchemaPresenter)
      .do(async ctx => {
        let schema = await subspaceProviderAuthImportService.getSchema({
          instance: ctx.instance,
          providerAuthConfigId: ctx.authConfig.id
        });

        return authImportSchemaPresenter.present({
          schema
        });
      })
  }
);
