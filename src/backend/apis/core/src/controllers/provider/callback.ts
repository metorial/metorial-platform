import { badRequestError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import { subspaceCallbackService } from '@metorial/module-subspace';
import { Controller } from '@metorial/rest';
import { normalizeArrayParam } from '../../lib/normalizeArrayParam';
import { checkAccess } from '../../middleware/checkAccess';
import { instanceGroup, instancePath } from '../../middleware/instanceGroup';
import { callbackPresenter } from '../../presenters';

export let callbackGroup = instanceGroup.use(async ctx => {
  if (!ctx.params.callbackId) {
    throw new ServiceError(
      badRequestError({
        message: 'callbackId is required',
        description: 'The callbackId path parameter is required.'
      })
    );
  }

  let callback = await subspaceCallbackService.get({
    instance: ctx.instance,
    callbackId: ctx.params.callbackId
  });

  return { callback };
});

export let callbackController = Controller.create(
  {
    name: 'Callbacks',
    description: 'Manage webhook-style callbacks backed by subspace trigger receivers.'
  },
  {
    list: instanceGroup
      .get(instancePath('callbacks', 'callbacks.list'), {
        name: 'List callbacks',
        description: 'Returns a paginated list of callbacks.'
      })
      .use(checkAccess({ possibleScopes: ['instance.callback:read'] }))
      .outputList(callbackPresenter)
      .query(
        'default',
        Paginator.validate(
          v.object({
            id: v.optional(v.union([v.string(), v.array(v.string())])),
            provider_deployment_id: v.optional(v.union([v.string(), v.array(v.string())])),
            status: v.optional(
              v.union([
                v.enumOf(['active', 'archived', 'deleted']),
                v.array(v.enumOf(['active', 'archived', 'deleted']))
              ])
            )
          })
        )
      )
      .do(async ctx => {
        let paginator = await subspaceCallbackService.list({
          instance: ctx.instance,
          allowDeleted: false,
          ids: normalizeArrayParam(ctx.query.id),
          providerDeploymentIds: normalizeArrayParam(ctx.query.provider_deployment_id),
          status: normalizeArrayParam(ctx.query.status)
        });

        let list = await paginator.run(ctx.query);

        return Paginator.present(list, callback =>
          callbackPresenter.present({
            callback
          })
        );
      }),

    get: callbackGroup
      .get(instancePath('callbacks/:callbackId', 'callbacks.get'), {
        name: 'Get callback',
        description: 'Retrieves a specific callback by ID.'
      })
      .use(checkAccess({ possibleScopes: ['instance.callback:read'] }))
      .output(callbackPresenter)
      .do(async ctx => callbackPresenter.present({ callback: ctx.callback })),

    create: instanceGroup
      .post(instancePath('callbacks', 'callbacks.create'), {
        name: 'Create callback',
        description: 'Creates a new callback definition.'
      })
      .use(checkAccess({ possibleScopes: ['instance.callback:write'] }))
      .body(
        'default',
        v.object({
          provider_deployment_id: v.string(),
          name: v.string(),
          description: v.optional(v.string()),
          metadata: v.optional(v.record(v.any())),
          poll_interval_seconds_override: v.optional(v.nullable(v.number())),
          destination_ids: v.array(v.string()),
          triggers: v.array(
            v.object({
              trigger_id: v.string(),
              event_types: v.optional(v.array(v.string()))
            })
          )
        })
      )
      .output(callbackPresenter)
      .do(async ctx => {
        let callback = await subspaceCallbackService.create({
          instance: ctx.instance,
          providerDeploymentId: ctx.body.provider_deployment_id,
          name: ctx.body.name,
          description: ctx.body.description,
          metadata: ctx.body.metadata,
          pollIntervalSecondsOverride: ctx.body.poll_interval_seconds_override,
          destinationIds: ctx.body.destination_ids,
          triggers: ctx.body.triggers.map(trigger => ({
            triggerId: trigger.trigger_id,
            eventTypes: trigger.event_types
          }))
        });

        return callbackPresenter.present({ callback });
      }),

    update: callbackGroup
      .patch(instancePath('callbacks/:callbackId', 'callbacks.update'), {
        name: 'Update callback',
        description: 'Updates a callback definition.'
      })
      .use(checkAccess({ possibleScopes: ['instance.callback:write'] }))
      .body(
        'default',
        v.object({
          name: v.optional(v.string()),
          description: v.optional(v.string()),
          metadata: v.optional(v.record(v.any())),
          poll_interval_seconds_override: v.optional(v.nullable(v.number())),
          destination_ids: v.optional(v.array(v.string())),
          triggers: v.optional(
            v.array(
              v.object({
                trigger_id: v.string(),
                event_types: v.optional(v.array(v.string()))
              })
            )
          )
        })
      )
      .output(callbackPresenter)
      .do(async ctx => {
        let callback = await subspaceCallbackService.update({
          instance: ctx.instance,
          callbackId: ctx.callback.id,
          name: ctx.body.name,
          description: ctx.body.description,
          metadata: ctx.body.metadata,
          pollIntervalSecondsOverride: ctx.body.poll_interval_seconds_override,
          destinationIds: ctx.body.destination_ids,
          triggers: ctx.body.triggers?.map(trigger => ({
            triggerId: trigger.trigger_id,
            eventTypes: trigger.event_types
          }))
        });

        return callbackPresenter.present({ callback });
      }),

    delete: callbackGroup
      .delete(instancePath('callbacks/:callbackId', 'callbacks.delete'), {
        name: 'Delete callback',
        description: 'Archives a callback definition.'
      })
      .use(checkAccess({ possibleScopes: ['instance.callback:write'] }))
      .output(callbackPresenter)
      .do(async ctx => {
        let callback = await subspaceCallbackService.archive({
          instance: ctx.instance,
          callbackId: ctx.callback.id
        });

        return callbackPresenter.present({ callback });
      })
  }
);
