import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import { slatePresenter, slateVersionPresenter } from '../../../presenters';
import { slateService, slateVersionService, userService } from '../../../services';
import { app } from './_app';
import { tenantApp } from './tenant';

export let slateApp = tenantApp.use(async ctx => {
  let slateId = ctx.body.slateId;
  if (!slateId) throw new Error('Slate ID is required');

  let slate = await slateService.getSlateById({
    id: slateId,
    tenant: ctx.tenant
  });

  return { slate };
});

export let slateController = app.controller({
  list: tenantApp
    .handler()
    .input(
      Paginator.validate(
        v.object({
          tenantId: v.string(),
          search: v.optional(v.string())
        })
      )
    )
    .do(async ctx => {
      let paginator = await slateService.listSlates({
        tenant: ctx.tenant,
        search: ctx.input.search
      });

      let list = await paginator.run(ctx.input);

      return Paginator.presentLight(list, slatePresenter);
    }),

  get: slateApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        slateId: v.string()
      })
    )
    .do(async ctx => slatePresenter(ctx.slate)),

  updateSlate: slateApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        slateId: v.string(),

        name: v.optional(v.string()),
        description: v.optional(v.string()),

        logoUrl: v.optional(
          v.string({
            modifiers: [
              v.url({
                hostnames: ['logos.metorial-cdn.com', 'provider-logos.metorial-cdn.com']
              })
            ]
          })
        ),
        skills: v.optional(v.array(v.string()))
      })
    )
    .do(async ctx => {
      let slate = await slateService.updateSlate({
        slate: ctx.slate,
        input: {
          logoUrl: ctx.input.logoUrl,
          skills: ctx.input.skills,
          name: ctx.input.name,
          description: ctx.input.description
        }
      });

      return slatePresenter(slate);
    }),

  version: app.controller({
    list: slateApp
      .handler()
      .input(
        Paginator.validate(
          v.object({
            slateId: v.string(),
            tenantId: v.string()
          })
        )
      )
      .do(async ctx => {
        let paginator = await slateVersionService.listSlateVersions({
          slate: ctx.slate
        });

        let list = await paginator.run(ctx.input);

        return Paginator.presentLight(list, slateVersionPresenter);
      }),

    create: tenantApp
      .handler()
      .input(
        v.object({
          tenantId: v.string(),

          scopeIdentifier: v.optional(v.string()),
          slateIdentifier: v.optional(v.string()),

          contentBase64: v.any(),
          access: v.enumOf(['public', 'private'])
        })
      )
      .do(async ctx => {
        let user = await userService.ensureUserByIdentifier({
          identifier: `admin_${ctx.tenant.id}`,
          name: `Admin for Tenant ${ctx.tenant.id}`,
          tenant: ctx.tenant
        });

        let slate = await slateVersionService.publishSlateVersion({
          user,
          input: {
            identifier:
              ctx.input.slateIdentifier && ctx.input.scopeIdentifier
                ? {
                    scopeIdentifier: ctx.input.scopeIdentifier,
                    slateIdentifier: ctx.input.slateIdentifier
                  }
                : null,

            access: ctx.input.access,
            contentBase64: ctx.input.contentBase64
          }
        });
        return slateVersionPresenter(slate);
      }),

    get: slateApp
      .handler()
      .input(
        v.object({
          tenantId: v.string(),
          slateId: v.string()
        })
      )
      .do(async _ctx => {})
  })
});
