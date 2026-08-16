import { forbiddenError, notFoundError, ServiceError } from '@lowerdeck/error';
import { Service } from '@lowerdeck/service';
import {
  db,
  Organization,
  OrganizationActor,
  OrganizationMember,
  Project,
  ResourceActor
} from '@metorial/db';
import {
  effectiveAccessService,
  instanceService,
  organizationService
} from '@metorial/module-organization';
import { resourceActorService } from '@metorial/module-resource-actor';
import { Scope } from '../definitions';
import { AuthInfo } from './authentication';

type TargetAccessInput = {
  authInfo: AuthInfo;
  organization?: Organization;
  member?: OrganizationMember;
  project?: Pick<Project, 'id'>;
  instance?: { id: string };
};

type TargetAccessFilter = {
  all: boolean;
  projectIds: string[];
  instanceIds: string[];
};

class AccessService {
  private async getOrganizationResourceActor(d: {
    project: Pick<Project, 'oid'>;
    actor: OrganizationActor & { resourceActors?: ResourceActor[] };
  }) {
    let includedActor = d.actor.resourceActors?.find(
      actor => actor.projectOid == d.project.oid
    );
    if (includedActor) return includedActor;

    return await resourceActorService.ensureOrganizationActor({
      project: d.project,
      organizationActorOid: d.actor.oid
    });
  }

  private async getServiceAccountForAuth(d: { authInfo: AuthInfo }) {
    if (
      d.authInfo.type != 'machine' ||
      !d.authInfo.oauthToken ||
      d.authInfo.oauthToken.oauthAuthorization.type != 'server_side'
    ) {
      return null;
    }

    let serviceAccountCredential = await db.serviceAccountCredential.findFirst({
      where: {
        oauthAuthorizationOid: d.authInfo.oauthToken.oauthAuthorization.oid
      },
      include: {
        serviceAccount: true
      }
    });

    return serviceAccountCredential?.serviceAccount ?? null;
  }

  private async getGrantedScopesForTarget(d: {
    authInfo: AuthInfo;
    organization?: Organization;
    member?: OrganizationMember;
    project?: Pick<Project, 'id'>;
    instance?: { id: string };
  }) {
    if (!d.organization) {
      return null;
    }

    if (d.authInfo.type == 'fine_grained' || d.organization.authVersion != 'v2') {
      return null;
    }

    if (d.authInfo.type == 'user') {
      if (!d.member) return null;

      let effectiveAccess = await effectiveAccessService.getMemberEffectiveAccess({
        organization: d.organization,
        member: d.member
      });

      return effectiveAccessService.getScopesForTarget({
        effectiveAccess,
        target: d.instance
          ? {
              type: 'instance',
              organization: d.organization,
              project: d.project!,
              instance: d.instance
            }
          : d.project
            ? {
                type: 'project',
                organization: d.organization,
                project: d.project
              }
            : {
                type: 'organization',
                organization: d.organization
              }
      });
    }

    if (
      d.authInfo.oauthToken?.oauthAuthorization.type == 'user' &&
      d.authInfo.oauthToken.oauthAuthorization.organizationMember
    ) {
      let effectiveAccess = await effectiveAccessService.getMemberEffectiveAccess({
        organization: d.organization,
        member: d.authInfo.oauthToken.oauthAuthorization.organizationMember
      });

      return effectiveAccessService.getScopesForTarget({
        effectiveAccess,
        target: d.instance
          ? {
              type: 'instance',
              organization: d.organization,
              project: d.project!,
              instance: d.instance
            }
          : d.project
            ? {
                type: 'project',
                organization: d.organization,
                project: d.project
              }
            : {
                type: 'organization',
                organization: d.organization
              }
      });
    }

    let serviceAccount = await this.getServiceAccountForAuth({
      authInfo: d.authInfo
    });
    if (!serviceAccount) return null;

    let effectiveAccess = await effectiveAccessService.getServiceAccountEffectiveAccess({
      organization: d.organization,
      serviceAccount
    });

    return effectiveAccessService.getScopesForTarget({
      effectiveAccess,
      target: d.instance
        ? {
            type: 'instance',
            organization: d.organization,
            project: d.project!,
            instance: d.instance
          }
        : d.project
          ? {
              type: 'project',
              organization: d.organization,
              project: d.project
            }
          : {
              type: 'organization',
              organization: d.organization
            }
    });
  }

  private async getEffectiveAccessEntries(d: TargetAccessInput) {
    if (!d.organization) {
      return null;
    }

    if (d.authInfo.type == 'fine_grained' || d.organization.authVersion != 'v2') {
      return null;
    }

    if (d.authInfo.type == 'user') {
      if (!d.member) return null;

      return (
        await effectiveAccessService.getMemberEffectiveAccess({
          organization: d.organization,
          member: d.member
        })
      ).entries;
    }

    if (
      d.authInfo.oauthToken?.oauthAuthorization.type == 'user' &&
      d.authInfo.oauthToken.oauthAuthorization.organizationMember
    ) {
      return (
        await effectiveAccessService.getMemberEffectiveAccess({
          organization: d.organization,
          member: d.authInfo.oauthToken.oauthAuthorization.organizationMember
        })
      ).entries;
    }

    let serviceAccount = await this.getServiceAccountForAuth({
      authInfo: d.authInfo
    });
    if (!serviceAccount) return null;

    return (
      await effectiveAccessService.getServiceAccountEffectiveAccess({
        organization: d.organization,
        serviceAccount
      })
    ).entries;
  }

  async canAccessTargetScopes(d: TargetAccessInput & { possibleScopes: Scope[] }) {
    let grantedScopes = await this.getGrantedScopesForTarget(d);
    if (!grantedScopes) return true;

    let allowedScopes = grantedScopes.filter(scope =>
      d.authInfo.orgScopes.includes(scope as Scope)
    );

    return allowedScopes.some(scope => d.possibleScopes.includes(scope as Scope));
  }

  async getTargetAccessFilter(d: TargetAccessInput & { possibleScopes: Scope[] }) {
    let entries = await this.getEffectiveAccessEntries(d);
    if (!entries) return null;
    if (!d.organization) return null;

    let allowedScopes = new Set(d.authInfo.orgScopes);
    let projectIds = new Set<string>();
    let instanceIds = new Set<string>();

    for (let entry of entries) {
      let entryScopes = entry.scopes.filter(scope => allowedScopes.has(scope as Scope));
      if (!entryScopes.some(scope => d.possibleScopes.includes(scope as Scope))) continue;

      if (entry.target == d.organization.id) {
        return {
          all: true,
          projectIds: [],
          instanceIds: []
        } satisfies TargetAccessFilter;
      }

      if (entry.target.startsWith('prj_')) {
        projectIds.add(entry.target);
      }

      if (entry.target.startsWith('ins_')) {
        instanceIds.add(entry.target);
      }
    }

    return {
      all: false,
      projectIds: [...projectIds],
      instanceIds: [...instanceIds]
    } satisfies TargetAccessFilter;
  }

  async checkTargetAccess(d: {
    authInfo: AuthInfo;
    organization?: Organization;
    possibleScopes: Scope[];
    member?: OrganizationMember;
    project?: Pick<Project, 'id'>;
    instance?: { id: string };
  }) {
    let grantedScopes = await this.getGrantedScopesForTarget(d);
    if (!grantedScopes) return;

    let allowedScopes = grantedScopes.filter(scope =>
      d.authInfo.orgScopes.includes(scope as Scope)
    );
    if (allowedScopes.some(scope => d.possibleScopes.includes(scope as Scope))) {
      return;
    }

    throw new ServiceError(
      forbiddenError({
        message: `You don't have the required permissions to perform this action`
      })
    );
  }

  async hasAnyTargetAccess(d: {
    authInfo: AuthInfo;
    organization?: Organization;
    member?: OrganizationMember;
    project?: Pick<Project, 'id'>;
    instance?: { id: string };
  }) {
    let grantedScopes = await this.getGrantedScopesForTarget(d);
    if (!grantedScopes) return true;

    return grantedScopes.some(scope => d.authInfo.orgScopes.includes(scope as Scope));
  }

  async checkAccess(d: {
    authInfo: AuthInfo;
    possibleScopes: Scope[];
    fineGrainedPolicy?: 'allow' | 'deny';
  }) {
    if (d.authInfo.type == 'fine_grained') {
      if ((d.fineGrainedPolicy ?? 'deny') != 'allow') {
        throw new ServiceError(
          forbiddenError({
            message: `Fine grained token is not allowed to access this endpoint`
          })
        );
      }
    }

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

    if (d.authInfo.type == 'fine_grained') {
      throw new ServiceError(
        forbiddenError({
          message: `You don't have the required permissions to perform this action`
        })
      );
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

      let hasAccess = await this.hasAnyTargetAccess({
        authInfo: d.authInfo,
        organization: res.organization,
        member: res.member,
        project: res.project,
        instance: res.instance
      });
      if (!hasAccess) {
        throw new ServiceError(notFoundError('instance', d.instanceId));
      }
      let resourceActor = await this.getOrganizationResourceActor({
        project: res.project,
        actor: res.actor
      });

      return {
        type: 'user' as const,
        instance: res.instance,
        organization: res.organization,
        actor: res.actor,
        project: res.project,
        member: res.member,
        resourceActor
      };
    }

    if (d.authInfo.type == 'fine_grained') {
      let instance = d.authInfo.restrictions.instance;
      if (d.instanceId != instance.id && d.instanceId != instance.slug) {
        throw new ServiceError(notFoundError('instance', d.instanceId));
      }

      return {
        type: 'fine_grained' as const,
        instance: {
          ...instance,
          organization: d.authInfo.restrictions.organization
        },
        organization: d.authInfo.restrictions.organization,
        project: instance.project,
        resourceActor: undefined,
        actor: undefined,
        member: undefined,
        accessTagGrants: d.authInfo.restrictions.accessTagGrants
      };
    }

    if (d.authInfo.machineAccess.type == 'organization_management') {
      if (d.authInfo.user) {
        let { instance, member } = await instanceService.getInstanceByIdForUser({
          user: d.authInfo.user,
          instanceId: d.instanceId
        });
        if (instance.organization.id !== d.authInfo.restrictions.organization.id) {
          throw new ServiceError(notFoundError('instance', d.instanceId));
        }

        let hasAccess = await this.hasAnyTargetAccess({
          authInfo: d.authInfo,
          organization: instance.organization,
          project: instance.project,
          instance
        });
        if (!hasAccess) {
          throw new ServiceError(notFoundError('instance', d.instanceId));
        }
        let resourceActor = await this.getOrganizationResourceActor({
          project: instance.project,
          actor: d.authInfo.restrictions.actor
        });

        return {
          type: 'user' as const,
          instance,
          organization: instance.organization,
          actor: d.authInfo.restrictions.actor,
          project: instance.project,
          member,
          resourceActor
        };
      }

      let instance = await instanceService.getInstanceById({
        instanceId: d.instanceId,
        organization: d.authInfo.restrictions.organization,
        actor: d.authInfo.restrictions.actor,
        member: undefined
      });

      let hasAccess = await this.hasAnyTargetAccess({
        authInfo: d.authInfo,
        organization: instance.organization,
        project: instance.project,
        instance
      });
      if (!hasAccess) {
        throw new ServiceError(notFoundError('instance', d.instanceId));
      }
      let resourceActor = await this.getOrganizationResourceActor({
        project: instance.project,
        actor: d.authInfo.restrictions.actor
      });

      return {
        type: 'user' as const,
        instance,
        organization: instance.organization,
        actor: d.authInfo.restrictions.actor,
        project: instance.project,
        member: undefined,
        resourceActor
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
        project: instance.project,
        resourceActor: d.authInfo.restrictions.resourceActor
      };
    }

    throw new ServiceError(
      forbiddenError({
        message: `You don't have the required permissions to perform this action`
      })
    );
  }
}

export let accessService = Service.create('accessService', () => new AccessService()).build();
