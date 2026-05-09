import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import { cargo, type CargoStoreParticipant } from '../cargo';
import type { FileOwner } from './file';
import {
  documentParticipantService,
  type EnrichedCargoDocumentActor
} from './documentParticipant';
import { resolveCargoScopeForOwner } from './scope';

export type EnrichedCargoStoreParticipant = Omit<CargoStoreParticipant, 'actor'> & {
  actor: EnrichedCargoDocumentActor;
};

class StoreParticipantServiceImpl {
  private async getScope(owner: FileOwner) {
    return await resolveCargoScopeForOwner(owner);
  }

  private async enrichStoreParticipant(d: {
    owner: FileOwner;
    storeParticipant: CargoStoreParticipant;
  }): Promise<EnrichedCargoStoreParticipant> {
    let [actor] = await documentParticipantService.enrichActors({
      owner: d.owner,
      actors: [d.storeParticipant.actor]
    });

    return {
      ...d.storeParticipant,
      actor: actor!
    };
  }

  async getStoreParticipantById(d: { owner: FileOwner; storeParticipantId: string }) {
    let scope = await this.getScope(d.owner);
    let storeParticipant = await cargo.storeParticipant.get({
      tenantId: scope.tenantId,
      environmentId: scope.environmentId,
      storeParticipantId: d.storeParticipantId
    });

    return await this.enrichStoreParticipant({
      owner: d.owner,
      storeParticipant
    });
  }

  async listStoreParticipants(d: { owner: FileOwner; storeId?: string }) {
    let scope = await this.getScope(d.owner);

    return Paginator.create(() => async input => {
      let result = await cargo.storeParticipant.list({
        tenantId: scope.tenantId,
        environmentId: scope.environmentId,
        storeId: d.storeId,
        ...input
      });

      return {
        items: await Promise.all(
          result.items.map(
            async storeParticipant =>
              await this.enrichStoreParticipant({
                owner: d.owner,
                storeParticipant
              })
          )
        ),
        pagination: {
          hasNextPage: result.pagination.has_more_after,
          hasPreviousPage: result.pagination.has_more_before
        }
      };
    });
  }
}

export let storeParticipantService = Service.create(
  'fileStoreParticipant',
  () => new StoreParticipantServiceImpl()
).build();
