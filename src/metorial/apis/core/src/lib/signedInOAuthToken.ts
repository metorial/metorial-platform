import type { AuthInfo } from '@metorial/module-access';

export let getSignedInOAuthToken = (ctx: { auth: AuthInfo }) =>
  ctx.auth.type == 'machine' ? ctx.auth.oauthToken : undefined;
