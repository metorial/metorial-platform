import { badRequestError, ServiceError } from '@lowerdeck/error';
import type { ConsumerProfile, Instance, Project, ResourceActor } from '@metorial/db';
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
  project: Pick<Project, 'oid'>;
  instance: Pick<Instance, 'oid'>;
  authorization: ResourceAuthorization;
};

export let getRestrictedAccessTags = (authorization: ResourceAuthorization) =>
  authorization.type == 'restricted' ? authorization.accessTags : undefined;

export let createResourceAuthorization = (d: {
  restricted: boolean;
  resourceActor?: ResourceActor;
  accessTags?: AnyAccessTagSelector;
  project?: Pick<Project, 'oid'>;
  instance?: Pick<Instance, 'oid' | 'projectOid'>;
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
    !d.project ||
    !d.instance ||
    !d.consumerProfile ||
    d.instance.projectOid != d.project.oid ||
    d.consumerProfile.instanceOid != d.instance.oid ||
    d.resourceActor.projectOid != d.project.oid ||
    d.resourceActor.consumerProfileOid != d.consumerProfile.oid
  ) {
    throw new ServiceError(
      badRequestError({
        message: 'Restricted resource authorization does not match the selected instance scope.'
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
  scope: Pick<AuthorizedResourceScope, 'project' | 'authorization'>
) => {
  let actor = scope.authorization.resourceActor;
  if (actor && actor.projectOid != scope.project.oid) {
    throw new ServiceError(
      badRequestError({
        message: 'ResourceActor does not belong to the supplied project.'
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

/**
 * The project is optional because user avatars and organization brand images are owned outside any
 * project. Actors are project-scoped, so supplying one against a project-less owner is a mismatch.
 */
export let assertResourceActorScope = (d: {
  project?: Pick<Project, 'oid'>;
  resourceActor?: Pick<ResourceActor, 'projectOid' | 'consumerOid' | 'consumerProfileOid'>;
}) => {
  if (d.resourceActor && d.resourceActor.projectOid != d.project?.oid) {
    throw new ServiceError(
      badRequestError({
        message: 'ResourceActor does not belong to the supplied project.'
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
