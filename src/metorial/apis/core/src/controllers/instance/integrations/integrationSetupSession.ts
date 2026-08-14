import { badRequestError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import {
  integrationService,
  integrationSetupSessionService
} from '@metorial-subspace/module-integration';
import { Controller } from '@metorial/rest';
import { dateFilterValidator } from '../../../lib/dateFilter';
import { normalizeArrayParam } from '../../../lib/normalizeArrayParam';
import { checkAccess } from '../../../middleware/checkAccess';
import { instanceGroup, instancePath } from '../../../middleware/instanceGroup';
import { integrationSetupSessionPresenter } from '@metorial/presenters';

let setupSessionConfigurationValidator = v.optional(
  v.object({
    provider_search: v.optional(
      v.object({
        groups: v.optional(v.array(v.object({ group_id: v.string() }))),
        collections: v.optional(v.array(v.object({ collection_id: v.string() }))),
        categories: v.optional(v.array(v.object({ category_id: v.string() })))
      })
    ),
    tool_filters: v.optional(
      v.object({
        enabled: v.optional(v.boolean())
      })
    ),
    ui: v.optional(
      v.object({
        layout: v.optional(v.enumOf(['box', 'side', 'light']))
      })
    )
  })
);

let toSubspaceSetupSessionConfiguration = (
  configuration?: {
    provider_search?: {
      groups?: { group_id: string }[];
      collections?: { collection_id: string }[];
      categories?: { category_id: string }[];
    };
    tool_filters?: { enabled?: boolean };
    ui?: { layout?: 'box' | 'side' | 'light' };
  } | null
): PrismaJson.ProviderSetupSessionConfiguration | undefined =>
  configuration
    ? {
        providerSearch: configuration.provider_search
          ? {
              groups: configuration.provider_search.groups?.map(group => ({
                groupId: group.group_id
              })),
              collections: configuration.provider_search.collections?.map(collection => ({
                collectionId: collection.collection_id
              })),
              categories: configuration.provider_search.categories?.map(category => ({
                categoryId: category.category_id
              }))
            }
          : undefined,
        toolFilters: configuration.tool_filters
          ? { enabled: configuration.tool_filters.enabled }
          : undefined,
        ui: configuration.ui ? { layout: configuration.ui.layout } : undefined
      }
    : undefined;

let integrationSetupSessionGroup = instanceGroup.use(async ctx => {
  if (!ctx.params.integrationSetupSessionId) {
    throw new ServiceError(
      badRequestError({
        message: 'integrationSetupSessionId is required',
        description: 'The integrationSetupSessionId path parameter is required.'
      })
    );
  }

  let integrationSetupSession =
    await integrationSetupSessionService.getIntegrationSetupSessionById({
      instance: ctx.instance,
      integrationSetupSessionId: ctx.params.integrationSetupSessionId,
      allowDeleted: true
    });

  return { integrationSetupSession };
});

export let integrationSetupSessionController = Controller.create(
  {
    name: 'Integration Setup Sessions',
    description:
      'Integration setup sessions orchestrate configuring every provider required by an integration instance.'
  },
  {
    list: instanceGroup
      .get(instancePath('integration-setup-sessions', 'integrations.setupSessions.list'), {
        name: 'List integration setup sessions',
        description: 'Returns a paginated list of integration setup sessions.'
      })
      .use(checkAccess({ possibleScopes: ['instance.provider.session:read'] }))
      .outputList(integrationSetupSessionPresenter)
      .query(
        'default',
        Paginator.validate(
          v.object({
            status: v.optional(
              v.union([
                v.enumOf(['pending', 'successful', 'expired', 'archived', 'deleted']),
                v.array(v.enumOf(['pending', 'successful', 'expired', 'archived', 'deleted']))
              ])
            ),
            id: v.optional(v.union([v.string(), v.array(v.string())])),
            integration_id: v.optional(v.union([v.string(), v.array(v.string())])),
            integration_instance_id: v.optional(v.union([v.string(), v.array(v.string())])),
            created_at: dateFilterValidator('integration setup session creation time'),
            updated_at: dateFilterValidator('integration setup session last update time')
          })
        )
      )
      .do(async ctx => {
        let paginator = await integrationSetupSessionService.listIntegrationSetupSessions({
          instance: ctx.instance,
          allowDeleted: true,
          status: normalizeArrayParam(ctx.query.status),
          ids: normalizeArrayParam(ctx.query.id),
          integrationIds: normalizeArrayParam(ctx.query.integration_id),
          integrationInstanceIds: normalizeArrayParam(ctx.query.integration_instance_id),
          createdAt: ctx.query.created_at,
          updatedAt: ctx.query.updated_at
        });

        let list = await paginator.run(ctx.query);

        return Paginator.present(list, integrationSetupSession =>
          integrationSetupSessionPresenter.present({ integrationSetupSession })
        );
      }),

    get: integrationSetupSessionGroup
      .get(
        instancePath(
          'integration-setup-sessions/:integrationSetupSessionId',
          'integrations.setupSessions.get'
        ),
        {
          name: 'Get integration setup session',
          description: 'Retrieves a specific integration setup session.'
        }
      )
      .use(checkAccess({ possibleScopes: ['instance.provider.session:read'] }))
      .output(integrationSetupSessionPresenter)
      .do(async ctx =>
        integrationSetupSessionPresenter.present({
          integrationSetupSession: ctx.integrationSetupSession
        })
      ),

    create: instanceGroup
      .post(instancePath('integration-setup-sessions', 'integrations.setupSessions.create'), {
        name: 'Create integration setup session',
        description: 'Creates a new integration setup session and draft integration instance.'
      })
      .use(checkAccess({ possibleScopes: ['instance.provider.session:write'] }))
      .body(
        'default',
        v.object({
          integration_id: v.string(),
          name: v.string(),
          description: v.optional(v.string()),
          metadata: v.optional(v.record(v.any())),
          identity_actor_id: v.optional(v.nullable(v.string())),
          identity_id: v.optional(v.nullable(v.string())),
          expires_at: v.optional(v.date()),
          redirect_url: v.optional(v.string()),
          configuration: setupSessionConfigurationValidator
        })
      )
      .output(integrationSetupSessionPresenter)
      .do(async ctx => {
        let integration = await integrationService.getIntegrationById({
          instance: ctx.instance,
          integrationId: ctx.body.integration_id
        });
        let integrationSetupSession =
          await integrationSetupSessionService.createIntegrationSetupSession({
            instance: ctx.instance,
            integration,
            input: {
              name: ctx.body.name,
              description: ctx.body.description,
              metadata: ctx.body.metadata,
              identityActorId: ctx.body.identity_actor_id,
              identityId: ctx.body.identity_id,
              expiresAt: ctx.body.expires_at,
              redirectUrl: ctx.body.redirect_url,
              configuration: toSubspaceSetupSessionConfiguration(ctx.body.configuration)
            },
            import: {
              ip: ctx.context.ip,
              ua: ctx.context.ua ?? ''
            }
          });

        return integrationSetupSessionPresenter.present({ integrationSetupSession });
      })
  }
);
