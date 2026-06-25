import { notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import { storeParticipantService } from '@metorial/module-file';
import { Controller } from '@metorial/rest';
import { getInstanceCargoAccess } from '../../../lib/cargoAccess';
import { checkAccess } from '../../../middleware/checkAccess';
import { instancePath } from '../../../middleware/instanceGroup';
import { storeParticipantPresenter } from '../../../presenters';
import { storeGroup } from './store';

export let storeParticipantGroup = storeGroup.use(async ctx => {
  if (!ctx.params.storeParticipantId) {
    throw new Error('storeParticipantId is required');
  }

  let storeParticipant = await storeParticipantService.getStoreParticipantById({
    storeParticipantId: ctx.params.storeParticipantId,
    owner: {
      type: 'instance',
      instance: ctx.instance,
      organization: ctx.organization
    },
    ...getInstanceCargoAccess(ctx)
  });

  if (storeParticipant.storeId !== ctx.store.id) {
    throw new ServiceError(notFoundError('store.participant', ctx.params.storeParticipantId));
  }

  return { storeParticipant };
});

export let storeParticipantController = Controller.create(
  {
    name: 'Store Participants',
    description: 'Inspect participants assigned to an instance store.'
  },
  {
    list: storeGroup
      .get(instancePath('stores/:storeId/participants', 'stores.participants.list'), {
        name: 'List store participants',
        description: 'Returns a paginated list of participants for a specific store.'
      })
      .use(checkAccess({ possibleScopes: ['instance.file:read', 'consumer#instance.store:read'] }))
      .outputList(storeParticipantPresenter)
      .query('default', Paginator.validate(v.object({})))
      .do(async ctx => {
        let paginator = await storeParticipantService.listStoreParticipants({
          storeId: ctx.store.id,
          owner: {
            type: 'instance',
            instance: ctx.instance,
            organization: ctx.organization
          },
          ...getInstanceCargoAccess(ctx)
        });
        let list = await paginator.run(ctx.query);

        return Paginator.present(list, storeParticipant =>
          storeParticipantPresenter.present({ storeParticipant })
        );
      }),

    get: storeParticipantGroup
      .get(
        instancePath(
          'stores/:storeId/participants/:storeParticipantId',
          'stores.participants.get'
        ),
        {
          name: 'Get store participant by ID',
          description: 'Retrieves a specific participant within a store.'
        }
      )
      .use(checkAccess({ possibleScopes: ['instance.file:read', 'consumer#instance.store:read'] }))
      .output(storeParticipantPresenter)
      .do(async ctx =>
        storeParticipantPresenter.present({ storeParticipant: ctx.storeParticipant })
      )
  }
);
