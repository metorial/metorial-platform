import { forbiddenError, notFoundError, ServiceError } from '@metorial/error';
import { instanceService, organizationService } from '@metorial/module-organization';
import { Service } from '@metorial/service';
import { AuthInfo } from './authentication';

class AccessService {
  async checkAccess(d: {
    authInfo: AuthInfo;
    possibleScopes: MachineAccessOrganizationManagementScope[];
  }) {
    if (!d.authInfo.orgScopes.some(scope => d.possibleScopes.includes(scope))) {
      throw new ServiceError(
        forbiddenError({
          message: `You don't have the required permissions to perform this action`
        })
      );
    }
  }

  async accessOrganization(d: { authInfo: AuthInfo; organizationId: string }) {
    if (d.authInfo.type == 'user') {
      let res = await organizationService.getOrganizationByIdForUser({
        organizationId: d.organizationId,
        user: d.authInfo.user
      });

      return {
        type: 'user' as const,
        organization: res.organization,
        actor: res.actor,
        member: res.member
      };
    }

    let org = d.authInfo.restrictions.organization;
    if (d.organizationId != org.id && d.organizationId != org.slug) {
      throw new ServiceError(notFoundError('organization', d.organizationId));
    }

    return {
      type: 'actor' as const,
      organization: org,
      actor: d.authInfo.restrictions.actor,
      member: undefined
    };
  }

  async accessInstance(d: { authInfo: AuthInfo; instanceId: string }) {
    if (d.authInfo.type == 'user') {
      let res = await instanceService.getInstanceByIdForUser({
        instanceId: d.instanceId,
        user: d.authInfo.user
      });

      return {
        type: 'user' as const,
        instance: res.instance,
        organization: res.organization,
        actor: res.actor,
        project: res.project,
        member: res.member
      };
    }

    if (d.authInfo.machineAccess.type == 'organization_management') {
      let instance = await instanceService.getInstanceById({
        instanceId: d.instanceId,
        organization: d.authInfo.restrictions.organization
      });

      return {
        type: 'user' as const,
        instance,
        organization: instance.organization,
        actor: d.authInfo.restrictions.actor,
        project: instance.project
      };
    }

    if ('instance' in d.authInfo.restrictions) {
      let instance = d.authInfo.restrictions.instance;
      if (d.instanceId != instance.id && d.instanceId != instance.slug) {
        throw new ServiceError(notFoundError('instance', d.instanceId));
      }

      return {
        type: 'actor' as const,
        instance: {
          ...instance,
          organization: d.authInfo.restrictions.organization
        },
        organization: d.authInfo.restrictions.organization,
        actor: d.authInfo.restrictions.actor,
        project: instance.project
      };
    }
  }
}

export let accessService = Service.create('accessService', () => new AccessService()).build();
