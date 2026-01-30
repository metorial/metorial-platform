import { badRequestError, ServiceError } from '@metorial/error';
import { subspaceSessionTemplateService } from '@metorial/module-subspace';
import { Paginator } from '@metorial/pagination';
import { Controller } from '@metorial/rest';
import { v } from '@metorial/validation';
import { checkAccess } from '../../middleware/checkAccess';
import { hasFlags } from '../../middleware/hasFlags';
import { providerInstanceGroup, providerPath } from '../../middleware/providerGroup';
import { sessionTemplatePresenter } from '../../presenters';
import { SubspaceSessionTemplate } from '../../presenters/types';

export let sessionTemplateGroup = providerInstanceGroup.use(async ctx => {
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
    list: providerInstanceGroup
      .get(providerPath('session-templates', 'sessionTemplates.list'), {
        name: 'List session templates',
        description: 'Returns a paginated list of session templates.'
      })
      .use(checkAccess({ possibleScopes: ['instance.provider.session:read'] }))
      .use(hasFlags(['paid-provider-api']))
      .outputList(sessionTemplatePresenter)
      .query('default', Paginator.validate(v.object({})))
      .do(async ctx => {
        let paginator = await subspaceSessionTemplateService.list({
          instance: ctx.instance
        });

        let list = await paginator.run(ctx.query);

        return Paginator.present(list, sessionTemplate =>
          sessionTemplatePresenter.present({ sessionTemplate: sessionTemplate as SubspaceSessionTemplate })
        );
      }),

    get: sessionTemplateGroup
      .get(providerPath('session-templates/:sessionTemplateId', 'sessionTemplates.get'), {
        name: 'Get session template',
        description: 'Retrieves a specific session template by ID.'
      })
      .use(checkAccess({ possibleScopes: ['instance.provider.session:read'] }))
      .use(hasFlags(['paid-provider-api']))
      .output(sessionTemplatePresenter)
      .do(async ctx => {
        return sessionTemplatePresenter.present({ sessionTemplate: ctx.sessionTemplate });
      }),

    create: providerInstanceGroup
      .post(providerPath('session-templates', 'sessionTemplates.create'), {
        name: 'Create session template',
        description: 'Creates a new session template.'
      })
      .use(checkAccess({ possibleScopes: ['instance.provider.session:write'] }))
      .use(hasFlags(['paid-provider-api']))
      .body(
        'default',
        v.object({
          name: v.string({ examples: ['Production Template'] }),
          description: v.optional(v.string({ examples: ['Template for production sessions'] })),
          metadata: v.optional(v.record(v.any(), { examples: [{ environment: 'production' }] }), { description: 'Custom key-value pairs for storing additional information' })
        })
      )
      .output(sessionTemplatePresenter)
      .do(async ctx => {
        let sessionTemplate = await subspaceSessionTemplateService.create({
          instance: ctx.instance,
          name: ctx.body.name,
          description: ctx.body.description,
          metadata: ctx.body.metadata
        });

        return sessionTemplatePresenter.present({ sessionTemplate: sessionTemplate as SubspaceSessionTemplate });
      }),

    update: sessionTemplateGroup
      .patch(providerPath('session-templates/:sessionTemplateId', 'sessionTemplates.update'), {
        name: 'Update session template',
        description: 'Updates a specific session template.'
      })
      .use(checkAccess({ possibleScopes: ['instance.provider.session:write'] }))
      .use(hasFlags(['paid-provider-api']))
      .body(
        'default',
        v.object({
          name: v.optional(v.string({ examples: ['Updated Template Name'] })),
          description: v.optional(v.string({ examples: ['Updated description'] })),
          metadata: v.optional(v.record(v.any(), { examples: [{ environment: 'staging' }] }), { description: 'Custom key-value pairs for storing additional information' })
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

        return sessionTemplatePresenter.present({ sessionTemplate: sessionTemplate as SubspaceSessionTemplate });
      })
  }
);
