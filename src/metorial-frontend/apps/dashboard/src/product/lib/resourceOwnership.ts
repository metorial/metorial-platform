import { useCurrentInstance, useOwnershipAccess } from '@metorial/state';

export type ResourceOwnerActor = {
  id: string;
  type: 'person' | 'agent' | 'consumer';
  name: string | null;
  imageUrl: string | null;
  consumerId: string | null;
  consumerProfileId: string | null;
  portalId: string | null;
};

export type OwnedResource = {
  ownerActor?: ResourceOwnerActor | null;
  isOwnerLocked?: boolean;
  isOwnerOnlyVisible?: boolean;
};

export let useResourceOwnershipAccess = (resource: OwnedResource | null | undefined) => {
  let instance = useCurrentInstance();
  let access = useOwnershipAccess(instance.data?.id);

  let owner = resource?.ownerActor;
  let isConsumerOwned = owner?.type === 'consumer';
  let isOwn = !!owner && !!access.data?.ownActorIds.includes(owner.id);

  let canUse =
    !resource || !isConsumerOwned || isOwn
      ? true
      : resource.isOwnerLocked
        ? false
        : !access.data?.restrictedForCaller;

  return {
    canUse,
    isOwn,
    isConsumerOwned,
    isLoading: isConsumerOwned && !access.data && !access.error
  };
};
