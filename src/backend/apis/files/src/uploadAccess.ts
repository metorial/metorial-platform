import { badRequestError, ServiceError } from '@lowerdeck/error';
import { accessService, type AuthInfo } from '@metorial/module-access';
import { organizationService } from '@metorial/module-organization';
import {
  getInstanceCargoAccess,
  type InstanceCargoAccessContext
} from '../../../modules/file/src/instanceAccess';
import type { FileOwner } from '../../../modules/file/src/services/file';

let uploadScopes = ['instance.file:write'] as const;

type ResolvedUploadTarget = {
  owner: FileOwner;
  cargoAccess?: ReturnType<typeof getInstanceCargoAccess>;
  isInstanceOwner: boolean;
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
    await accessService.checkAccess({
      authInfo: d.auth,
      possibleScopes: [...uploadScopes]
    });

    let instanceAccess = await accessService.accessInstance({
      authInfo: d.auth,
      instanceId
    });

    let cargoAccessContext = {
      ...instanceAccess,
      consumerProfile:
        d.auth.type == 'machine' && d.auth.restrictions.type == 'instance'
          ? d.auth.restrictions.consumer?.consumerProfile
          : undefined
    } satisfies InstanceCargoAccessContext;

    await accessService.checkTargetAccess({
      authInfo: d.auth,
      organization: instanceAccess.organization,
      member: 'member' in instanceAccess ? instanceAccess.member : undefined,
      project: instanceAccess.project,
      instance: instanceAccess.instance,
      possibleScopes: [...uploadScopes]
    });

    return {
      owner: {
        type: 'instance',
        organization: instanceAccess.organization,
        instance: instanceAccess.instance
      },
      cargoAccess: getInstanceCargoAccess(cargoAccessContext),
      isInstanceOwner: true
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
      isInstanceOwner: false
    };
  }

  return {
    owner: {
      type: 'user',
      user: d.auth.user
    },
    isInstanceOwner: false
  };
};
