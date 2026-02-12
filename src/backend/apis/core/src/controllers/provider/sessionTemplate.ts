import { convertKeysToCamelCase } from '@metorial/case';
import { badRequestError, ServiceError } from '@metorial/error';
import { subspaceSessionTemplateService } from '@metorial/module-subspace';
import { Paginator } from '@metorial/pagination';
import { Controller } from '@metorial/rest';
import { v } from '@metorial/validation';
import {
  authConfigValidator,
  configValidator,
  deploymentValidator
} from '../../lib/providerValidators';
import { checkAccess } from '../../middleware/checkAccess';
import { instanceGroup, instancePath } from '../../middleware/instanceGroup';
import { sessionTemplatePresenter } from '../../presenters';
import { SubspaceSessionTemplate } from '../../presenters/types';

export let sessionTemplateGroup = instanceGroup.use(async ctx => {
  if (!ctx.params.sessionTemplateId) {
    throw new ServiceError(
      badRequestError({
        message: 'sessionTemplateId is required',
        description: 'The sessionTemplateId path parameter is required.'
      })
    );
  }

  let sessionTemplate = await subspaceSessionTemplateService.get({
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
      .query('default', Paginator.validate(v.object({})))
      .do(async ctx => {
        let paginator = await subspaceSessionTemplateService.list({
          instance: ctx.instance
        });

        let list = await paginator.run(ctx.query);

        return Paginator.present(list, sessionTemplate =>
          sessionTemplatePresenter.present({
            sessionTemplate: sessionTemplate as SubspaceSessionTemplate
          })
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
                provider_deployment: deploymentValidator,
                provider_config: v.optional(configValidator),
                provider_auth_config: v.optional(authConfigValidator),
                tool_filters: v.optional(
                  v.object({ tool_keys: v.optional(v.array(v.string())) })
                )
              })
            ),
            { description: 'Optional list of providers to include in the template' }
          )
        })
      )
      .output(sessionTemplatePresenter)
      .do(async ctx => {
        let sessionTemplate = await subspaceSessionTemplateService.create({
          instance: ctx.instance,
          name: ctx.body.name,
          description: ctx.body.description,
          metadata: ctx.body.metadata,
          providers: ctx.body.providers?.map(p => ({
            providerDeployment: convertKeysToCamelCase(p.provider_deployment),
            providerConfig: convertKeysToCamelCase(p.provider_config),
            providerAuthConfig: convertKeysToCamelCase(p.provider_auth_config),
            toolFilters: p.tool_filters ? { toolKeys: p.tool_filters.tool_keys } : undefined
          }))
        });

        return sessionTemplatePresenter.present({
          sessionTemplate: sessionTemplate as SubspaceSessionTemplate
        });
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
        let sessionTemplate = await subspaceSessionTemplateService.update({
          instance: ctx.instance,
          sessionTemplateId: ctx.sessionTemplate.id,
          name: ctx.body.name,
          description: ctx.body.description,
          metadata: ctx.body.metadata
        });

        return sessionTemplatePresenter.present({
          sessionTemplate: sessionTemplate as SubspaceSessionTemplate
        });
      })
  }
);
