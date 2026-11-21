import { hydrateResourceOwners } from '@metorial/module-resource-actor';
import { badRequestError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import {
  integrationInstanceService,
  integrationService
} from '@metorial-subspace/module-integration';
import { Controller } from '@metorial/rest';
import { dateFilterValidator } from '../../../lib/dateFilter';
import { normalizeArrayParam } from '../../../lib/normalizeArrayParam';
import { checkAccess } from '../../../middleware/checkAccess';
import { requireNonPublishableMachineAccess } from '../../../middleware/requireNonPublishableMachineAccess';
import { integrationsGroup, instancePath } from '../../../middleware/instanceGroup';
import {
  integrationInstancePresenter,
  providerSessionPresenter,
  sessionTemplatePresenter
} from '@metorial/presenters';
import { normalizeToolFilters, toolFiltersValidator } from '../sessions/_shared';
import { getOwnershipActor } from '../../../lib/ownershipActor';

let integrationInstanceProviderInputValidator = v.object({
  provider_id: v.string({
    description: 'Provider to bind, by provider ID or integration provider ID.'
  }),
  provider_config_id: v.optional(
    v.nullable(
      v.string({
        description: 'Provider config the entry runs with. Omitted uses the shared config.'
      })
    )
  ),
  provider_auth_config_id: v.optional(
    v.nullable(
      v.string({
        description: 'Credentials the entry runs with. Omitted leaves them unset.'
      })
    )
  ),
  tool_filters: toolFiltersValidator,
  is_override_tool_filter: v.optional(
    v.boolean({
      description: 'Replaces the integration tool filters instead of combining with them.'
    })
  )
});

let integrationInstanceGroup = integrationsGroup.use(async ctx => {
  if (!ctx.params.integrationInstanceId) {
    throw new ServiceError(
      badRequestError({
        message: 'integrationInstanceId is required',
        description: 'The integrationInstanceId path parameter is required.'
      })
    );
  }

  let integrationInstance = await integrationInstanceService.getIntegrationInstanceById({
    instance: ctx.instance,
    organizationActor: getOwnershipActor(ctx),
    integrationInstanceId: ctx.params.integrationInstanceId,
    allowDeleted: true
  });

  return { integrationInstance };
});

export let integrationInstanceController = Controller.create(
  {
    name: 'Integration Instances',
    description:
      'An integration instance is an integration set up for a specific actor or identity. It binds each of the integration’s providers to the deployment, config, credentials, and tool filters it runs with.'
  },
  {
    list: integrationsGroup
      .get(instancePath('integration-instances', 'integrations.instances.list'), {
        name: 'List integration instances',
        description: 'Returns a paginated list of integration instances.'
      })
      .use(requireNonPublishableMachineAccess())
      .use(checkAccess({ possibleScopes: ['instance.provider.session:read'] }))
      .outputList(integrationInstancePresenter)
      .query(
        'default',
        Paginator.validate(
          v.object({
            ownership: v.optional(v.enumOf(['shared', 'usable', 'all']), {
              description:
                'Ownership scope: `shared` (not owned by someone else), `usable` (shared plus ones you may use), or `all`. Defaults to `shared` when ownership is enforced, `all` otherwise.'
            }),
            search: v.optional(v.string(), {
              description: 'Search integration instances by name or description.'
            }),
            status: v.optional(
              v.union([
                v.enumOf(['draft', 'active', 'archived', 'deleted']),
                v.array(v.enumOf(['draft', 'active', 'archived', 'deleted']))
              ]),
              {
                description:
                  'Only return integration instances with one of these statuses. `deleted` instances are never listed.'
              }
            ),
            id: v.optional(v.union([v.string(), v.array(v.string())]), {
              description: 'Only return integration instances with one of these IDs.'
            }),
            integration_id: v.optional(v.union([v.string(), v.array(v.string())]), {
              description: 'Only return integration instances for one of these integrations.'
            }),
            provider_id: v.optional(v.union([v.string(), v.array(v.string())]), {
              description: 'Only return integration instances using one of these providers.'
            }),
            integration_provider_id: v.optional(v.union([v.string(), v.array(v.string())]), {
              description:
                'Only return integration instances using one of these integration providers.'
            }),
            identity_id: v.optional(v.union([v.string(), v.array(v.string())]), {
              description: 'Only return integration instances for one of these identities.'
            }),
            identity_credential_id: v.optional(v.union([v.string(), v.array(v.string())]), {
              description:
                'Only return integration instances using one of these identity credentials.'
            }),
            identity_actor_id: v.optional(v.union([v.string(), v.array(v.string())]), {
              description:
                'Only return integration instances for one of these identity actors.'
            }),
            provider_deployment_id: v.optional(v.union([v.string(), v.array(v.string())]), {
              description:
                'Only return integration instances running on one of these deployments.'
            }),
            provider_config_id: v.optional(v.union([v.string(), v.array(v.string())]), {
              description: 'Only return integration instances using one of these configs.'
            }),
            provider_auth_config_id: v.optional(v.union([v.string(), v.array(v.string())]), {
              description: 'Only return integration instances using one of these credentials.'
            }),
            session_template_id: v.optional(v.union([v.string(), v.array(v.string())]), {
              description:
                'Only return integration instances using one of these session templates.'
            }),
            created_at: dateFilterValidator('integration instance creation time'),
            updated_at: dateFilterValidator('integration instance last update time')
          })
        )
      )
      .do(async ctx => {
        let paginator = await integrationInstanceService.listIntegrationInstances({
          instance: ctx.instance,
          organizationActor: getOwnershipActor(ctx),
          ownership: ctx.query.ownership,
          search: ctx.query.search,
          allowDeleted: false,
          status: normalizeArrayParam(ctx.query.status),
          ids: normalizeArrayParam(ctx.query.id),
          integrationIds: normalizeArrayParam(ctx.query.integration_id),
          providerIds: normalizeArrayParam(ctx.query.provider_id),
          integrationProviderIds: normalizeArrayParam(ctx.query.integration_provider_id),
          identityIds: normalizeArrayParam(ctx.query.identity_id),
          identityCredentialIds: normalizeArrayParam(ctx.query.identity_credential_id),
          actorIds: normalizeArrayParam(ctx.query.identity_actor_id),
          providerDeploymentIds: normalizeArrayParam(ctx.query.provider_deployment_id),
          providerConfigIds: normalizeArrayParam(ctx.query.provider_config_id),
          providerAuthConfigIds: normalizeArrayParam(ctx.query.provider_auth_config_id),
          sessionTemplateIds: normalizeArrayParam(ctx.query.session_template_id),
          createdAt: ctx.query.created_at,
          updatedAt: ctx.query.updated_at
        });

        let list = await paginator.run(ctx.query);

        return Paginator.present(await hydrateResourceOwners(list), integrationInstance =>
          integrationInstancePresenter.present({ integrationInstance })
        );
      }),

    get: integrationInstanceGroup
      .get(
        instancePath(
          'integration-instances/:integrationInstanceId',
          'integrations.instances.get'
        ),
        {
          name: 'Get integration instance',
          description: 'Retrieves an integration instance.'
        }
      )
      .use(requireNonPublishableMachineAccess())
      .use(checkAccess({ possibleScopes: ['instance.provider.session:read'] }))
      .output(integrationInstancePresenter)
      .do(async ctx =>
        integrationInstancePresenter.present(
          await hydrateResourceOwners({ integrationInstance: ctx.integrationInstance })
        )
      ),

    createSessionTemplate: integrationInstanceGroup
      .post(
        instancePath(
          'integration-instances/:integrationInstanceId/session-template',
          'integrations.instances.createSessionTemplate'
        ),
        {
          name: 'Create integration instance session template',
          description:
            'Creates or updates the shared session template for the integration instance.'
        }
      )
      .use(requireNonPublishableMachineAccess())
      .use(checkAccess({ possibleScopes: ['instance.provider.session:write'] }))
      .body(
        'default',
        v.object({
          name: v.optional(
            v.string({
              description: 'Display name for the session template.'
            })
          ),
          description: v.optional(
            v.string({
              description: 'Free-text description.'
            })
          ),
          metadata: v.optional(
            v.record(v.any(), {
              description: 'Custom data to identify or organize the session template.'
            })
          )
        })
      )
      .output(sessionTemplatePresenter)
      .do(async ctx => {
        let sessionTemplate =
          await integrationInstanceService.createSessionTemplateForIntegrationInstance({
            instance: ctx.instance,
            auditScope: ctx.auditScope,
            integrationInstance: ctx.integrationInstance,
            input: {
              name: ctx.body.name,
              description: ctx.body.description,
              metadata: ctx.body.metadata
            }
          });

        return sessionTemplatePresenter.present(
          await hydrateResourceOwners({ sessionTemplate })
        );
      }),

    createSession: integrationInstanceGroup
      .post(
        instancePath(
          'integration-instances/:integrationInstanceId/session',
          'integrations.instances.createSession'
        ),
        {
          name: 'Create integration instance session',
          description:
            'Creates a session from the shared session template of the integration instance.'
        }
      )
      .use(requireNonPublishableMachineAccess())
      .use(checkAccess({ possibleScopes: ['instance.provider.session:write'] }))
      .body(
        'default',
        v.object({
          name: v.optional(
            v.string({
              description:
                'Display name for the session. Defaults to `Session` plus the current time.'
            })
          ),
          description: v.optional(
            v.string({
              description: 'Free-text description.'
            })
          ),
          metadata: v.optional(
            v.record(v.any(), {
              description: 'Custom data to identify or organize the session.'
            })
          )
        })
      )
      .output(providerSessionPresenter)
      .do(async ctx => {
        let session = await integrationInstanceService.createSessionForIntegrationInstance({
          instance: ctx.instance,
          auditScope: ctx.auditScope,
          organizationActor: getOwnershipActor(ctx),
          integrationInstance: ctx.integrationInstance,
          input: {
            name: ctx.body.name ?? `Session ${new Date().toISOString()}`,
            description: ctx.body.description,
            metadata: ctx.body.metadata
          }
        });

        return providerSessionPresenter.present(await hydrateResourceOwners({ session }));
      }),

    create: integrationsGroup
      .post(instancePath('integration-instances', 'integrations.instances.create'), {
        name: 'Create integration instance',
        description: 'Creates an integration instance.'
      })
      .use(requireNonPublishableMachineAccess())
      .use(checkAccess({ possibleScopes: ['instance.provider.session:write'] }))
      .body(
        'default',
        v.object({
          integration_id: v.string({
            description: 'Integration to create the instance for.',
            examples: ['int_2bCdEfGhJkLmNpQr']
          }),
          name: v.string({
            description: 'Display name for the integration instance.'
          }),
          description: v.optional(
            v.string({
              description: 'Free-text description.'
            })
          ),
          metadata: v.optional(
            v.record(v.any(), {
              description: 'Custom data to identify or organize the integration instance.'
            })
          ),
          identity_actor_id: v.optional(
            v.nullable(
              v.string({
                description:
                  'Identity actor the instance connects as. Omitted leaves the instance without one.'
              })
            )
          ),
          identity_id: v.optional(
            v.nullable(
              v.string({
                description:
                  'Identity the instance connects as. Omitted leaves the instance without one.'
              })
            )
          ),
          providers: v.optional(
            v.array(integrationInstanceProviderInputValidator, {
              description: 'Providers to set up on the instance.'
            })
          )
        })
      )
      .output(integrationInstancePresenter)
      .do(async ctx => {
        let integration = await integrationService.getIntegrationById({
          instance: ctx.instance,
          integrationId: ctx.body.integration_id
        });
        let integrationInstance = await integrationInstanceService.createIntegrationInstance({
          instance: ctx.instance,
          auditScope: ctx.auditScope,
          organizationActor: getOwnershipActor(ctx),
          integration,
          input: {
            name: ctx.body.name,
            description: ctx.body.description,
            metadata: ctx.body.metadata,
            identityActorId: ctx.body.identity_actor_id,
            identityId: ctx.body.identity_id,
            providers: ctx.body.providers?.map(provider => ({
              providerId: provider.provider_id,
              providerConfigId: provider.provider_config_id,
              providerAuthConfigId: provider.provider_auth_config_id ?? undefined,
              toolFilters:
                provider.tool_filters === undefined
                  ? undefined
                  : normalizeToolFilters(provider.tool_filters),
              isOverrideToolFilter: provider.is_override_tool_filter
            }))
          }
        });

        return integrationInstancePresenter.present(
          await hydrateResourceOwners({ integrationInstance })
        );
      }),

    update: integrationInstanceGroup
      .patch(
        instancePath(
          'integration-instances/:integrationInstanceId',
          'integrations.instances.update'
        ),
        {
          name: 'Update integration instance',
          description:
            'Updates an integration instance. Omitted fields keep their current value.'
        }
      )
      .use(requireNonPublishableMachineAccess())
      .use(checkAccess({ possibleScopes: ['instance.provider.session:write'] }))
      .body(
        'mt_2026_01_01_magnetar',
        v.object({
          name: v.optional(
            v.string({
              description: 'Display name for the integration instance.'
            })
          ),
          description: v.optional(
            v.nullable(
              v.string({
                description: 'Free-text description. `null` clears it.'
              })
            )
          ),
          metadata: v.optional(
            v.nullable(
              v.record(v.any(), {
                description:
                  'Custom data to identify or organize the integration instance. Replaces existing metadata. `null` clears it.'
              })
            )
          ),
          identity_actor_id: v.optional(
            v.nullable(
              v.string({
                description:
                  'Identity actor the instance connects as. `null` clears it. Omitted keeps the current one.'
              })
            )
          ),
          identity_id: v.optional(
            v.nullable(
              v.string({
                description:
                  'Identity the instance connects as. `null` clears it. Omitted keeps the current one.'
              })
            )
          ),
          providers: v.optional(
            v.array(integrationInstanceProviderInputValidator, {
              description:
                'Providers to create or update. Existing providers not listed are left alone.'
            })
          )
        }),
        v => v
      )
      .body(
        'default',
        v.object({
          name: v.optional(
            v.string({
              description: 'Display name for the integration instance.'
            })
          ),
          description: v.optional(
            v.nullable(
              v.string({
                description: 'Free-text description. `null` clears it.'
              })
            )
          ),
          metadata: v.optional(
            v.nullable(
              v.record(v.any(), {
                description:
                  'Custom data to identify or organize the integration instance. Replaces existing metadata. `null` clears it.'
              })
            )
          ),
          identity_actor_id: v.optional(
            v.nullable(
              v.string({
                description:
                  'Identity actor the instance connects as. `null` clears it. Omitted keeps the current one.'
              })
            )
          ),
          identity_id: v.optional(
            v.nullable(
              v.string({
                description:
                  'Identity the instance connects as. `null` clears it. Omitted keeps the current one.'
              })
            )
          ),
          providers: v.optional(
            v.array(integrationInstanceProviderInputValidator, {
              description:
                'Providers to create or update. Existing providers not listed are left alone.'
            })
          ),
          source: v.optional(v.enumOf(['explorer']), {
            description:
              'Mark this resource as originating from the dashboard explorer and enable its owner lock and owner-only visibility.'
          })
        })
      )
      .output(integrationInstancePresenter)
      .do(async ctx => {
        let integrationInstance = await integrationInstanceService.updateIntegrationInstance({
          instance: ctx.instance,
          auditScope: ctx.auditScope,
          organizationActor: getOwnershipActor(ctx),
          integrationInstance: ctx.integrationInstance,
          input: {
            name: ctx.body.name,
            description: ctx.body.description,
            metadata: ctx.body.metadata,
            identityActorId: ctx.body.identity_actor_id,
            source: ctx.body.source,
            isOwnerLocked: ctx.body.source === 'explorer' ? true : undefined,
            isOwnerOnlyVisible: ctx.body.source === 'explorer' ? true : undefined,
            identityId: ctx.body.identity_id,
            providers: ctx.body.providers?.map(provider => ({
              providerId: provider.provider_id,
              providerConfigId: provider.provider_config_id,
              providerAuthConfigId: provider.provider_auth_config_id ?? undefined,
              toolFilters:
                provider.tool_filters === undefined
                  ? undefined
                  : normalizeToolFilters(provider.tool_filters),
              isOverrideToolFilter: provider.is_override_tool_filter
            }))
          }
        });

        return integrationInstancePresenter.present(
          await hydrateResourceOwners({ integrationInstance })
        );
      }),

    delete: integrationInstanceGroup
      .delete(
        instancePath(
          'integration-instances/:integrationInstanceId',
          'integrations.instances.delete'
        ),
        {
          name: 'Archive integration instance',
          description:
            'Archives an integration instance. It stays retrievable by ID and listable with `status=archived`.'
        }
      )
      .use(requireNonPublishableMachineAccess())
      .use(checkAccess({ possibleScopes: ['instance.provider.session:write'] }))
      .output(integrationInstancePresenter)
      .do(async ctx => {
        let integrationInstance = await integrationInstanceService.archiveIntegrationInstance({
          instance: ctx.instance,
          auditScope: ctx.auditScope,
          integrationInstance: ctx.integrationInstance
        });

        return integrationInstancePresenter.present(
          await hydrateResourceOwners({ integrationInstance })
        );
      })
  }
);
