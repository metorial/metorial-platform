import { flagService } from '@metorial/module-flags';
import { instanceService } from '@metorial/module-organization';
import {
  providerOauthConnectionService,
  providerOauthTicketService
} from '@metorial/module-provider-oauth';
import { DFlags } from '../objects/flags';
import { DOrganization } from '../objects/organization';
import { DProviderOauthConnection } from '../objects/providerOauthConnection';
import { DUser } from '../objects/user';
import { DContext } from '../utils/context';
import { wrapGQL } from '../utils/wrap';

export let resolvers = {
  Query: {
    getFlags: (_1: any, _2: {}, ctx: DContext) =>
      wrapGQL(ctx, async () => {
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
      wrapGQL(ctx, async () => {
        return DOrganization.fromOrg(ctx.organization);
      }),

    getUser: (_1: any, _2: {}, ctx: DContext) =>
      wrapGQL(ctx, async () => {
        return DUser.fromUser(ctx.auth.user);
      }),

    getProviderOauthConnectionTestSession: async (
      _1: any,
      {
        connectionId,
        instanceId,
        redirectUri
      }: { connectionId: string; instanceId: string; redirectUri: string },
      ctx: DContext
    ) =>
      wrapPrivateError(async () => {
        let instance = await instanceService.getInstanceById({
          organization: ctx.organization,
          instanceId
        });

        let connection = await providerOauthConnectionService.getConnectionById({
          connectionId,
          instance
        });

        let testUrl = await providerOauthTicketService.getAuthenticationUrl({
          instance,
          connection,
          redirectUri
        });

        return {
          connection: await DProviderOauthConnection.fromConnection(connection),
          testUrl
        };
      })
  }
};
