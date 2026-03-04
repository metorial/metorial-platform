import { Instance, Organization, OrganizationMember } from '@metorial/db';
import { badRequestError, ServiceError } from '@lowerdeck/error';
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

    if (ctx.auth.type == 'user' && 'instance' in ctx && ctx.instance) {
      let instance = ctx.instance as Instance & { organization: Organization };

      if ('member' in ctx && ctx.member) {
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
                  // @ts-ignore
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
