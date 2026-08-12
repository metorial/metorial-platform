import { badRequestError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import {
  providerTriggerService,
  providerVersionService
} from '@metorial-subspace/module-catalog';
import { Controller } from '@metorial/rest';
import { checkAccess } from '../../../middleware/checkAccess';
import { instanceGroup, instancePath } from '../../../middleware/instanceGroup';
import { providerTriggerPresenter } from '@metorial/presenters';

let providerTriggerGroup = instanceGroup.use(async ctx => {
  if (!ctx.params.providerTriggerId) {
    throw new ServiceError(
      badRequestError({
        message: 'providerTriggerId is required',
        description: 'The providerTriggerId path parameter is required.'
      })
    );
  }

  let trigger = await providerTriggerService.getProviderTriggerById({
    instance: ctx.instance,
    providerTriggerId: ctx.params.providerTriggerId
  });

  return { trigger };
});

export let providerTriggerController = Controller.create(
  {
    name: 'Provider Triggers',
    description:
      'A provider trigger describes an event source a provider can emit for callbacks. Use triggers to discover which callback subscriptions a provider version supports.'
  },
  {
    list: instanceGroup
      .get(instancePath('provider-triggers', 'providers.triggers.list'), {
        name: 'List provider triggers',
        description:
          'Returns a paginated list of provider triggers for a specific provider version.'
      })
      .use(checkAccess({ possibleScopes: ['instance.provider.specification:read'] }))
      .outputList(providerTriggerPresenter)
      .query(
        'default',
        Paginator.validate(
          v.object({
            provider_version_id: v.string({
              description: 'Provider version to list triggers for',
              examples: ['pvr_3xYzAbCdEfGhIjKl']
            })
          })
        )
      )
      .do(async ctx => {
        let providerVersion = await providerVersionService.getProviderVersionById({
          instance: ctx.instance,
          providerVersionId: ctx.query.provider_version_id
        });
        let paginator = await providerTriggerService.listProviderTriggers({
          instance: ctx.instance,
          providerVersion
        });

        let list = await paginator.run(ctx.query);

        return Paginator.present(list, trigger =>
          providerTriggerPresenter.present({ trigger })
        );
      }),

    get: providerTriggerGroup
      .get(instancePath('provider-triggers/:providerTriggerId', 'providers.triggers.get'), {
        name: 'Get provider trigger',
        description: 'Retrieves a specific provider trigger by ID.'
      })
      .use(checkAccess({ possibleScopes: ['instance.provider.specification:read'] }))
      .output(providerTriggerPresenter)
      .do(async ctx => {
        return providerTriggerPresenter.present({ trigger: ctx.trigger });
      })
  }
);
