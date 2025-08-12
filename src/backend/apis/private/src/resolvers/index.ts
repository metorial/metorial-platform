import { flagService } from '@metorial/module-flags';
import { DFlags } from '../objects/flags';
import { DOrganization } from '../objects/organization';
import { DUser } from '../objects/user';
import { DContext } from '../utils/context';
import { wrapPrivateError } from '../utils/error';

export let resolvers = {
  Query: {
    getFlags: (_1: any, _2: {}, ctx: DContext) =>
      wrapPrivateError(async () => {
        let flags = await flagService.getFlags({
          organization: ctx.organization,
          user: ctx.auth.user
        });

        return DFlags.of({
          flags: Object.entries(flags).map(([slug, value]) => ({
            slug,
            value
          })),
          user: ctx.auth.user,
          organization: ctx.organization
        });
      }),

    getOrganization: (_1: any, _2: {}, ctx: DContext) =>
      wrapPrivateError(async () => {
        return DOrganization.fromOrg(ctx.organization);
      }),

    getUser: (_1: any, _2: {}, ctx: DContext) =>
      wrapPrivateError(async () => {
        return DUser.fromUser(ctx.auth.user);
      })
  }
};
