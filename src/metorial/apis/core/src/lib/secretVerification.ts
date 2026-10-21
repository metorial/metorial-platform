import { AuthInfo } from '@metorial/module-access';
import { SecretVerification } from '@metorial/module-machine-access';

export let getSecretVerification = (ctx: {
  auth: AuthInfo;
  headers: Record<string, string | undefined>;
}): SecretVerification => ({
  token: ctx.headers['metorial-verification-token'] ?? null,
  dashboardSession:
    ctx.auth.type == 'user' && ctx.auth.dashboardSession
      ? {
          userId: ctx.auth.user.id,
          sessionId: ctx.auth.dashboardSession.id,
          type: ctx.auth.dashboardSession.type
        }
      : null
});
