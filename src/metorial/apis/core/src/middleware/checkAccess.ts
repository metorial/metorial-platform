import { ServiceError } from '@lowerdeck/error';
import { Instance, Organization, OrganizationMember, Project } from '@metorial/db';
import { accessService, type AuthInfo, Scope } from '@metorial/module-access';
import { apiGroup } from './apiGroup';

type AccessInput = {
  possibleScopes: Scope[];
  fineGrainedPolicy?: 'allow' | 'deny';
};

let getAccessMember = (ctx: object) => {
  if ('member' in ctx && ctx.member) return ctx.member as OrganizationMember;
  if ('accessMember' in ctx && ctx.accessMember) return ctx.accessMember as OrganizationMember;
  return undefined;
};

let assertAccess = async (ctx: { auth: AuthInfo }, input: AccessInput) => {
  await accessService.checkAccess({
    authInfo: ctx.auth,
    possibleScopes: input.possibleScopes,
    fineGrainedPolicy: input.fineGrainedPolicy
  });

  let member = getAccessMember(ctx);

  if ('instance' in ctx && ctx.instance) {
    let instance = ctx.instance as Instance & {
      organization: Organization;
      project: Project;
    };

    await accessService.checkTargetAccess({
      authInfo: ctx.auth,
      organization: instance.organization,
      member,
      project: instance.project,
      instance,
      possibleScopes: input.possibleScopes
    });
  } else if ('project' in ctx && ctx.project) {
    let project = ctx.project as Project & { organization: Organization };

    await accessService.checkTargetAccess({
      authInfo: ctx.auth,
      organization: project.organization,
      member,
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
      member,
      possibleScopes: input.possibleScopes
    });
  }
};

export let checkAccess = apiGroup.createMiddleware(async (ctx, input: AccessInput) => {
  await assertAccess(ctx, input);
});

export let hasAccess = async (ctx: { auth: AuthInfo }, input: AccessInput) => {
  try {
    await assertAccess(ctx, input);
    return true;
  } catch (error) {
    if (error instanceof ServiceError) return false;
    throw error;
  }
};
