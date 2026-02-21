import { badRequestError, ServiceError } from '@metorial/error';
import {
  subspaceProviderAuthImportService,
  type SubspaceProviderAuthImport,
  type SubspaceProviderAuthImportSchema
} from '@metorial/module-subspace';
import { Paginator } from '@metorial/pagination';
import { Controller } from '@metorial/rest';
import { v } from '@metorial/validation';
import { checkAccess } from '../../middleware/checkAccess';
import { instancePath } from '../../middleware/instanceGroup';
import { authImportSchemaPresenter, providerAuthImportPresenter } from '../../presenters';

import { providerAuthConfigGroup } from './providerAuthConfig';

export let providerAuthImportGroup = providerAuthConfigGroup.use(async ctx => {
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

/**
 * Auth imports are immutable records of credential migrations.
 * Intentionally lacks update/delete operations for audit trail purposes.
 */
export let providerAuthImportController = Controller.create(
  {
    name: 'Provider Auth Imports',
    description:
      "An auth import lets you bring in existing OAuth tokens or credentials from another system, so users don't need to re-authenticate to use Metorial."
  },
  {
    list: providerAuthConfigGroup
      .get(
        instancePath(
          'provider-deployments/:providerDeploymentId/auth-configs/:providerAuthConfigId/imports',
          'providerDeployments.authConfigs.imports.list'
        ),
        {
          name: 'List provider auth imports',
          description: 'Returns a paginated list of provider auth imports.'
        }
      )
      .use(checkAccess({ possibleScopes: ['instance.provider.auth:read'] }))
      .outputList(providerAuthImportPresenter)
      .query('default', Paginator.validate())
      .do(async ctx => {
        let paginator = await subspaceProviderAuthImportService.list({
          instance: ctx.instance,
          providerIds: [ctx.deployment.providerId],
          providerAuthConfigIds: [ctx.authConfig.id],
          providerDeploymentIds: [ctx.deployment.id]
        });

        let list = await paginator.run(ctx.query);

        return Paginator.present(list, authImport =>
          providerAuthImportPresenter.present({ authImport: authImport as SubspaceProviderAuthImport })
        );
      }),

    get: providerAuthImportGroup
      .get(
        instancePath(
          'provider-deployments/:providerDeploymentId/auth-configs/:providerAuthConfigId/imports/:providerAuthImportId',
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

    create: providerAuthConfigGroup
      .post(
        instancePath(
          'provider-deployments/:providerDeploymentId/auth-configs/:providerAuthConfigId/imports',
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
          authImport: authImport as SubspaceProviderAuthImport
        });
      }),

    getSchema: providerAuthConfigGroup
      .get(
        instancePath(
          'provider-deployments/:providerDeploymentId/auth-configs/:providerAuthConfigId/imports/schema',
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
          schema: schema as SubspaceProviderAuthImportSchema
        });
      })
  }
);
