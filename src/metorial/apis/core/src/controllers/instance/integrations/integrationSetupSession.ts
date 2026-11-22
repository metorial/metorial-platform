import { hydrateResourceOwners } from '@metorial/module-resource-actor';
import { badRequestError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import { setupSessionRedirectUrlPattern } from '@metorial-subspace/module-auth';
import {
  integrationInstanceService,
  integrationService,
  integrationSetupSessionService
} from '@metorial-subspace/module-integration';
import { Controller } from '@metorial/rest';
import { dateFilterValidator } from '../../../lib/dateFilter';
import { normalizeArrayParam } from '../../../lib/normalizeArrayParam';
import { checkAccess } from '../../../middleware/checkAccess';
import { requireNonPublishableMachineAccess } from '../../../middleware/requireNonPublishableMachineAccess';
import { integrationsGroup, instancePath } from '../../../middleware/instanceGroup';
import { integrationSetupSessionPresenter } from '@metorial/presenters';
import { getOwnershipActor } from '../../../lib/ownershipActor';

let redirectUrlValidator = v.optional(
  v.string({
    description: 'Where to send the user once setup completes.',
    modifiers: [
      v.url(),
      v.regex(setupSessionRedirectUrlPattern, { message: 'Must be an http or https URL' })
    ]
  })
);

let setupSessionConfigurationValidator = v.optional(
  v.object(
    {
      provider_search: v.optional(
        v.object(
          {
            groups: v.optional(
              v.array(
                v.object({
                  group_id: v.string({
                    description: 'Provider group to include in the search.'
                  })
                }),
                { description: 'Provider groups to include in the search.' }
              )
            ),
            collections: v.optional(
              v.array(
                v.object({
                  collection_id: v.string({
                    description: 'Provider collection to include in the search.'
                  })
                }),
                { description: 'Provider collections to include in the search.' }
              )
            ),
            categories: v.optional(
              v.array(
                v.object({
                  category_id: v.string({
                    description: 'Provider category to include in the search.'
                  })
                }),
                { description: 'Provider categories to include in the search.' }
              )
            )
          },
          { description: 'Narrows the setup flow’s provider search to these catalog entries.' }
        )
      ),
      tool_filters: v.optional(
        v.object(
          {
            enabled: v.optional(
              v.boolean({
                description:
                  'Lets the user pick tool filters during setup. Only applies when the integration allows custom tool filters.'
              })
            )
          },
          { description: 'Tool filter selection for the setup flow.' }
        )
      ),
      ui: v.optional(
        v.object(
          {
            layout: v.optional(
              v.enumOf(['box', 'side', 'light'], {
                description: 'Layout of the setup flow. Defaults to `box`.'
              })
            )
          },
          { description: 'Presentation of the setup flow.' }
        )
      )
    },
    { description: 'Configuration for the setup flow.' }
  )
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

let integrationSetupSessionGroup = integrationsGroup.use(async ctx => {
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
      organizationActor: getOwnershipActor(ctx),
      integrationSetupSessionId: ctx.params.integrationSetupSessionId,
      allowDeleted: true
    });

  return { integrationSetupSession };
});

export let integrationSetupSessionController = Controller.create(
  {
    name: 'Integration Setup Sessions',
    description:
      'An integration setup session is a shareable flow that connects each provider an integration instance needs. It creates a draft instance unless you pass one, and expires 30 minutes after creation unless `expires_at` is set.'
  },
  {
    list: integrationsGroup
      .get(instancePath('integration-setup-sessions', 'integrations.setupSessions.list'), {
        name: 'List integration setup sessions',
        description: 'Returns a paginated list of integration setup sessions.'
      })
      .use(requireNonPublishableMachineAccess())
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
              ]),
              {
                description:
                  'Only return setup sessions with one of these statuses. `deleted` sessions are never listed.'
              }
            ),
            id: v.optional(v.union([v.string(), v.array(v.string())]), {
              description: 'Only return setup sessions with one of these IDs.'
            }),
            integration_id: v.optional(v.union([v.string(), v.array(v.string())]), {
              description: 'Only return setup sessions for one of these integrations.'
            }),
            integration_instance_id: v.optional(v.union([v.string(), v.array(v.string())]), {
              description: 'Only return setup sessions for one of these integration instances.'
            }),
            created_at: dateFilterValidator('integration setup session creation time'),
            updated_at: dateFilterValidator('integration setup session last update time')
          })
        )
      )
      .do(async ctx => {
        let paginator = await integrationSetupSessionService.listIntegrationSetupSessions({
          instance: ctx.instance,
          organizationActor: getOwnershipActor(ctx),
          allowDeleted: false,
          status: normalizeArrayParam(ctx.query.status),
          ids: normalizeArrayParam(ctx.query.id),
          integrationIds: normalizeArrayParam(ctx.query.integration_id),
          integrationInstanceIds: normalizeArrayParam(ctx.query.integration_instance_id),
          createdAt: ctx.query.created_at,
          updatedAt: ctx.query.updated_at
        });

        let list = await paginator.run(ctx.query);
        let items =
          await integrationSetupSessionService.redactIntegrationSetupSessionsForCaller({
            instance: ctx.instance,
            organizationActor: getOwnershipActor(ctx),
            integrationSetupSessions: list.items
          });

        return Paginator.present(
          await hydrateResourceOwners({ ...list, items }),
          integrationSetupSession =>
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
          description: 'Retrieves an integration setup session.'
        }
      )
      .use(requireNonPublishableMachineAccess())
      .use(checkAccess({ possibleScopes: ['instance.provider.session:read'] }))
      .output(integrationSetupSessionPresenter)
      .do(async ctx => {
        let [integrationSetupSession] =
          await integrationSetupSessionService.redactIntegrationSetupSessionsForCaller({
            instance: ctx.instance,
            organizationActor: getOwnershipActor(ctx),
            integrationSetupSessions: [ctx.integrationSetupSession]
          });

        return integrationSetupSessionPresenter.present(
          await hydrateResourceOwners({
            integrationSetupSession: integrationSetupSession!
          })
        );
      }),

    create: integrationsGroup
      .post(instancePath('integration-setup-sessions', 'integrations.setupSessions.create'), {
        name: 'Create integration setup session',
        description:
          'Creates an integration setup session. Creates a draft integration instance unless `integration_instance_id` is given, in which case that instance is reused and its providers are configured on completion.'
      })
      .use(requireNonPublishableMachineAccess())
      .use(checkAccess({ possibleScopes: ['instance.provider.session:write'] }))
      .body(
        'default',
        v.object({
          integration_id: v.string({
            description: 'Integration to set up.',
            examples: ['int_2bCdEfGhJkLmNpQr']
          }),
          integration_instance_id: v.optional(
            v.string({
              description: 'Existing instance to reuse. Omitted creates a draft instance.',
              examples: ['ini_4dEfGhJkLmNpQrSt']
            })
          ),
          name: v.string({
            description: 'Display name for the setup session.'
          }),
          description: v.optional(
            v.string({
              description: 'Free-text description.'
            })
          ),
          metadata: v.optional(
            v.record(v.any(), {
              description: 'Custom data to identify or organize the setup session.'
            })
          ),
          identity_actor_id: v.optional(
            v.nullable(
              v.string({
                description:
                  'Identity actor the instance is set up for. Cannot be set when `integration_instance_id` is given.'
              })
            )
          ),
          identity_id: v.optional(
            v.nullable(
              v.string({
                description:
                  'Identity the instance is set up for. Cannot be set when `integration_instance_id` is given.'
              })
            )
          ),
          expires_at: v.optional(
            v.date({
              description: 'When the session expires. Defaults to 30 minutes after creation.'
            })
          ),
          redirect_url: redirectUrlValidator,
          configuration: setupSessionConfigurationValidator
        })
      )
      .output(integrationSetupSessionPresenter)
      .do(async ctx => {
        let integration = await integrationService.getIntegrationById({
          instance: ctx.instance,
          integrationId: ctx.body.integration_id
        });
        let integrationInstance = ctx.body.integration_instance_id
          ? await integrationInstanceService.getIntegrationInstanceById({
              instance: ctx.instance,
              integrationInstanceId: ctx.body.integration_instance_id
            })
          : undefined;

        let integrationSetupSession =
          await integrationSetupSessionService.createIntegrationSetupSession({
            instance: ctx.instance,
            auditScope: ctx.auditScope,
            internal: {
              skipConfirmation: ctx.apiVersion === 'mt_2025_01_01_dashboard'
            },
            organizationActor: getOwnershipActor(ctx),
            integration,
            integrationInstance,
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

        return integrationSetupSessionPresenter.present(
          await hydrateResourceOwners({ integrationSetupSession })
        );
      })
  }
);
