import { Paginator } from '@mtsrc/pagination';
import { Service } from '@mtsrc/service';
import { cargo, type CargoStoreParticipant } from '../cargo';
import { resolveCargoAccess, type CargoAccessActor } from './access';
import {
  documentParticipantService,
  type EnrichedCargoDocumentActor
} from './documentParticipant';
import type { FileOwner } from './file';

export type EnrichedCargoStoreParticipant = Omit<CargoStoreParticipant, 'actor'> & {
  actor: EnrichedCargoDocumentActor;
};

class StoreParticipantServiceImpl {
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

  async getStoreParticipantById(d: {
    owner: FileOwner;
    storeParticipantId: string;
    accessActor?: CargoAccessActor;
  }) {
    let { scope } = await resolveCargoAccess(d);
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

  async listStoreParticipants(d: {
    owner: FileOwner;
    storeId?: string;
    accessActor?: CargoAccessActor;
  }) {
    let { scope } = await resolveCargoAccess(d);

    return Paginator.create(() => async input => {
      let result = await cargo.storeParticipant.list({
        tenantId: scope.tenantId,
        environmentId: scope.environmentId,
        storeIds: d.storeId ? [d.storeId] : undefined,
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
