import { v } from '@lowerdeck/validation';
import { integrationSetupSessionService } from '@metorial-subspace/module-integration';
import { brandService } from '@metorial-subspace/module-tenant';
import { integrationSetupSessionPresenter } from '@metorial-subspace/presenters';
import { app } from './_app';
import { setupSessionBrandPresenter } from './presenters';

let integrationSetupSessionApp = app.use(async ctx => {
  let sessionId = ctx.body.sessionId;
  let clientSecret = ctx.body.clientSecret;
  if (!sessionId || !clientSecret) {
    throw new Error('Missing sessionId or clientSecret');
  }

  let session = await integrationSetupSessionService.getIntegrationSetupSessionByClientSecret({
    sessionId,
    clientSecret
  });

  return { session };
});

export let getFullIntegrationSetupSession = async (
  input: {
    sessionId: string;
    clientSecret: string;
  },
  inputSession?: Awaited<
    ReturnType<typeof integrationSetupSessionService.getIntegrationSetupSessionByClientSecret>
  >
) => {
  let session =
    inputSession ??
    (await integrationSetupSessionService.getIntegrationSetupSessionByClientSecret({
      sessionId: input.sessionId,
      clientSecret: input.clientSecret
    }));

  let brand =
    session.brand ?? (await brandService.getBrandForTenant({ tenantId: session.tenant.id }));

  return {
    session: integrationSetupSessionPresenter(session),
    brand: setupSessionBrandPresenter(brand),
    isWhitelabel: session.tenant.isWhitelabel
  };
};

export let integrationSetupSessionController = app.controller({
  get: integrationSetupSessionApp
    .handler()
    .input(
      v.object({
        sessionId: v.string(),
        clientSecret: v.string()
      })
    )
    .do(
      async ctx =>
        await getFullIntegrationSetupSession(
          {
            sessionId: ctx.input.sessionId,
            clientSecret: ctx.input.clientSecret
          },
          ctx.session
        )
    ),

  startStep: integrationSetupSessionApp
    .handler()
    .input(
      v.object({
        sessionId: v.string(),
        clientSecret: v.string(),
        stepId: v.string()
      })
    )
    .do(async ctx => {
      let session = await integrationSetupSessionService.startIntegrationSetupSessionStep({
        integrationSetupSession: ctx.session,
        stepId: ctx.input.stepId,
        context: ctx.context
      });

      return await getFullIntegrationSetupSession(
        {
          sessionId: ctx.input.sessionId,
          clientSecret: ctx.input.clientSecret
        },
        session
      );
    })
});
