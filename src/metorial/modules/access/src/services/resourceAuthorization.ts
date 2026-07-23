import { badRequestError, ServiceError } from '@lowerdeck/error';
import type {
  ConsumerProfile,
  Instance,
  ResourceActor,
  ResourceGroup,
  ResourceTenant
} from '@metorial/db';
import type { AnyAccessTagSelector } from './accessTag';

export type RestrictedResourceActor = ResourceActor & {
  consumerProfileOid: bigint;
};

export type ResourceAuthorization =
  | {
      type: 'privileged';
      resourceActor?: ResourceActor;
    }
  | {
      type: 'restricted';
      resourceActor: RestrictedResourceActor;
      accessTags: AnyAccessTagSelector;
    };

export type AuthorizedResourceScope = {
  resourceTenant: ResourceTenant;
  resourceGroup: ResourceGroup;
  authorization: ResourceAuthorization;
};

export let getRestrictedAccessTags = (authorization: ResourceAuthorization) =>
  authorization.type == 'restricted' ? authorization.accessTags : undefined;

export let createResourceAuthorization = (d: {
  restricted: boolean;
  resourceActor?: ResourceActor;
  accessTags?: AnyAccessTagSelector;
  resourceTenant?: Pick<ResourceTenant, 'oid'>;
  resourceGroup?: Pick<ResourceGroup, 'oid' | 'resourceTenantOid'>;
  instance?: Pick<Instance, 'oid' | 'resourceTenantOid' | 'resourceGroupOid'>;
  consumerProfile?: Pick<ConsumerProfile, 'oid' | 'instanceOid'>;
}): ResourceAuthorization => {
  if (d.resourceActor?.consumerOid && !d.resourceActor.consumerProfileOid) {
    throw new ServiceError(
      badRequestError({
        message: 'Consumer resource actors must be linked to a consumer profile.'
      })
    );
  }
  if (!d.restricted) {
    return {
      type: 'privileged',
      resourceActor: d.resourceActor
    };
  }

  if (!d.resourceActor?.consumerProfileOid || !d.accessTags) {
    throw new ServiceError(
      badRequestError({
        message:
          'Restricted resource authorization requires a ConsumerProfile ResourceActor and access tags.'
      })
    );
  }
  if (
    !d.resourceTenant ||
    !d.resourceGroup ||
    !d.instance ||
    !d.consumerProfile ||
    d.resourceGroup.resourceTenantOid != d.resourceTenant.oid ||
    d.instance.resourceTenantOid != d.resourceTenant.oid ||
    d.instance.resourceGroupOid != d.resourceGroup.oid ||
    d.consumerProfile.instanceOid != d.instance.oid ||
    d.resourceActor.resourceTenantOid != d.resourceTenant.oid ||
    d.resourceActor.consumerProfileOid != d.consumerProfile.oid
  ) {
    throw new ServiceError(
      badRequestError({
        message:
          'Restricted resource authorization does not match the selected instance ResourceScope.'
      })
    );
  }

  return {
    type: 'restricted',
    resourceActor: d.resourceActor as RestrictedResourceActor,
    accessTags: d.accessTags
  };
};

export let assertResourceAuthorizationScope = (
  scope: Pick<AuthorizedResourceScope, 'resourceTenant' | 'resourceGroup' | 'authorization'>
) => {
  if (scope.resourceGroup.resourceTenantOid != scope.resourceTenant.oid) {
    throw new ServiceError(
      badRequestError({
        message: 'ResourceGroup does not belong to the supplied ResourceTenant.'
      })
    );
  }

  let actor = scope.authorization.resourceActor;
  if (actor && actor.resourceTenantOid != scope.resourceTenant.oid) {
    throw new ServiceError(
      badRequestError({
        message: 'ResourceActor does not belong to the supplied ResourceTenant.'
      })
    );
  }
  if (actor?.consumerOid && !actor.consumerProfileOid) {
    throw new ServiceError(
      badRequestError({
        message: 'Consumer resource actors must be linked to a consumer profile.'
      })
    );
  }
};

export let assertResourceActorScope = (d: {
  resourceTenant: Pick<ResourceTenant, 'oid'>;
  resourceActor?: Pick<
    ResourceActor,
    'resourceTenantOid' | 'consumerOid' | 'consumerProfileOid'
  >;
}) => {
  if (d.resourceActor && d.resourceActor.resourceTenantOid != d.resourceTenant.oid) {
    throw new ServiceError(
      badRequestError({
        message: 'ResourceActor does not belong to the supplied ResourceTenant.'
      })
    );
  }
  if (d.resourceActor?.consumerOid && !d.resourceActor.consumerProfileOid) {
    throw new ServiceError(
      badRequestError({
        message: 'Consumer resource actors must be linked to a consumer profile.'
      })
    );
  }
};
