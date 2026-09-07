import { badRequestError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import { callbackService } from '@metorial-subspace/module-callback';
import {
  integrationProviderService,
  integrationService
} from '@metorial-subspace/module-integration';
import { callbackPresenter } from '@metorial/presenters';
import { Controller } from '@metorial/rest';
import { dateFilterValidator } from '../../../lib/dateFilter';
import { normalizeArrayParam } from '../../../lib/normalizeArrayParam';
import { checkAccess } from '../../../middleware/checkAccess';
import { hasFlags } from '../../../middleware/hasFlags';
import { instanceGroup, instancePath } from '../../../middleware/instanceGroup';
import { callbackStatusValidator, getRequiredParam, stringOrArray } from './_shared';

export let callbackGroup = instanceGroup.use(async ctx => {
  let callback = await callbackService.getCallbackById({
    instance: ctx.instance,
    callbackId: getRequiredParam(ctx.params, 'callbackId'),
    allowDeleted: false
  });

  return { callback };
});

export let callbackController = Controller.create(
  {
    name: 'Callbacks',
    description:
      'A callback is what receives provider events for an integration provider. Creating one enables callbacks on the integration provider, and Metorial then registers the callback against every matching integration instance. Setting `callbacks.status` on the integration provider itself does the same thing.'
  },
  {
    list: instanceGroup
      .get(instancePath('callbacks', 'callbacks.list'), {
        name: 'List callbacks',
        description: 'Returns a paginated list of callbacks.'
      })
      .use(checkAccess({ possibleScopes: ['instance.callback:read'] }))
      .use(hasFlags(['callbacks-enabled']))
      .outputList(callbackPresenter)
      .query(
        'default',
        Paginator.validate(
          v.object({
            id: v.optional(stringOrArray(), { description: 'Filter by callback ID(s)' }),
            integration_id: v.optional(stringOrArray(), {
              description: 'Filter by integration ID(s)'
            }),
            integration_provider_id: v.optional(stringOrArray(), {
              description: 'Filter by integration provider ID(s)'
            }),
            provider_id: v.optional(stringOrArray(), {
              description: 'Filter by provider ID(s)'
            }),
            status: v.optional(
              v.union([callbackStatusValidator, v.array(callbackStatusValidator)]),
              { description: 'Filter by callback lifecycle status' }
            ),
            created_at: dateFilterValidator('callback creation time'),
            updated_at: dateFilterValidator('callback last update time')
          })
        )
      )
      .do(async ctx => {
        let paginator = await callbackService.listCallbacks({
          instance: ctx.instance,
          allowDeleted: false,
          ids: normalizeArrayParam(ctx.query.id),
          integrationIds: normalizeArrayParam(ctx.query.integration_id),
          integrationProviderIds: normalizeArrayParam(ctx.query.integration_provider_id),
          providerIds: normalizeArrayParam(ctx.query.provider_id),
          status: normalizeArrayParam(ctx.query.status),
          createdAt: ctx.query.created_at,
          updatedAt: ctx.query.updated_at
        });

        return Paginator.present(await paginator.run(ctx.query), callback =>
          callbackPresenter.present({ callback })
        );
      }),

    create: instanceGroup
      .post(instancePath('callbacks', 'callbacks.create'), {
        name: 'Create callback',
        description:
          'Enables callbacks for an integration provider and returns the callback it created. Only providers whose type reports `triggers.status` as `enabled` support this. Callback instances are then registered for every matching integration instance in the background.'
      })
      .use(checkAccess({ possibleScopes: ['instance.callback:write'] }))
      .use(hasFlags(['callbacks-enabled']))
      .body(
        'default',
        v.object({
          integration_id: v.string({
            description: 'Integration the integration provider belongs to',
            examples: ['int_2bCdEfGhJkLmNpQr']
          }),
          integration_provider_id: v.string({
            description: 'Integration provider to enable callbacks for',
            examples: ['inp_3cDeFgHjKlMnPqRs']
          }),
          name: v.optional(
            v.string({
              description:
                'Display name for the callback. Defaults to the name of the integration provider.',
              examples: ['Production GitHub Events']
            })
          ),
          description: v.optional(
            v.nullable(
              v.string({
                description:
                  'Description for the callback. Defaults to the description of the integration provider.',
                examples: ['Repository events for the production workspace']
              })
            )
          )
        })
      )
      .output(callbackPresenter)
      .do(async ctx => {
        let integration = await integrationService.getIntegrationById({
          instance: ctx.instance,
          integrationId: ctx.body.integration_id
        });
        let integrationProvider = await integrationProviderService.getIntegrationProviderById({
          instance: ctx.instance,
          integrationProviderId: ctx.body.integration_provider_id
        });

        let callback = await integrationProviderService.enableIntegrationProviderCallbacks({
          instance: ctx.instance,
          auditScope: ctx.auditScope,
          integration,
          integrationProvider,
          input: {
            name: ctx.body.name,
            description: ctx.body.description
          }
        });

        return callbackPresenter.present({ callback });
      }),

    get: callbackGroup
      .get(instancePath('callbacks/:callbackId', 'callbacks.get'), {
        name: 'Get callback',
        description: 'Retrieves a specific callback by ID.'
      })
      .use(checkAccess({ possibleScopes: ['instance.callback:read'] }))
      .use(hasFlags(['callbacks-enabled']))
      .output(callbackPresenter)
      .do(async ctx => callbackPresenter.present({ callback: ctx.callback })),

    update: callbackGroup
      .patch(instancePath('callbacks/:callbackId', 'callbacks.update'), {
        name: 'Update callback',
        description:
          'Updates the name, description or metadata of a callback. Everything else about a callback is derived from its integration provider - set `callbacks.status` to `disabled` there to tear it down.'
      })
      .use(checkAccess({ possibleScopes: ['instance.callback:write'] }))
      .use(hasFlags(['callbacks-enabled']))
      .body(
        'default',
        v.object({
          name: v.optional(
            v.string({
              description: 'Updated display name',
              examples: ['Staging GitHub Events']
            })
          ),
          description: v.optional(
            v.nullable(
              v.string({
                description: 'Updated description',
                examples: ['Repository events for the staging workspace']
              })
            )
          ),
          metadata: v.optional(
            v.nullable(
              v.record(v.any(), {
                description: 'Updated custom metadata',
                examples: [{ environment: 'staging', owner: 'qa-team' }]
              })
            )
          )
        })
      )
      .output(callbackPresenter)
      .do(async ctx => {
        let callback = await callbackService.updateCallback({
          instance: ctx.instance,
          callback: ctx.callback,
          input: {
            name: ctx.body.name,
            description: ctx.body.description,
            metadata: ctx.body.metadata
          }
        });

        return callbackPresenter.present({ callback });
      }),

    delete: callbackGroup
      .delete(instancePath('callbacks/:callbackId', 'callbacks.delete'), {
        name: 'Delete callback',
        description:
          'Disables callbacks on the underlying integration provider, tearing down this callback and every callback instance registered for it.'
      })
      .use(checkAccess({ possibleScopes: ['instance.callback:write'] }))
      .use(hasFlags(['callbacks-enabled']))
      .output(callbackPresenter)
      .do(async ctx => {
        if (ctx.callback.status !== 'active') {
          throw new ServiceError(
            badRequestError({
              code: 'callback_not_active',
              message: 'Only an active callback can be deleted.'
            })
          );
        }

        let integration = await integrationService.getIntegrationById({
          instance: ctx.instance,
          integrationId: ctx.callback.integration.id
        });
        let integrationProvider = await integrationProviderService.getIntegrationProviderById({
          instance: ctx.instance,
          integrationProviderId: ctx.callback.integrationProvider.id
        });

        await integrationProviderService.disableIntegrationProviderCallbacks({
          instance: ctx.instance,
          auditScope: ctx.auditScope,
          integration,
          integrationProvider
        });

        let callback = await callbackService.getCallbackById({
          instance: ctx.instance,
          callbackId: ctx.callback.id,
          allowDeleted: true
        });

        return callbackPresenter.present({ callback });
      })
  }
);
