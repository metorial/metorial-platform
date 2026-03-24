import { forbiddenError, ServiceError } from '@lowerdeck/error';
import { Instance, Organization, OrganizationMember } from '@metorial/db';
import { accessService, Scope } from '@metorial/module-access';
import { teamService } from '@metorial/module-organization';
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
      let instance = ctx.instance as Instance & { organization: Organization };

      let isUserLinkedOAuthMachineAuth =
        ctx.auth.type == 'machine' &&
        !!ctx.auth.oauthToken &&
        ctx.auth.oauthToken.oauthAuthorization.type == 'user';

      if (
        (ctx.auth.type == 'user' || isUserLinkedOAuthMachineAuth) &&
        instance.organization.enforceTeamAccess
      ) {
        let member =
          ctx.auth.type == 'user' && 'member' in ctx && ctx.member
            ? (ctx.member as OrganizationMember)
            : ctx.auth.type == 'machine'
              ? ctx.auth.oauthToken?.oauthAuthorization.organizationMember
              : undefined;

        if (member?.role == 'admin') return;

        let user = ctx.auth.type == 'user' ? ctx.auth.user : undefined;
        let actor = ctx.auth.type == 'machine' ? ctx.auth.restrictions.actor : undefined;
        if (!user && !actor) {
          throw new ServiceError(
            forbiddenError({
              message: 'Unable to determine user or actor for access check'
            })
          );
        }

        let { scopes } = await teamService.getTeamAccessForInstance({
          instance,
          organization: instance.organization,
          for: user ? { type: 'user', user } : { type: 'actor', actor: actor! }
        });

        let allowedScopes =
          ctx.auth.type == 'machine'
            ? scopes.filter(scope => ctx.auth.orgScopes.includes(scope as any))
            : scopes;

        let hasAccess = allowedScopes.some(scope =>
          input.possibleScopes.includes(scope as any)
        );
        if (!hasAccess) {
          throw new ServiceError(
            forbiddenError({
              message: `You don't have the required team permissions to perform this action`
            })
          );
        }
      }
    }
  }
);
