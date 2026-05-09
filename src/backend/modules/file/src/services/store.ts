import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import { cargo, type CargoStore } from '../cargo';
import type { FileOwner } from './file';
import { resolveCargoScopeForOwner } from './scope';

export type CargoStoreMemberActor = {
  organizationActorId: string;
  name: string;
  consumerProfileId?: string;
};

export type CargoStoreItemOperation = {
  type?: 'add' | 'modify' | 'remove';
  itemId?: string;
  fileId?: string;
  documentId?: string;
  path?: string;
};

let getCargoMemberActorIdentifier = (organizationActorId: string) =>
  `organization_actor:${organizationActorId}`;

class StoreServiceImpl {
  private async getScope(owner: FileOwner) {
    return await resolveCargoScopeForOwner(owner);
  }

  private async getScopeAndActorId(d: {
    owner: FileOwner;
    performedByMember?: CargoStoreMemberActor;
  }) {
    let scope = await this.getScope(d.owner);
    if (!d.performedByMember) {
      return {
        scope,
        actorId: undefined
      };
    }

    let actor = await cargo.actor.upsert({
      tenantId: scope.tenantId,
      identifier: getCargoMemberActorIdentifier(d.performedByMember.organizationActorId),
      name: d.performedByMember.name,
      organizationActorId: d.performedByMember.organizationActorId,
      consumerProfileId: d.performedByMember.consumerProfileId
    });

    return {
      scope,
      actorId: actor.id
    };
  }

  async createStore(d: {
    owner: FileOwner;
    input: {
      id?: string;
      name: string;
    };
  }) {
    let scope = await this.getScope(d.owner);

    return await cargo.store.create({
      tenantId: scope.tenantId,
      environmentId: scope.environmentId,
      storeId: d.input.id,
      name: d.input.name
    });
  }

  async listStores(d: { owner: FileOwner }) {
    let scope = await this.getScope(d.owner);

    return Paginator.create(() => async input => {
      let result = await cargo.store.list({
        tenantId: scope.tenantId,
        environmentId: scope.environmentId,
        ...input
      });

      return {
        items: result.items,
        pagination: {
          hasNextPage: result.pagination.has_more_after,
          hasPreviousPage: result.pagination.has_more_before
        }
      };
    });
  }

  async getStoreById(d: { owner: FileOwner; storeId: string }) {
    let scope = await this.getScope(d.owner);

    return await cargo.store.get({
      tenantId: scope.tenantId,
      environmentId: scope.environmentId,
      storeId: d.storeId
    });
  }

  async updateStore(d: {
    owner: FileOwner;
    store: CargoStore;
    input: {
      name?: string;
    };
  }) {
    let scope = await this.getScope(d.owner);

    return await cargo.store.update({
      tenantId: scope.tenantId,
      environmentId: scope.environmentId,
      storeId: d.store.id,
      name: d.input.name
    });
  }

  async deleteStore(d: { owner: FileOwner; store: CargoStore }) {
    let scope = await this.getScope(d.owner);

    return await cargo.store.delete({
      tenantId: scope.tenantId,
      environmentId: scope.environmentId,
      storeId: d.store.id
    });
  }

  async modifyStoreItems(d: {
    owner: FileOwner;
    store: CargoStore;
    performedByMember?: CargoStoreMemberActor;
    operations: CargoStoreItemOperation[];
  }) {
    let { scope, actorId } = await this.getScopeAndActorId(d);

    return await cargo.store.modifyItems({
      tenantId: scope.tenantId,
      environmentId: scope.environmentId,
      storeId: d.store.id,
      operations: d.operations as any,
      actorId
    });
  }
}

export let storeService = Service.create('fileStore', () => new StoreServiceImpl()).build();
