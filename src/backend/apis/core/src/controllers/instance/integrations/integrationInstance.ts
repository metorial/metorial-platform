import { badRequestError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import { subspaceIntegrationInstanceService } from '@metorial/module-subspace';
import { Controller } from '@metorial/rest';
import { dateFilterValidator } from '../../../lib/dateFilter';
import { normalizeArrayParam } from '../../../lib/normalizeArrayParam';
import { checkAccess } from '../../../middleware/checkAccess';
import { instanceGroup, instancePath } from '../../../middleware/instanceGroup';
import {
  integrationInstancePresenter,
  providerSessionPresenter,
  sessionTemplatePresenter
} from '../../../presenters';
import { toolFiltersValidator } from '../sessions/_shared';

let integrationInstanceProviderInputValidator = v.object({
  provider_id: v.string(),
  provider_config_id: v.optional(v.nullable(v.string())),
  provider_auth_config_id: v.optional(v.nullable(v.string())),
  tool_filters: toolFiltersValidator,
  is_override_tool_filter: v.optional(v.boolean())
});

let integrationInstanceGroup = instanceGroup.use(async ctx => {
  if (!ctx.params.integrationInstanceId) {
    throw new ServiceError(
      badRequestError({
        message: 'integrationInstanceId is required',
        description: 'The integrationInstanceId path parameter is required.'
      })
    );
  }

  let integrationInstance = await subspaceIntegrationInstanceService.get({
    instance: ctx.instance,
    integrationInstanceId: ctx.params.integrationInstanceId,
    allowDeleted: true
  });

  return { integrationInstance };
});

export let integrationInstanceController = Controller.create(
  {
    name: 'Integration Instances',
    description:
      'Integration instances materialize an integration for a specific actor, identity, or runtime configuration.'
  },
  {
    list: instanceGroup
      .get(instancePath('integration-instances', 'integrations.instances.list'), {
        name: 'List integration instances',
        description: 'Returns a paginated list of integration instances.'
      })
      .use(checkAccess({ possibleScopes: ['instance.provider.session:read'] }))
      .outputList(integrationInstancePresenter)
      .query(
        'default',
        Paginator.validate(
          v.object({
            search: v.optional(v.string()),
            status: v.optional(
              v.union([
                v.enumOf(['draft', 'active', 'archived', 'deleted']),
                v.array(v.enumOf(['draft', 'active', 'archived', 'deleted']))
              ])
            ),
            id: v.optional(v.union([v.string(), v.array(v.string())])),
            integration_id: v.optional(v.union([v.string(), v.array(v.string())])),
            provider_id: v.optional(v.union([v.string(), v.array(v.string())])),
            integration_provider_id: v.optional(v.union([v.string(), v.array(v.string())])),
            identity_id: v.optional(v.union([v.string(), v.array(v.string())])),
            identity_credential_id: v.optional(v.union([v.string(), v.array(v.string())])),
            identity_actor_id: v.optional(v.union([v.string(), v.array(v.string())])),
            provider_deployment_id: v.optional(v.union([v.string(), v.array(v.string())])),
            provider_config_id: v.optional(v.union([v.string(), v.array(v.string())])),
            provider_auth_config_id: v.optional(v.union([v.string(), v.array(v.string())])),
            session_template_id: v.optional(v.union([v.string(), v.array(v.string())])),
            created_at: dateFilterValidator('integration instance creation time'),
            updated_at: dateFilterValidator('integration instance last update time')
          })
        )
      )
      .do(async ctx => {
        let paginator = await subspaceIntegrationInstanceService.list({
          instance: ctx.instance,
          search: ctx.query.search,
          allowDeleted: true,
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

        return Paginator.present(list, integrationInstance =>
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
          description: 'Retrieves a specific integration instance.'
        }
      )
      .use(checkAccess({ possibleScopes: ['instance.provider.session:read'] }))
      .output(integrationInstancePresenter)
      .do(async ctx =>
        integrationInstancePresenter.present({ integrationInstance: ctx.integrationInstance })
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
            'Creates or updates the shared session template for a specific integration instance.'
        }
      )
      .use(checkAccess({ possibleScopes: ['instance.provider.session:write'] }))
      .body(
        'default',
        v.object({
          name: v.optional(v.string()),
          description: v.optional(v.string()),
          metadata: v.optional(v.record(v.any()))
        })
      )
      .output(sessionTemplatePresenter)
      .do(async ctx => {
        let sessionTemplate = await subspaceIntegrationInstanceService.createSessionTemplate({
          instance: ctx.instance,
          integrationInstanceId: ctx.integrationInstance.id,
          name: ctx.body.name,
          description: ctx.body.description,
          metadata: ctx.body.metadata
        });

        return sessionTemplatePresenter.present({ sessionTemplate });
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
            'Creates a session from the shared session template of a specific integration instance.'
        }
      )
      .use(checkAccess({ possibleScopes: ['instance.provider.session:write'] }))
      .body(
        'default',
        v.object({
          name: v.optional(v.string()),
          description: v.optional(v.string()),
          metadata: v.optional(v.record(v.any()))
        })
      )
      .output(providerSessionPresenter)
      .do(async ctx => {
        let session = await subspaceIntegrationInstanceService.createSession({
          instance: ctx.instance,
          integrationInstanceId: ctx.integrationInstance.id,
          name: ctx.body.name ?? `Session ${new Date().toISOString()}`,
          description: ctx.body.description,
          metadata: ctx.body.metadata
        });

        return providerSessionPresenter.present({ session });
      }),

    create: instanceGroup
      .post(instancePath('integration-instances', 'integrations.instances.create'), {
        name: 'Create integration instance',
        description: 'Creates a new integration instance.'
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
          providers: v.optional(v.array(integrationInstanceProviderInputValidator))
        })
      )
      .output(integrationInstancePresenter)
      .do(async ctx => {
        let integrationInstance = await subspaceIntegrationInstanceService.create({
          instance: ctx.instance,
          integrationId: ctx.body.integration_id,
          name: ctx.body.name,
          description: ctx.body.description,
          metadata: ctx.body.metadata,
          identityActorId: ctx.body.identity_actor_id,
          identityId: ctx.body.identity_id,
          providers: ctx.body.providers?.map(provider => ({
            providerId: provider.provider_id,
            providerConfigId: provider.provider_config_id,
            providerAuthConfigId: provider.provider_auth_config_id ?? undefined,
            toolFilters: provider.tool_filters,
            isOverrideToolFilter: provider.is_override_tool_filter
          }))
        });

        return integrationInstancePresenter.present({ integrationInstance });
      }),

    update: integrationInstanceGroup
      .patch(
        instancePath(
          'integration-instances/:integrationInstanceId',
          'integrations.instances.update'
        ),
        {
          name: 'Update integration instance',
          description: 'Updates a specific integration instance.'
        }
      )
      .use(checkAccess({ possibleScopes: ['instance.provider.session:write'] }))
      .body(
        'default',
        v.object({
          name: v.optional(v.string()),
          description: v.optional(v.nullable(v.string())),
          metadata: v.optional(v.nullable(v.record(v.any()))),
          identity_actor_id: v.optional(v.nullable(v.string())),
          identity_id: v.optional(v.nullable(v.string())),
          providers: v.optional(v.array(integrationInstanceProviderInputValidator))
        })
      )
      .output(integrationInstancePresenter)
      .do(async ctx => {
        let integrationInstance = await subspaceIntegrationInstanceService.update({
          instance: ctx.instance,
          integrationInstanceId: ctx.integrationInstance.id,
          allowDeleted: true,
          name: ctx.body.name,
          description: ctx.body.description,
          metadata: ctx.body.metadata,
          identityActorId: ctx.body.identity_actor_id,
          identityId: ctx.body.identity_id,
          providers: ctx.body.providers?.map(provider => ({
            providerId: provider.provider_id,
            providerConfigId: provider.provider_config_id,
            providerAuthConfigId: provider.provider_auth_config_id ?? undefined,
            toolFilters: provider.tool_filters,
            isOverrideToolFilter: provider.is_override_tool_filter
          }))
        });

        return integrationInstancePresenter.present({ integrationInstance });
      }),

    delete: integrationInstanceGroup
      .delete(
        instancePath(
          'integration-instances/:integrationInstanceId',
          'integrations.instances.delete'
        ),
        {
          name: 'Delete integration instance',
          description: 'Archives a specific integration instance.'
        }
      )
      .use(checkAccess({ possibleScopes: ['instance.provider.session:write'] }))
      .output(integrationInstancePresenter)
      .do(async ctx => {
        let integrationInstance = await subspaceIntegrationInstanceService.delete({
          instance: ctx.instance,
          integrationInstanceId: ctx.integrationInstance.id,
          allowDeleted: true
        });

        return integrationInstancePresenter.present({ integrationInstance });
      })
  }
);
