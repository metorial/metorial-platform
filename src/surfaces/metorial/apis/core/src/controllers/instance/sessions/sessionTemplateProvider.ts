import { badRequestError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import {
  sessionTemplateProviderService,
  sessionTemplateService
} from '@metorial-subspace/module-session';
import { sessionTemplateProviderPresenter } from '@metorial/presenters';
import { Controller } from '@metorial/rest';
import { dateFilterValidator } from '../../../lib/dateFilter';
import { normalizeArrayParam } from '../../../lib/normalizeArrayParam';
import { checkAccess } from '../../../middleware/checkAccess';
import { requireNonPublishableMachineAccess } from '../../../middleware/requireNonPublishableMachineAccess';
import { integrationsGroup, instancePath } from '../../../middleware/instanceGroup';
import { normalizeToolFilters, toolFiltersValidator } from './_shared';
import { getOwnershipActor } from '../../../lib/ownershipActor';

let sessionTemplateProviderGroup = integrationsGroup.use(async ctx => {
  if (!ctx.params.sessionTemplateProviderId) {
    throw new ServiceError(
      badRequestError({
        message: 'sessionTemplateProviderId is required',
        description: 'The sessionTemplateProviderId path parameter is required.'
      })
    );
  }

  let sessionTemplateProvider =
    await sessionTemplateProviderService.getSessionTemplateProviderById({
      instance: ctx.instance,
      sessionTemplateProviderId: ctx.params.sessionTemplateProviderId
    });

  return { sessionTemplateProvider };
});

export let sessionTemplateProviderController = Controller.create(
  {
    name: 'Session Template Providers',
    description:
      'A session template provider is one provider in a session template, with its deployment, config, auth config, and tool filters.'
  },
  {
    list: integrationsGroup
      .get(instancePath('session-template-providers', 'sessionTemplates.providers.list'), {
        name: 'List session template providers',
        description: 'Returns a paginated list of session template providers.'
      })
      .use(requireNonPublishableMachineAccess())
      .use(checkAccess({ possibleScopes: ['instance.provider.session:read'] }))
      .outputList(sessionTemplateProviderPresenter)
      .query(
        'default',
        Paginator.validate(
          v.object({
            status: v.optional(
              v.union([
                v.enumOf(['active', 'archived']),
                v.array(v.enumOf(['active', 'archived']))
              ]),
              {
                description:
                  'Only return session template providers with one of these statuses.'
              }
            ),
            id: v.optional(v.union([v.string(), v.array(v.string())]), {
              description: 'Filter by session template provider ID(s)'
            }),
            session_template_id: v.optional(v.union([v.string(), v.array(v.string())]), {
              description: 'Filter by session template ID(s)'
            }),
            provider_id: v.optional(v.union([v.string(), v.array(v.string())]), {
              description: 'Filter by provider ID(s)'
            }),
            provider_deployment_id: v.optional(v.union([v.string(), v.array(v.string())]), {
              description: 'Filter by provider deployment ID(s)'
            }),
            provider_config_id: v.optional(v.union([v.string(), v.array(v.string())]), {
              description: 'Filter by provider config ID(s)'
            }),
            provider_auth_config_id: v.optional(v.union([v.string(), v.array(v.string())]), {
              description: 'Filter by provider auth config ID(s)'
            }),
            created_at: dateFilterValidator('session template provider creation time'),
            updated_at: dateFilterValidator('session template provider last update time')
          })
        )
      )
      .do(async ctx => {
        let paginator = await sessionTemplateProviderService.listSessionTemplateProviders({
          instance: ctx.instance,
          allowDeleted: false,
          status: normalizeArrayParam(ctx.query.status),
          ids: normalizeArrayParam(ctx.query.id),
          sessionTemplateIds: normalizeArrayParam(ctx.query.session_template_id),
          providerIds: normalizeArrayParam(ctx.query.provider_id),
          providerDeploymentIds: normalizeArrayParam(ctx.query.provider_deployment_id),
          providerConfigIds: normalizeArrayParam(ctx.query.provider_config_id),
          providerAuthConfigIds: normalizeArrayParam(ctx.query.provider_auth_config_id),
          createdAt: ctx.query.created_at,
          updatedAt: ctx.query.updated_at
        });

        let list = await paginator.run(ctx.query);

        return Paginator.present(list, stp =>
          sessionTemplateProviderPresenter.present({ sessionTemplateProvider: stp })
        );
      }),

    get: sessionTemplateProviderGroup
      .get(
        instancePath(
          'session-template-providers/:sessionTemplateProviderId',
          'sessionTemplates.providers.get'
        ),
        {
          name: 'Get session template provider',
          description: 'Retrieves a session template provider.'
        }
      )
      .use(requireNonPublishableMachineAccess())
      .use(checkAccess({ possibleScopes: ['instance.provider.session:read'] }))
      .output(sessionTemplateProviderPresenter)
      .do(async ctx => {
        return sessionTemplateProviderPresenter.present({
          sessionTemplateProvider: ctx.sessionTemplateProvider
        });
      }),

    create: integrationsGroup
      .post(instancePath('session-template-providers', 'sessionTemplates.providers.create'), {
        name: 'Create session template provider',
        description: 'Creates a session template provider.'
      })
      .use(requireNonPublishableMachineAccess())
      .use(checkAccess({ possibleScopes: ['instance.provider.session:write'] }))
      .body(
        'default',
        v.object({
          session_template_id: v.string({
            description: 'Session template to add the provider to.'
          }),
          provider_deployment_id: v.optional(v.string(), {
            description: 'Deployment the template provider runs with.'
          }),
          provider_config_id: v.optional(v.string(), {
            description: 'Config the template provider runs with.'
          }),
          provider_config_vault_id: v.optional(v.string()),
          provider_auth_config_id: v.optional(v.string(), {
            description: 'Auth config the template provider runs with.'
          }),
          tool_filters: toolFiltersValidator
        })
      )
      .output(sessionTemplateProviderPresenter)
      .do(async ctx => {
        let template = await sessionTemplateService.getSessionTemplateById({
          instance: ctx.instance,
          organizationActor: getOwnershipActor(ctx),
          sessionTemplateId: ctx.body.session_template_id
        });
        let stp = await sessionTemplateProviderService.createSessionTemplateProvider({
          instance: ctx.instance,
          auditScope: ctx.auditScope,
          organizationActor: getOwnershipActor(ctx),
          template,
          input: {
            deploymentId: ctx.body.provider_deployment_id,
            configId: ctx.body.provider_config_id,
            authConfigId: ctx.body.provider_auth_config_id,
            toolFilters: normalizeToolFilters(ctx.body.tool_filters)
          }
        });

        return sessionTemplateProviderPresenter.present({ sessionTemplateProvider: stp });
      }),

    update: sessionTemplateProviderGroup
      .patch(
        instancePath(
          'session-template-providers/:sessionTemplateProviderId',
          'sessionTemplates.providers.update'
        ),
        {
          name: 'Update session template provider',
          description: 'Updates a session template provider.'
        }
      )
      .use(requireNonPublishableMachineAccess())
      .use(checkAccess({ possibleScopes: ['instance.provider.session:write'] }))
      .body(
        'default',
        v.object({
          tool_filters: toolFiltersValidator
        })
      )
      .output(sessionTemplateProviderPresenter)
      .do(async ctx => {
        let stp = await sessionTemplateProviderService.updateSessionTemplateProvider({
          instance: ctx.instance,
          auditScope: ctx.auditScope,
          sessionTemplateProvider: ctx.sessionTemplateProvider,
          input: {
            ...(ctx.body.tool_filters !== undefined
              ? { toolFilters: normalizeToolFilters(ctx.body.tool_filters) }
              : {})
          }
        });

        return sessionTemplateProviderPresenter.present({ sessionTemplateProvider: stp });
      }),

    delete: sessionTemplateProviderGroup
      .delete(
        instancePath(
          'session-template-providers/:sessionTemplateProviderId',
          'sessionTemplates.providers.delete'
        ),
        {
          name: 'Archive session template provider',
          description:
            'Archives a session template provider. It stays listable with `status=archived`.'
        }
      )
      .use(requireNonPublishableMachineAccess())
      .use(checkAccess({ possibleScopes: ['instance.provider.session:write'] }))
      .output(sessionTemplateProviderPresenter)
      .do(async ctx => {
        let sessionTemplateProvider =
          await sessionTemplateProviderService.archiveSessionTemplateProvider({
            instance: ctx.instance,
            auditScope: ctx.auditScope,
            sessionTemplateProvider: ctx.sessionTemplateProvider
          });

        return sessionTemplateProviderPresenter.present({
          sessionTemplateProvider
        });
      })
  }
);
