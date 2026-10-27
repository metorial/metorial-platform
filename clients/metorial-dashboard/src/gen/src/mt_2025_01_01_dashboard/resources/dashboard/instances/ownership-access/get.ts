import { mapObject } from '@metorial/util-resource-mapper/compact';

export type DashboardInstancesOwnershipAccessGetOutput = {
  object: 'ownership_access';
  restrictedForCaller: boolean;
  ownActorIds: string[];
};

export let mapDashboardInstancesOwnershipAccessGetOutput =
  /* @__PURE__ */ mapObject<DashboardInstancesOwnershipAccessGetOutput>([
    'restricted_for_caller',
    'own_actor_ids'
  ]);
