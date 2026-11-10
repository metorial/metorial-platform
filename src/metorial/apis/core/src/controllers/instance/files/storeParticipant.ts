import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import { storeParticipantService } from '@metorial/module-store';
import { Controller } from '@metorial/rest';
import { checkAccess } from '../../../middleware/checkAccess';
import { instancePath } from '../../../middleware/instanceGroup';
import { storeParticipantPresenter } from '@metorial/presenters';
import { storeGroup } from './store';

export let storeParticipantGroup = storeGroup.use(async ctx => {
  if (!ctx.params.storeParticipantId) {
    throw new Error('storeParticipantId is required');
  }

  let participant = await storeParticipantService.getStoreResourceParticipantById({
    project: ctx.project,
    instance: ctx.instance,
    store: ctx.store,
    participantId: ctx.params.storeParticipantId
  });
  let permissions = await storeParticipantService.findParticipantPermissions({
    store: ctx.store,
    participants: [participant]
  });

  return {
    storeParticipant: { ...participant, permissions: permissions.get(participant.oid) ?? [] }
  };
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
      .use(
        checkAccess({ possibleScopes: ['instance.file:read', 'consumer#instance.store:read'] })
      )
      .outputList(storeParticipantPresenter)
      .query('default', Paginator.validate(v.object({})))
      .do(async ctx => {
        let paginator = await storeParticipantService.listStoreResourceParticipants({
          project: ctx.project,
          instance: ctx.instance,
          store: ctx.store
        });
        let list = await paginator.run(ctx.query);
        let permissions = await storeParticipantService.findParticipantPermissions({
          store: ctx.store,
          participants: list.items
        });

        return Paginator.present(list, participant =>
          storeParticipantPresenter.present({
            storeParticipant: {
              ...participant,
              permissions: permissions.get(participant.oid) ?? []
            }
          })
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
      .use(
        checkAccess({ possibleScopes: ['instance.file:read', 'consumer#instance.store:read'] })
      )
      .output(storeParticipantPresenter)
      .do(async ctx =>
        storeParticipantPresenter.present({ storeParticipant: ctx.storeParticipant })
      )
  }
);
