import { Instance, Organization, OrganizationMember, Project } from '@metorial/db';
import { accessService, Scope } from '@metorial/module-access';
import { apiGroup } from './apiGroup';

export let checkAccess = apiGroup.createMiddleware(
  async (
    ctx,
    input: {
      possibleScopes: Scope[];
      fineGrainedPolicy?: 'allow' | 'deny';
    }
  ) => {
    await accessService.checkAccess({
      authInfo: ctx.auth,
      possibleScopes: input.possibleScopes,
      fineGrainedPolicy: input.fineGrainedPolicy
    });

    if ('instance' in ctx && ctx.instance) {
      let instance = ctx.instance as Instance & {
        organization: Organization;
        project: Project;
      };

      await accessService.checkTargetAccess({
        authInfo: ctx.auth,
        organization: instance.organization,
        member: 'member' in ctx && ctx.member ? (ctx.member as OrganizationMember) : undefined,
        project: instance.project,
        instance,
        possibleScopes: input.possibleScopes
      });
    } else if ('project' in ctx && ctx.project) {
      let project = ctx.project as Project & { organization: Organization };

      await accessService.checkTargetAccess({
        authInfo: ctx.auth,
        organization: project.organization,
        member: 'member' in ctx && ctx.member ? (ctx.member as OrganizationMember) : undefined,
        project,
        possibleScopes: input.possibleScopes
      });
    } else if (
      'organization' in ctx &&
      ctx.organization &&
      input.possibleScopes.every(
        scope =>
          !scope.startsWith('organization.project:') &&
          !scope.startsWith('organization.instance:') &&
          !scope.startsWith('instance.') &&
          !scope.startsWith('consumer#')
      )
    ) {
      await accessService.checkTargetAccess({
        authInfo: ctx.auth,
        organization: ctx.organization as Organization,
        member: 'member' in ctx && ctx.member ? (ctx.member as OrganizationMember) : undefined,
        possibleScopes: input.possibleScopes
      });
    }
  }
);
