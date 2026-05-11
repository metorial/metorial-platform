import { badRequestError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import { subspaceProviderAuthExportService } from '@metorial/module-subspace';
import { Controller } from '@metorial/rest';
import { dateFilterValidator } from '../../../lib/dateFilter';
import { normalizeArrayParam } from '../../../lib/normalizeArrayParam';
import { checkAccess } from '../../../middleware/checkAccess';
import { hasFlags } from '../../../middleware/hasFlags';
import { instanceGroup, instancePath } from '../../../middleware/instanceGroup';
import { providerAuthExportPresenter } from '../../../presenters';

let providerAuthExportGroup = instanceGroup.use(async ctx => {
  if (!ctx.params.providerAuthExportId) {
    throw new ServiceError(
      badRequestError({
        message: 'providerAuthExportId is required',
        description: 'The providerAuthExportId path parameter is required.'
      })
    );
  }

  let authExport = await subspaceProviderAuthExportService.get({
    instance: ctx.instance,
    providerAuthExportId: ctx.params.providerAuthExportId
  });

  return { authExport };
});

export let providerAuthExportController = Controller.create(
  {
    name: 'Provider Auth Exports',
    description:
      'An auth export lets you extract OAuth tokens or credentials from Metorial to use in other systems, avoiding duplicate authentication flows.'
  },
  {
    list: instanceGroup
      .get(
        instancePath(
          'provider-auth-config-exports',
          'providerDeployments.authConfigs.exports.list'
        ),
        {
          name: 'List provider auth exports',
          description: 'Returns a paginated list of provider auth exports.'
        }
      )
      .use(checkAccess({ possibleScopes: ['instance.provider.auth:read'] }))
      .use(hasFlags(['paid-oauth-export']))
      .outputList(providerAuthExportPresenter)
      .query(
        'default',
        Paginator.validate(
          v.object({
            id: v.optional(v.union([v.string(), v.array(v.string())]), {
              description: 'Filter by export ID(s)'
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
            created_at: dateFilterValidator('provider auth export creation time'),
            updated_at: dateFilterValidator('provider auth export last update time')
          })
        )
      )
      .do(async ctx => {
        let paginator = await subspaceProviderAuthExportService.list({
          instance: ctx.instance,
          allowDeleted: false,

          ids: normalizeArrayParam(ctx.query.id),
          providerIds: normalizeArrayParam(ctx.query.provider_id),
          providerAuthCredentialsIds: normalizeArrayParam(
            ctx.query.provider_auth_credentials_id
          ),
          providerAuthConfigIds: normalizeArrayParam(ctx.query.provider_auth_config_id),
          createdAt: ctx.query.created_at,
          updatedAt: ctx.query.updated_at
        });

        let list = await paginator.run(ctx.query);

        return Paginator.present(list, authExport =>
          providerAuthExportPresenter.present({
            authExport
          })
        );
      }),

    get: providerAuthExportGroup
      .get(
        instancePath(
          'provider-auth-config-exports/:providerAuthExportId',
          'providerDeployments.authConfigs.exports.get'
        ),
        {
          name: 'Get provider auth export',
          description: 'Retrieves a specific provider auth export by ID.'
        }
      )
      .use(checkAccess({ possibleScopes: ['instance.provider.auth:read'] }))
      .use(hasFlags(['paid-oauth-export']))
      .output(providerAuthExportPresenter)
      .do(async ctx => {
        return providerAuthExportPresenter.present({ authExport: ctx.authExport });
      }),

    create: instanceGroup
      .post(
        instancePath(
          'provider-auth-config-exports',
          'providerDeployments.authConfigs.exports.create'
        ),
        {
          name: 'Create provider auth export',
          description: 'Exports authentication credentials from a provider.'
        }
      )
      .use(checkAccess({ possibleScopes: ['instance.provider.auth:export'] }))
      .use(hasFlags(['paid-oauth-export']))
      .body(
        'default',
        v.object({
          provider_auth_config_id: v.string({
            description: 'Provider auth config ID',
            examples: ['pacf_4sTuVwXyZaBcDeFg']
          }),
          note: v.string(),
          metadata: v.optional(v.record(v.any()), {
            description: 'Custom key-value pairs for storing additional information'
          })
        })
      )
      .output(providerAuthExportPresenter)
      .do(async ctx => {
        let authExport = await subspaceProviderAuthExportService.create({
          instance: ctx.instance,
          providerAuthConfigId: ctx.body.provider_auth_config_id,
          note: ctx.body.note,
          ip: ctx.context.ip,
          ua: ctx.context.ua ?? 'unknown',
          metadata: ctx.body.metadata
        });

        return providerAuthExportPresenter.present({
          authExport,
          value: authExport.value
        });
      })
  }
);
