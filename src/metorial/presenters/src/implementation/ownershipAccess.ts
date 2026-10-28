import { v } from '@lowerdeck/validation';
import { Presenter } from '@metorial/presenter';
import { ownershipAccessType } from '../types';

export let v1OwnershipAccessPresenter = Presenter.create(ownershipAccessType)
  .presenter(async ({ ownershipAccess }) => ({
    object: 'ownership_access' as const,
    restricted_for_caller: ownershipAccess.isRestrictedByProject,
    own_actor_ids: ownershipAccess.ownActorIds
  }))
  .schema(
    v.object({
      object: v.literal('ownership_access'),
      restricted_for_caller: v.boolean({
        description:
          'Whether consumer-owned resources are restricted for the caller by the project settings. Owner-locked resources are always restricted for non-owners.'
      }),
      own_actor_ids: v.array(v.string(), {
        description: 'Identity actor IDs that belong to the caller and count as owner.'
      })
    })
  )
  .build();
