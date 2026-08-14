import { badRequestError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import { authConfigEventService } from '@metorial-subspace/module-auth';
import { Controller } from '@metorial/rest';
import { dateFilterValidator } from '../../../lib/dateFilter';
import { normalizeArrayParam } from '../../../lib/normalizeArrayParam';
import { checkAccess } from '../../../middleware/checkAccess';
import { instanceGroup, instancePath } from '../../../middleware/instanceGroup';
import { isDashboardGroup } from '../../../middleware/isDashboard';
import { providerAuthConfigEventPresenter } from '@metorial/presenters';

let providerAuthConfigEventGroup = instanceGroup.use(async ctx => {
  if (!ctx.params.providerAuthConfigEventId) {
    throw new ServiceError(
      badRequestError({
        message: 'providerAuthConfigEventId is required',
        description: 'The providerAuthConfigEventId path parameter is required.'
      })
    );
  }

  let authConfigEvent = await authConfigEventService.getAuthConfigEventById({
    instance: ctx.instance,
    authConfigEventId: ctx.params.providerAuthConfigEventId
  });

  return { authConfigEvent };
});

export let providerAuthConfigEventController = Controller.create(
  {
    name: 'Provider Auth Config Events',
    description:
      'Provider auth config events describe OAuth setup progress, token refreshes, and provider-side authentication lifecycle changes.'
  },
  {
    list: instanceGroup
      .get(instancePath('provider-auth-config-events', 'providerAuthConfigEvents.list'), {
        name: 'List provider auth config events',
        description:
          'Returns a paginated list of provider auth config events for dashboard diagnostics.'
      })
      .use(isDashboardGroup())
      .use(checkAccess({ possibleScopes: ['instance.provider.auth:read'] }))
      .outputList(providerAuthConfigEventPresenter)
      .query(
        'default',
        Paginator.validate(
          v.object({
            id: v.optional(v.union([v.string(), v.array(v.string())]), {
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
            provider_invocation_id: v.optional(v.union([v.string(), v.array(v.string())]), {
              description: 'Filter by provider invocation ID(s)'
            }),
            type: v.optional(v.union([v.string(), v.array(v.string())]), {
              description: 'Filter by auth config event type(s)'
            }),
            created_at: dateFilterValidator('provider auth config event creation time'),
            updated_at: dateFilterValidator('provider auth config event last update time')
          })
        )
      )
      .do(async ctx => {
        let paginator = await authConfigEventService.listAuthConfigEvents({
          instance: ctx.instance,
          ids: normalizeArrayParam(ctx.query.id),
          authConfigIds: normalizeArrayParam(ctx.query.provider_auth_config_id),
          authCredentialsIds: normalizeArrayParam(ctx.query.provider_auth_credentials_id),
          providerOAuthSetupIds: normalizeArrayParam(ctx.query.provider_oauth_setup_id),
          providerIds: normalizeArrayParam(ctx.query.provider_id),
          providerInvocationIds: normalizeArrayParam(ctx.query.provider_invocation_id),
          types: normalizeArrayParam(ctx.query.type),
          createdAt: ctx.query.created_at,
          updatedAt: ctx.query.updated_at
        });

        let list = await paginator.run(ctx.query);

        return Paginator.present(list, authConfigEvent =>
          providerAuthConfigEventPresenter.present({ authConfigEvent })
        );
      }),

    get: providerAuthConfigEventGroup
      .get(
        instancePath(
          'provider-auth-config-events/:providerAuthConfigEventId',
          'providerAuthConfigEvents.get'
        ),
        {
          name: 'Get provider auth config event',
          description: 'Retrieves a specific provider auth config event by ID.'
        }
      )
      .use(isDashboardGroup())
      .use(checkAccess({ possibleScopes: ['instance.provider.auth:read'] }))
      .output(providerAuthConfigEventPresenter)
      .do(async ctx => {
        return providerAuthConfigEventPresenter.present({
          authConfigEvent: ctx.authConfigEvent
        });
      })
  }
);
