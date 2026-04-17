import { v } from '@lowerdeck/validation';
import { providerSetupSessionUiService } from '@metorial-subspace/module-auth';
import { brandService } from '@metorial-subspace/module-tenant';
import {
  brandPresenter,
  getImageUrl,
  providerOAuthSetupPresenter,
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
    provider: session.provider
      ? {
          id: session.provider.id,
          name: session.provider.name,
          description: session.provider.description,
          slug: session.provider.slug,
          imageUrl: session.provider.listing
            ? getImageUrl(session.provider.listing)
            : getImageUrl({
                id: session.provider.id,
                name: session.provider.name,
                image: null
              })
        }
      : null,
    session: providerSetupSessionPresenter(session),
    brand: brandPresenter(brand),
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

        configInput: v.record(v.any()),
        toolFilters: v.optional(v.any())
      })
    )
    .do(async ctx => {
      await providerSetupSessionUiService.setConfig({
        providerSetupSession: ctx.session,
        input: {
          configInput: ctx.input.configInput,
          toolFilters: ctx.input.toolFilters as any
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

        authConfigInput: v.record(v.any()),
        toolFilters: v.optional(v.any())
      })
    )
    .do(async ctx => {
      await providerSetupSessionUiService.setAuthConfig({
        providerSetupSession: ctx.session,
        input: {
          authConfigInput: ctx.input.authConfigInput,
          toolFilters: ctx.input.toolFilters as any
        },
        context: ctx.context
      });
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
        items: providers.items.map(provider => ({
          ...provider,
          id: provider.listingId,
          providerId: provider.id,
          imageUrl: provider.image
            ? getImageUrl({
                id: provider.listingId,
                name: provider.name,
                image: provider.image as any
              })
            : getImageUrl({
                id: provider.listingId,
                name: provider.name,
                image: null
              })
        })),
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
        items: await providerSetupSessionUiService.listTools({
          providerSetupSession: ctx.session
        })
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

      return providerOAuthSetupPresenter(oauthSetup);
    })
});
