import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import { managedProviderAuthCredentialsService } from '@metorial-subspace/module-auth';
import { managedProviderAuthCredentialsPresenter } from '@metorial-subspace/presenters';
import { app } from './_app';

export let managedProviderAuthCredentialsApp = app.use(async ctx => {
  let managedProviderAuthCredentialsId = ctx.body.managedProviderAuthCredentialsId;
  if (!managedProviderAuthCredentialsId) {
    throw new Error('ManagedProviderAuthCredentials ID is required');
  }

  let managedProviderAuthCredentials =
    await managedProviderAuthCredentialsService.getManagedProviderAuthCredentialsById({
      solution: ctx.solution,
      managedProviderAuthCredentialsId
    });

  return {
    managedProviderAuthCredentials
  };
});

export let managedProviderAuthCredentialsController = app.controller({
  list: app
    .handler()
    .input(
      Paginator.validate(
        v.object({
          status: v.optional(v.array(v.enumOf(['active', 'archived']))),
          ids: v.optional(v.array(v.string())),
          providerIds: v.optional(v.array(v.string()))
        })
      )
    )
    .do(async ctx => {
      let paginator =
        await managedProviderAuthCredentialsService.listManagedProviderAuthCredentials({
          solution: ctx.solution,
          status: ctx.input.status,
          ids: ctx.input.ids,
          providerIds: ctx.input.providerIds
        });

      let list = await paginator.run(ctx.input);

      return Paginator.presentLight(list, managedProviderAuthCredentialsPresenter);
    }),

  get: managedProviderAuthCredentialsApp
    .handler()
    .input(
      v.object({
        managedProviderAuthCredentialsId: v.string()
      })
    )
    .do(async ctx =>
      managedProviderAuthCredentialsPresenter(ctx.managedProviderAuthCredentials)
    ),

  create: app
    .handler()
    .input(
      v.object({
        providerId: v.string(),
        providerAuthMethodId: v.string(),
        name: v.string({
          transformers: [v.trim],
          modifiers: [v.minLength(1)]
        }),
        description: v.optional(v.string({ transformers: [v.trim] })),
        metadata: v.optional(v.record(v.any())),
        clientId: v.string({
          transformers: [v.trim],
          modifiers: [v.minLength(1)]
        }),
        clientSecret: v.string({
          transformers: [v.trim],
          modifiers: [v.minLength(1)]
        })
      })
    )
    .do(async ctx =>
      managedProviderAuthCredentialsPresenter(
        await managedProviderAuthCredentialsService.createManagedProviderAuthCredentials({
          solution: ctx.solution,
          input: {
            providerId: ctx.input.providerId,
            providerAuthMethodId: ctx.input.providerAuthMethodId,
            name: ctx.input.name,
            description: ctx.input.description,
            metadata: ctx.input.metadata,
            clientId: ctx.input.clientId,
            clientSecret: ctx.input.clientSecret
          }
        })
      )
    ),

  update: managedProviderAuthCredentialsApp
    .handler()
    .input(
      v.object({
        managedProviderAuthCredentialsId: v.string(),
        providerAuthMethodId: v.optional(v.string()),
        name: v.optional(
          v.string({
            transformers: [v.trim],
            modifiers: [v.minLength(1)]
          })
        ),
        description: v.optional(v.string({ transformers: [v.trim] })),
        metadata: v.optional(v.record(v.any())),
        clientId: v.optional(
          v.string({
            transformers: [v.trim],
            modifiers: [v.minLength(1)]
          })
        ),
        clientSecret: v.optional(
          v.string({
            transformers: [v.trim],
            modifiers: [v.minLength(1)]
          })
        )
      })
    )
    .do(async ctx =>
      managedProviderAuthCredentialsPresenter(
        await managedProviderAuthCredentialsService.updateManagedProviderAuthCredentials({
          solution: ctx.solution,
          managedProviderAuthCredentials: ctx.managedProviderAuthCredentials,
          input: {
            providerAuthMethodId: ctx.input.providerAuthMethodId,
            name: ctx.input.name,
            description: ctx.input.description,
            metadata: ctx.input.metadata,
            clientId: ctx.input.clientId,
            clientSecret: ctx.input.clientSecret
          }
        })
      )
    ),

  archive: managedProviderAuthCredentialsApp
    .handler()
    .input(
      v.object({
        managedProviderAuthCredentialsId: v.string()
      })
    )
    .do(async ctx =>
      managedProviderAuthCredentialsPresenter(
        await managedProviderAuthCredentialsService.archiveManagedProviderAuthCredentials({
          solution: ctx.solution,
          managedProviderAuthCredentials: ctx.managedProviderAuthCredentials
        })
      )
    )
});
