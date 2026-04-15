import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import { getPreferredCurrentSlateVersion } from '../../../lib/slateVersion/current';
import { slatePresenter, slateVersionPresenter } from '../../../presenters';
import { slateService, slateVersionService, userService } from '../../../services';
import { app } from './_app';
import { tenantApp } from './tenant';

let presentCurrentVersion = (
  version: {
    id: string;
    version: string;
    createdAt: Date;
  } | null
) =>
  version
    ? {
        id: version.id,
        version: version.version,
        createdAt: version.createdAt
      }
    : null;

let presentAdminSlate = (slate: Awaited<ReturnType<typeof slateService.getSlateById>>) => {
  let preferredCurrentVersion = getPreferredCurrentSlateVersion({
    supportsBuilt: true,
    unbuiltCurrentVersion: slate.unbuiltCurrentVersion,
    builtOrUnbuiltCurrentVersion: slate.builtOrUnbuiltCurrentVersion
  });

  return {
    ...slatePresenter(slate, { supportsPrebuilt: true }),
    currentVersion: presentCurrentVersion(preferredCurrentVersion),
    unbuiltCurrentVersion: presentCurrentVersion(slate.unbuiltCurrentVersion),
    builtOrUnbuiltCurrentVersion: presentCurrentVersion(slate.builtOrUnbuiltCurrentVersion)
  };
};

let presentAdminSlateVersion = (
  slate: Awaited<ReturnType<typeof slateService.getSlateById>>,
  slateVersion: Awaited<ReturnType<typeof slateVersionService.getSlateVersionById>>
) => ({
  ...slateVersionPresenter(slateVersion),
  backend: slateVersion.backend,
  isUnbuiltCurrent: slate.unbuiltCurrentVersion?.id === slateVersion.id,
  isBuiltOrUnbuiltCurrent: slate.builtOrUnbuiltCurrentVersion?.id === slateVersion.id
});

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

      return Paginator.presentLight(list, presentAdminSlate);
    }),

  get: slateApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        slateId: v.string()
      })
    )
    .do(async ctx => presentAdminSlate(ctx.slate)),

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

      return presentAdminSlate(slate);
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

        return Paginator.presentLight(list, slateVersion =>
          presentAdminSlateVersion(ctx.slate, slateVersion)
        );
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

        let slateVersion = await slateVersionService.publishSlateVersion({
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

        let slate = await slateService.getSlateById({
          id: slateVersion.slate.id,
          tenant: ctx.tenant
        });

        return presentAdminSlateVersion(slate, slateVersion);
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
