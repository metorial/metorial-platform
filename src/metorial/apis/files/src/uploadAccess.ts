import { badRequestError, ServiceError } from '@lowerdeck/error';
import {
  getInstanceCargoAccess,
  type InstanceCargoAccessContext,
  type ScopeOwner
} from '@metorial/cargo-module-file';
import { accessService, type AuthInfo, type Scope } from '@metorial/module-access';
import { organizationService } from '@metorial/module-organization';

let uploadScopes = ['instance.file:write', 'consumer#instance.file:write'] as const;

type ResolvedUploadTarget = {
  owner: ScopeOwner;
  cargoAccess?: ReturnType<typeof getInstanceCargoAccess>;
  isInstanceOwner: boolean;
  canWrite: boolean;
};

let getRestrictedInstanceId = (auth: AuthInfo) => {
  if ('restrictions' in auth && auth.restrictions.type == 'instance') {
    return auth.restrictions.instance.id;
  }

  return null;
};

export let resolveUploadTarget = async (d: {
  auth: AuthInfo;
  instanceId?: string | null;
  organizationId?: string | null;
  possibleScopes?: Scope[];
  writeScopes?: Scope[];
}): Promise<ResolvedUploadTarget> => {
  if (d.auth.type === 'fine_grained') {
    throw new ServiceError(
      badRequestError({
        message: 'Fine-grained API keys are not allowed to upload files'
      })
    );
  }

  let instanceId = d.instanceId ?? getRestrictedInstanceId(d.auth);

  if (instanceId) {
    let possibleScopes = d.possibleScopes ?? [...uploadScopes];
    let writeScopes = d.writeScopes ?? [...uploadScopes];

    await accessService.checkAccess({
      authInfo: d.auth,
      possibleScopes
    });

    let instanceAccess = await accessService.accessInstance({
      authInfo: d.auth,
      instanceId
    });

    let consumer =
      d.auth.type == 'machine' && d.auth.restrictions.type == 'instance'
        ? d.auth.restrictions.consumer
        : undefined;
    let cargoAccessContext = {
      ...instanceAccess,
      consumerProfile: consumer?.consumerProfile,
      accessTags: consumer?.accessTags
    } satisfies InstanceCargoAccessContext;

    await accessService.checkTargetAccess({
      authInfo: d.auth,
      organization: instanceAccess.organization,
      member: 'member' in instanceAccess ? instanceAccess.member : undefined,
      project: instanceAccess.project,
      instance: instanceAccess.instance,
      possibleScopes
    });

    let canWrite =
      d.auth.orgScopes.some(scope => writeScopes.includes(scope)) &&
      (await accessService.canAccessTargetScopes({
        authInfo: d.auth,
        organization: instanceAccess.organization,
        member: 'member' in instanceAccess ? instanceAccess.member : undefined,
        project: instanceAccess.project,
        instance: instanceAccess.instance,
        possibleScopes: writeScopes
      }));

    return {
      owner: {
        type: 'instance',
        instance: instanceAccess.instance
      },
      cargoAccess: getInstanceCargoAccess(cargoAccessContext),
      isInstanceOwner: true,
      canWrite
    };
  }

  if (d.auth.type == 'machine') {
    throw new ServiceError(
      badRequestError({
        message: 'Missing instance_id for machine API key'
      })
    );
  }

  if (d.organizationId) {
    let organization = await organizationService.getOrganizationByIdForUser({
      organizationId: d.organizationId,
      user: d.auth.user
    });

    return {
      owner: {
        type: 'organization',
        organization: organization.organization
      },
      isInstanceOwner: false,
      canWrite: false
    };
  }

  return {
    owner: {
      type: 'user',
      user: d.auth.user
    },
    isInstanceOwner: false,
    canWrite: false
  };
};
