import type { DashboardInstanceProviderDeploymentsConfigsGetOutput } from '@metorial/dashboard-sdk';
import {
  useBoot,
  useCurrentInstance,
  useCurrentOrganization,
  useOwnershipAccess
} from '@metorial/state';

export type ResourceAccess = DashboardInstanceProviderDeploymentsConfigsGetOutput['access'];

export type ResourceOwnerActor = NonNullable<ResourceAccess['owner']>;

export type OwnedResource = { access?: ResourceAccess };

export let getResourceOwnershipAccess = (
  resource: OwnedResource | null | undefined,
  caller: {
    organizationMemberId?: string;
    consumerIds: string[];
    restrictedForCaller: boolean;
  }
) => {
  let owner = resource?.access?.owner;
  let isConsumerOwned = owner?.type === 'consumer' || owner?.type === 'organization_member';
  let isOwn =
    !!owner &&
    ((!!owner.organizationMember &&
      owner.organizationMember.id === caller.organizationMemberId) ||
      (!caller.organizationMemberId &&
        !!owner.consumer &&
        caller.consumerIds.includes(owner.consumer.id)));

  let canUse =
    !isConsumerOwned ||
    isOwn ||
    (resource?.access?.type !== 'owner_locked' && !caller.restrictedForCaller);

  return { canUse, isOwn, isConsumerOwned };
};

export let useResourceOwnershipAccess = (resource: OwnedResource | null | undefined) => {
  let instance = useCurrentInstance();
  let organization = useCurrentOrganization();
  let boot = useBoot();
  let access = useOwnershipAccess(instance.data?.id);

  let result = getResourceOwnershipAccess(resource, {
    organizationMemberId: organization.data?.member?.id,
    consumerIds: boot.data?.consumers.map(consumer => consumer.id) ?? [],
    restrictedForCaller: access.data?.restrictedForCaller ?? false
  });

  return {
    ...result,
    canUse:
      result.canUse &&
      (!result.isConsumerOwned ||
        (!!access.data && !access.error && !!boot.data && !boot.error)),
    isLoading:
      result.isConsumerOwned &&
      ((!access.data && !access.error) || (!boot.data && !boot.error))
  };
};
