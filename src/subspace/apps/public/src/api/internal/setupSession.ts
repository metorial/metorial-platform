import { v } from '@lowerdeck/validation';
import type { ProviderSetupSession } from '@metorial-subspace/db';
import { providerSetupSessionUiService } from '@metorial-subspace/module-auth';
import { integrationSetupSessionService } from '@metorial-subspace/module-integration';
import { brandService } from '@metorial-subspace/module-tenant';
import { integrationSetupSessionPresenter } from '@metorial-subspace/presenters';
import { app } from './_app';
import {
  setupSessionBrandPresenter,
  setupSessionOAuthSetupPresenter,
  setupSessionPresenter,
  setupSessionProviderListingItemPresenter,
  setupSessionSchemaPresenter,
  setupSessionSelectedProviderPresenter,
  setupSessionToolPresenter
} from './presenters';

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

let reconcileIntegrationSetupSessionChild = async (
  session: Pick<ProviderSetupSession, 'oid' | 'status'>,
  context: { ip: string; ua: string }
) => {
  if (session.status !== 'completed') return;

  await integrationSetupSessionService.reconcileProviderSetupSessionCompleted({
    providerSetupSession: session,
    context
  });
};

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
  let integrationSetupSession =
    await integrationSetupSessionService.getIntegrationSetupSessionByProviderSetupSession({
      providerSetupSession: session
    });

  return {
    provider: session.provider
      ? setupSessionSelectedProviderPresenter(session.provider)
      : null,
    session: setupSessionPresenter(session),
    brand: setupSessionBrandPresenter(brand),
    completionRedirect: integrationSetupSession
      ? {
          type: 'integration_setup_session' as const,
          url: integrationSetupSessionPresenter(integrationSetupSession).url
        }
      : null,
    isWhitelabel: session.tenant.isWhitelabel
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

      return {
        schema: setupSessionSchemaPresenter(
          'provider.setup_session.auth_config_schema',
          schema
        )
      };
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

      return {
        schema: setupSessionSchemaPresenter('provider.setup_session.config_schema', schema)
      };
    }),

  setConfig: sessionApp
    .handler()
    .input(
      v.object({
        sessionId: v.string(),
        clientSecret: v.string(),

        configInput: v.record(v.any()),
        toolFilters: v.optional(v.any())
      })
    )
    .do(async ctx => {
      let session = await providerSetupSessionUiService.setConfig({
        providerSetupSession: ctx.session,
        input: {
          configInput: ctx.input.configInput,
          toolFilters: ctx.input.toolFilters as any
        },
        context: ctx.context
      });

      await reconcileIntegrationSetupSessionChild(session, ctx.context);
    }),

  setAuthConfig: sessionApp
    .handler()
    .input(
      v.object({
        sessionId: v.string(),
        clientSecret: v.string(),

        authConfigInput: v.record(v.any()),
        toolFilters: v.optional(v.any())
      })
    )
    .do(async ctx => {
      let session = await providerSetupSessionUiService.setAuthConfig({
        providerSetupSession: ctx.session,
        input: {
          authConfigInput: ctx.input.authConfigInput,
          toolFilters: ctx.input.toolFilters as any
        },
        context: ctx.context
      });

      await reconcileIntegrationSetupSessionChild(session, ctx.context);
    }),

  listProviders: sessionApp
    .handler()
    .input(
      v.object({
        sessionId: v.string(),
        clientSecret: v.string(),
        search: v.optional(v.string()),
        after: v.optional(v.string()),
        before: v.optional(v.string()),
        limit: v.optional(v.number())
      })
    )
    .do(async ctx => {
      let providers = await providerSetupSessionUiService.listProviders({
        providerSetupSession: ctx.session,
        search: ctx.input.search,
        after: ctx.input.after,
        before: ctx.input.before,
        limit: ctx.input.limit
      });

      return {
        items: providers.items.map(provider =>
          setupSessionProviderListingItemPresenter(provider)
        ),
        pagination: {
          hasMoreBefore: providers.pagination.hasPreviousPage,
          hasMoreAfter: providers.pagination.hasNextPage
        }
      };
    }),

  selectProvider: sessionApp
    .handler()
    .input(
      v.object({
        sessionId: v.string(),
        clientSecret: v.string(),
        providerId: v.string()
      })
    )
    .do(async ctx => {
      let session = await providerSetupSessionUiService.selectProvider({
        providerSetupSession: ctx.session,
        providerId: ctx.input.providerId
      });

      await reconcileIntegrationSetupSessionChild(session, ctx.context);

      return await getFullSession(
        {
          sessionId: session.id,
          clientSecret: ctx.input.clientSecret
        },
        session
      );
    }),

  listTools: sessionApp
    .handler()
    .input(
      v.object({
        sessionId: v.string(),
        clientSecret: v.string()
      })
    )
    .do(async ctx => {
      return {
        items: (
          await providerSetupSessionUiService.listTools({
            providerSetupSession: ctx.session
          })
        ).map(tool => setupSessionToolPresenter(tool))
      };
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

      return setupSessionOAuthSetupPresenter(oauthSetup);
    })
});
