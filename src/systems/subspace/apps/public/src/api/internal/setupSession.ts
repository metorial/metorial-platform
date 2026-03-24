import { v } from '@lowerdeck/validation';
import { providerSetupSessionUiService } from '@metorial-subspace/module-auth';
import { brandService } from '@metorial-subspace/module-tenant';
import {
  brandPresenter,
  providerOAuthSetupPresenter,
  providerPreviewPresenter,
  providerSetupSessionPresenter
} from '@metorial-subspace/presenters';
import { app } from './_app';

let sessionApp = app.use(async ctx => {
  let sessionId = ctx.body.sessionId;
  let clientSecret = ctx.body.clientSecret;
  if (!sessionId || !clientSecret) {
    throw new Error('Missing sessionId or clientSecret');
  }

  let session = await providerSetupSessionUiService.getProviderSetupSessionByClientSecret({
    sessionId,
    clientSecret
  });

  return { session };
});

export let getFullSession = async (
  input: {
    sessionId: string;
    clientSecret: string;
  },
  inputSession?: Awaited<
    ReturnType<typeof providerSetupSessionUiService.getProviderSetupSessionByClientSecret>
  >
) => {
  let session =
    inputSession ??
    (await providerSetupSessionUiService.getProviderSetupSessionByClientSecret({
      sessionId: input.sessionId,
      clientSecret: input.clientSecret
    }));

  let brand =
    session.brand ?? (await brandService.getBrandForTenant({ tenantId: session.tenant.id }));

  return {
    provider: providerPreviewPresenter(session.provider),
    session: providerSetupSessionPresenter(session),
    brand: brandPresenter(brand)
  };
};

export let setupSessionController = app.controller({
  get: sessionApp
    .handler()
    .input(
      v.object({
        sessionId: v.string(),
        clientSecret: v.string()
      })
    )
    .do(
      async ctx =>
        await getFullSession(
          {
            sessionId: ctx.input.sessionId,
            clientSecret: ctx.input.clientSecret
          },
          ctx.session
        )
    ),

  getAuthConfigSchema: sessionApp
    .handler()
    .input(
      v.object({
        sessionId: v.string(),
        clientSecret: v.string()
      })
    )
    .do(async ctx => {
      let schema = await providerSetupSessionUiService.getAuthConfigSchema({
        providerSetupSession: ctx.session
      });

      return { schema };
    }),

  getConfigSchema: sessionApp
    .handler()
    .input(
      v.object({
        sessionId: v.string(),
        clientSecret: v.string()
      })
    )
    .do(async ctx => {
      let schema = await providerSetupSessionUiService.getConfigSchema({
        providerSetupSession: ctx.session
      });

      return { schema };
    }),

  setConfig: sessionApp
    .handler()
    .input(
      v.object({
        sessionId: v.string(),
        clientSecret: v.string(),

        configInput: v.record(v.any())
      })
    )
    .do(async ctx => {
      await providerSetupSessionUiService.setConfig({
        providerSetupSession: ctx.session,
        input: {
          configInput: ctx.input.configInput
        },
        context: ctx.context
      });
    }),

  setAuthConfig: sessionApp
    .handler()
    .input(
      v.object({
        sessionId: v.string(),
        clientSecret: v.string(),

        authConfigInput: v.record(v.any())
      })
    )
    .do(async ctx => {
      await providerSetupSessionUiService.setAuthConfig({
        providerSetupSession: ctx.session,
        input: {
          authConfigInput: ctx.input.authConfigInput
        },
        context: ctx.context
      });
    }),

  getOauthSetup: sessionApp
    .handler()
    .input(
      v.object({
        sessionId: v.string(),
        clientSecret: v.string()
      })
    )
    .do(async ctx => {
      let oauthSetup = await providerSetupSessionUiService.getOAuthSetup({
        providerSetupSession: ctx.session
      });
      if (!oauthSetup) return null;

      return providerOAuthSetupPresenter(oauthSetup);
    })
});
