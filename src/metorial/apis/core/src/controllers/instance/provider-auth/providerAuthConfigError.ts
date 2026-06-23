import { badRequestError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import {
  subspaceAuthConfigErrorGlobalService,
  subspaceAuthConfigErrorService
} from '@metorial/module-subspace';
import { Controller } from '@metorial/rest';
import { dateFilterValidator } from '../../../lib/dateFilter';
import { normalizeArrayParam } from '../../../lib/normalizeArrayParam';
import { checkAccess } from '../../../middleware/checkAccess';
import { instanceGroup, instancePath } from '../../../middleware/instanceGroup';
import { isDashboardGroup } from '../../../middleware/isDashboard';
import {
  providerAuthConfigErrorGroupPresenter,
  providerAuthConfigErrorPresenter
} from '../../../presenters';

let providerAuthConfigErrorGroup = instanceGroup.use(async ctx => {
  if (!ctx.params.providerAuthConfigErrorId) {
    throw new ServiceError(
      badRequestError({
        message: 'providerAuthConfigErrorId is required',
        description: 'The providerAuthConfigErrorId path parameter is required.'
      })
    );
  }

  let authConfigError = await subspaceAuthConfigErrorService.get({
    instance: ctx.instance,
    authConfigErrorId: ctx.params.providerAuthConfigErrorId
  });

  return { authConfigError };
});

let providerAuthConfigErrorGlobalGroup = instanceGroup.use(async ctx => {
  if (!ctx.params.providerAuthConfigErrorGroupId) {
    throw new ServiceError(
      badRequestError({
        message: 'providerAuthConfigErrorGroupId is required',
        description: 'The providerAuthConfigErrorGroupId path parameter is required.'
      })
    );
  }

  let authConfigErrorGroup = await subspaceAuthConfigErrorGlobalService.get({
    instance: ctx.instance,
    authConfigErrorGlobalId: ctx.params.providerAuthConfigErrorGroupId
  });

  return { authConfigErrorGroup };
});

export let providerAuthConfigErrorController = Controller.create(
  {
    name: 'Provider Auth Config Errors',
    description:
      'Provider auth config errors capture provider-side authentication failures and group repeated failures into reusable diagnostics.'
  },
  {
    list: instanceGroup
      .get(instancePath('provider-auth-config-errors', 'providerAuthConfigErrors.list'), {
        name: 'List provider auth config errors',
        description:
          'Returns a paginated list of provider auth config errors for dashboard diagnostics.'
      })
      .use(isDashboardGroup())
      .use(checkAccess({ possibleScopes: ['instance.provider.auth:read'] }))
      .outputList(providerAuthConfigErrorPresenter)
      .query(
        'default',
        Paginator.validate(
          v.object({
            id: v.optional(v.union([v.string(), v.array(v.string())]), {
              description: 'Filter by auth config error ID(s)'
            }),
            auth_config_event_id: v.optional(v.union([v.string(), v.array(v.string())]), {
              description: 'Filter by auth config event ID(s)'
            }),
            provider_auth_config_id: v.optional(v.union([v.string(), v.array(v.string())]), {
              description: 'Filter by provider auth config ID(s)'
            }),
            provider_auth_credentials_id: v.optional(
              v.union([v.string(), v.array(v.string())]),
              {
                description: 'Filter by provider auth credentials ID(s)'
              }
            ),
            provider_oauth_setup_id: v.optional(v.union([v.string(), v.array(v.string())]), {
              description: 'Filter by provider OAuth setup ID(s)'
            }),
            provider_id: v.optional(v.union([v.string(), v.array(v.string())]), {
              description: 'Filter by provider ID(s)'
            }),
            provider_auth_config_error_group_id: v.optional(
              v.union([v.string(), v.array(v.string())]),
              {
                description: 'Filter by auth config error group ID(s)'
              }
            ),
            provider_invocation_id: v.optional(v.union([v.string(), v.array(v.string())]), {
              description: 'Filter by provider invocation ID(s)'
            }),
            type: v.optional(v.union([v.string(), v.array(v.string())]), {
              description: 'Filter by auth config error type(s)'
            }),
            created_at: dateFilterValidator('provider auth config error creation time')
          })
        )
      )
      .do(async ctx => {
        let paginator = await subspaceAuthConfigErrorService.list({
          instance: ctx.instance,
          ids: normalizeArrayParam(ctx.query.id),
          authConfigEventIds: normalizeArrayParam(ctx.query.auth_config_event_id),
          authConfigIds: normalizeArrayParam(ctx.query.provider_auth_config_id),
          authCredentialsIds: normalizeArrayParam(ctx.query.provider_auth_credentials_id),
          providerOAuthSetupIds: normalizeArrayParam(ctx.query.provider_oauth_setup_id),
          providerIds: normalizeArrayParam(ctx.query.provider_id),
          authConfigErrorGlobalIds: normalizeArrayParam(
            ctx.query.provider_auth_config_error_group_id
          ),
          providerInvocationIds: normalizeArrayParam(ctx.query.provider_invocation_id),
          types: normalizeArrayParam(ctx.query.type),
          createdAt: ctx.query.created_at
        });

        let list = await paginator.run(ctx.query);

        return Paginator.present(list, authConfigError =>
          providerAuthConfigErrorPresenter.present({ authConfigError })
        );
      }),

    get: providerAuthConfigErrorGroup
      .get(
        instancePath(
          'provider-auth-config-errors/:providerAuthConfigErrorId',
          'providerAuthConfigErrors.get'
        ),
        {
          name: 'Get provider auth config error',
          description: 'Retrieves a specific provider auth config error by ID.'
        }
      )
      .use(isDashboardGroup())
      .use(checkAccess({ possibleScopes: ['instance.provider.auth:read'] }))
      .output(providerAuthConfigErrorPresenter)
      .do(async ctx => {
        return providerAuthConfigErrorPresenter.present({
          authConfigError: ctx.authConfigError
        });
      }),

    listGroups: instanceGroup
      .get(
        instancePath(
          'provider-auth-config-error-groups',
          'providerAuthConfigErrors.groups.list'
        ),
        {
          name: 'List provider auth config error groups',
          description:
            'Returns grouped provider auth config errors aggregated by type and canonical message.'
        }
      )
      .use(isDashboardGroup())
      .use(checkAccess({ possibleScopes: ['instance.provider.auth:read'] }))
      .outputList(providerAuthConfigErrorGroupPresenter)
      .query(
        'default',
        Paginator.validate(
          v.object({
            id: v.optional(v.union([v.string(), v.array(v.string())]), {
              description: 'Filter by auth config error group ID(s)'
            }),
            provider_id: v.optional(v.union([v.string(), v.array(v.string())]), {
              description: 'Filter by provider ID(s)'
            }),
            provider_auth_config_id: v.optional(v.union([v.string(), v.array(v.string())]), {
              description: 'Filter by provider auth config ID(s)'
            }),
            provider_auth_credentials_id: v.optional(
              v.union([v.string(), v.array(v.string())]),
              {
                description: 'Filter by provider auth credentials ID(s)'
              }
            ),
            type: v.optional(v.union([v.string(), v.array(v.string())]), {
              description: 'Filter by auth config error type(s)'
            }),
            created_at: dateFilterValidator('provider auth config error group creation time')
          })
        )
      )
      .do(async ctx => {
        let paginator = await subspaceAuthConfigErrorGlobalService.list({
          instance: ctx.instance,
          ids: normalizeArrayParam(ctx.query.id),
          providerIds: normalizeArrayParam(ctx.query.provider_id),
          authConfigIds: normalizeArrayParam(ctx.query.provider_auth_config_id),
          authCredentialsIds: normalizeArrayParam(ctx.query.provider_auth_credentials_id),
          types: normalizeArrayParam(ctx.query.type),
          createdAt: ctx.query.created_at
        });

        let list = await paginator.run(ctx.query);

        return Paginator.present(list, authConfigErrorGroup =>
          providerAuthConfigErrorGroupPresenter.present({ authConfigErrorGroup })
        );
      }),

    getGroup: providerAuthConfigErrorGlobalGroup
      .get(
        instancePath(
          'provider-auth-config-error-groups/:providerAuthConfigErrorGroupId',
          'providerAuthConfigErrors.groups.get'
        ),
        {
          name: 'Get provider auth config error group',
          description: 'Retrieves a specific grouped provider auth config error by ID.'
        }
      )
      .use(isDashboardGroup())
      .use(checkAccess({ possibleScopes: ['instance.provider.auth:read'] }))
      .output(providerAuthConfigErrorGroupPresenter)
      .do(async ctx => {
        return providerAuthConfigErrorGroupPresenter.present({
          authConfigErrorGroup: ctx.authConfigErrorGroup
        });
      })
  }
);
