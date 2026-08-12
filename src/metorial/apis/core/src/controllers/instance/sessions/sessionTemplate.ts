import { badRequestError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import { sessionTemplateService } from '@metorial-subspace/module-session';
import { Controller } from '@metorial/rest';
import { dateFilterValidator } from '../../../lib/dateFilter';
import { normalizeArrayParam } from '../../../lib/normalizeArrayParam';
import { checkAccess } from '../../../middleware/checkAccess';
import { instanceGroup, instancePath } from '../../../middleware/instanceGroup';
import { providerToolsPresenter, sessionTemplatePresenter } from '@metorial/presenters';
import { toolFiltersValidator } from './_shared';

let sessionTemplateGroup = instanceGroup.use(async ctx => {
  if (!ctx.params.sessionTemplateId) {
    throw new ServiceError(
      badRequestError({
        message: 'sessionTemplateId is required',
        description: 'The sessionTemplateId path parameter is required.'
      })
    );
  }

  let sessionTemplate = await sessionTemplateService.getSessionTemplateById({
    instance: ctx.instance,
    sessionTemplateId: ctx.params.sessionTemplateId
  });

  return { sessionTemplate };
});

export let sessionTemplateController = Controller.create(
  {
    name: 'Session Templates',
    description:
      'Session templates define reusable configurations for sessions, including which providers to include. Templates can be used to quickly create new sessions with consistent settings.'
  },
  {
    list: instanceGroup
      .get(instancePath('session-templates', 'sessionTemplates.list'), {
        name: 'List session templates',
        description: 'Returns a paginated list of session templates.'
      })
      .use(checkAccess({ possibleScopes: ['instance.provider.session:read'] }))
      .outputList(sessionTemplatePresenter)
      .query(
        'default',
        Paginator.validate(
          v.object({
            status: v.optional(
              v.union([
                v.enumOf(['active', 'archived']),
                v.array(v.enumOf(['active', 'archived']))
              ]),
              { description: 'Filter by status (active, archived)' }
            ),
            id: v.optional(v.union([v.string(), v.array(v.string())]), {
              description: 'Filter by session template ID(s)'
            }),
            session_id: v.optional(v.union([v.string(), v.array(v.string())]), {
              description: 'Filter templates that include sessions with these IDs'
            }),
            session_provider_id: v.optional(v.union([v.string(), v.array(v.string())]), {
              description: 'Filter templates that include session providers with these IDs'
            }),
            provider_id: v.optional(v.union([v.string(), v.array(v.string())]), {
              description: 'Filter templates that include providers with these IDs'
            }),
            provider_deployment_id: v.optional(v.union([v.string(), v.array(v.string())]), {
              description: 'Filter templates that include provider deployments with these IDs'
            }),
            provider_config_id: v.optional(v.union([v.string(), v.array(v.string())]), {
              description: 'Filter templates that include provider configs with these IDs'
            }),
            provider_auth_config_id: v.optional(v.union([v.string(), v.array(v.string())]), {
              description: 'Filter templates that include provider auth configs with these IDs'
            }),
            created_at: dateFilterValidator('session template creation time'),
            updated_at: dateFilterValidator('session template last update time')
          })
        )
      )
      .do(async ctx => {
        let paginator = await sessionTemplateService.listSessionTemplates({
          instance: ctx.instance,
          allowDeleted: false,
          status: normalizeArrayParam(ctx.query.status),
          ids: normalizeArrayParam(ctx.query.id),
          sessionIds: normalizeArrayParam(ctx.query.session_id),
          sessionProviderIds: normalizeArrayParam(ctx.query.session_provider_id),
          providerIds: normalizeArrayParam(ctx.query.provider_id),
          providerDeploymentIds: normalizeArrayParam(ctx.query.provider_deployment_id),
          providerConfigIds: normalizeArrayParam(ctx.query.provider_config_id),
          providerAuthConfigIds: normalizeArrayParam(ctx.query.provider_auth_config_id),
          createdAt: ctx.query.created_at,
          updatedAt: ctx.query.updated_at
        });

        let list = await paginator.run(ctx.query);

        return Paginator.present(list, sessionTemplate =>
          sessionTemplatePresenter.present({ sessionTemplate })
        );
      }),

    get: sessionTemplateGroup
      .get(instancePath('session-templates/:sessionTemplateId', 'sessionTemplates.get'), {
        name: 'Get session template',
        description: 'Retrieves a specific session template by ID.'
      })
      .use(checkAccess({ possibleScopes: ['instance.provider.session:read'] }))
      .output(sessionTemplatePresenter)
      .do(async ctx => {
        return sessionTemplatePresenter.present({ sessionTemplate: ctx.sessionTemplate });
      }),

    create: instanceGroup
      .post(instancePath('session-templates', 'sessionTemplates.create'), {
        name: 'Create session template',
        description: 'Creates a new session template.'
      })
      .use(checkAccess({ possibleScopes: ['instance.provider.session:write'] }))
      .body(
        'default',
        v.object({
          name: v.string({ examples: ['Production Template'] }),
          description: v.optional(
            v.string({ examples: ['Template for production sessions'] })
          ),
          metadata: v.optional(
            v.record(v.any(), { examples: [{ environment: 'production' }] }),
            { description: 'Custom key-value pairs for storing additional information' }
          ),
          providers: v.optional(
            v.array(
              v.object({
                provider_deployment_id: v.optional(v.string()),
                provider_config_id: v.optional(v.string()),
                provider_auth_config_id: v.optional(v.string()),
                tool_filters: toolFiltersValidator
              })
            ),
            { description: 'Optional list of providers to include in the template' }
          )
        })
      )
      .output(sessionTemplatePresenter)
      .do(async ctx => {
        let sessionTemplate = await sessionTemplateService.createSessionTemplate({
          instance: ctx.instance,
          input: {
            name: ctx.body.name,
            description: ctx.body.description,
            metadata: ctx.body.metadata,
            providers:
              ctx.body.providers?.map(p => ({
                deploymentId: p.provider_deployment_id,
                configId: p.provider_config_id,
                authConfigId: p.provider_auth_config_id,
                // The former RPC stored this validation union without normalization.
                // Keep the boundary cast: legacy rules are intentionally outside ToolFilter.
                toolFilters: p.tool_filters as any
              })) ?? []
          }
        });

        return sessionTemplatePresenter.present({ sessionTemplate });
      }),

    update: sessionTemplateGroup
      .patch(instancePath('session-templates/:sessionTemplateId', 'sessionTemplates.update'), {
        name: 'Update session template',
        description: 'Updates a specific session template.'
      })
      .use(checkAccess({ possibleScopes: ['instance.provider.session:write'] }))
      .body(
        'default',
        v.object({
          name: v.optional(v.string({ examples: ['Updated Template Name'] })),
          description: v.optional(v.string({ examples: ['Updated description'] })),
          metadata: v.optional(v.record(v.any(), { examples: [{ environment: 'staging' }] }), {
            description: 'Custom key-value pairs for storing additional information'
          })
        })
      )
      .output(sessionTemplatePresenter)
      .do(async ctx => {
        let sessionTemplate = await sessionTemplateService.updateSessionTemplate({
          instance: ctx.instance,
          template: ctx.sessionTemplate,
          input: {
            name: ctx.body.name,
            description: ctx.body.description,
            metadata: ctx.body.metadata
          }
        });

        return sessionTemplatePresenter.present({ sessionTemplate });
      }),

    delete: sessionTemplateGroup
      .delete(
        instancePath('session-templates/:sessionTemplateId', 'sessionTemplates.delete'),
        {
          name: 'Delete session template',
          description: 'Deletes a specific session template.'
        }
      )
      .use(checkAccess({ possibleScopes: ['instance.provider.session:write'] }))
      .output(sessionTemplatePresenter)
      .do(async ctx => {
        let sessionTemplate = await sessionTemplateService.deleteSessionTemplate({
          instance: ctx.instance,
          sessionTemplate: ctx.sessionTemplate
        });

        return sessionTemplatePresenter.present({ sessionTemplate });
      }),

    listTools: sessionTemplateGroup
      .get(
        instancePath(
          'session-templates/:sessionTemplateId/tools',
          'sessionTemplates.listTools'
        ),
        {
          name: 'List session template tools',
          description:
            'Returns the effective set of tools available through the providers in a session template, filtered by the tool filters of each provider, deployment, config, and auth config.'
        }
      )
      .use(checkAccess({ possibleScopes: ['instance.provider.session:read'] }))
      .output(providerToolsPresenter)
      .do(async ctx => {
        let items = await sessionTemplateService.listSessionTemplateTools({
          instance: ctx.instance,
          sessionTemplateId: ctx.sessionTemplate.id
        });

        return providerToolsPresenter.present({ items });
      })
  }
);
