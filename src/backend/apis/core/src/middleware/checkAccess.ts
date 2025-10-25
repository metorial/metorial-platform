import { Instance, Organization, OrganizationMember } from '@metorial/db';
import { badRequestError, ServiceError } from '@metorial/error';
import { accessService, Scope } from '@metorial/module-access';
import { teamService } from '@metorial/module-organization';
import { apiGroup } from './apiGroup';

export let checkAccess = apiGroup.createMiddleware(
  async (
    ctx,
    input: {
      possibleScopes: Scope[];
    }
  ) => {
    await accessService.checkAccess({
      authInfo: ctx.auth,
      possibleScopes: input.possibleScopes
    });

    if ('instance' in ctx) {
      let instance = ctx.instance as Instance & { organization: Organization };

      if ('member' in ctx) {
        let member = ctx.member as OrganizationMember;
        if (member.role == 'admin') return;
      }

      if (instance.organization.enforceTeamAccess) {
        let { scopes } = await teamService.getTeamAccessForInstance({
          instance,
          organization: instance.organization,
          for:
            ctx.auth.type == 'user'
              ? {
                  type: 'user',
                  user: ctx.auth.user
                }
              : {
                  type: 'actor',
                  actor: ctx.auth.restrictions.actor
                }
        });

        let hasAccess = scopes.some(scope => input.possibleScopes.includes(scope as any));
        if (!hasAccess) {
          throw new ServiceError(
            badRequestError({
              message: `You don't have the required team permissions to perform this action`
            })
          );
        }
      }
    }
  }
);
