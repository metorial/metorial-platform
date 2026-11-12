import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import {
  catalogSlatePresenter,
  catalogSlateVersionPresenter,
  mirrorResultPresenter,
  mirrorUpstreamPresenter,
  slatePackImportPresenter
} from '../../presenters';
import { activationService, mirrorService, slatePackService } from '../../services';
import { app } from './_app';

let resultStatuses = ['imported', 'skipped', 'conflict', 'rejected'] as const;

export let mirrorController = app.controller({
  getStatus: app
    .handler()
    .input(v.object({}))
    .do(async () => mirrorService.getStatus()),

  configure: app
    .handler()
    .input(
      v.object({
        licenseOperational: v.boolean(),
        upstream: v.nullable(
          v.object({ url: v.string(), subRegistryId: v.nullable(v.string()) })
        ),
        trustedKeys: v.array(
          v.object({
            kid: v.string(),
            publicKey: v.object({ kty: v.string(), crv: v.string(), x: v.string() })
          })
        )
      })
    )
    .do(async ctx => mirrorService.configureFromLicense(ctx.input)),

  listUpstreams: app
    .handler()
    .input(Paginator.validate(v.object({ includeArchived: v.optional(v.boolean()) })))
    .do(async ctx => {
      let paginator = await mirrorService.listUpstreams(ctx.input);
      let list = await paginator.run(ctx.input);

      return Paginator.presentLight(list, mirrorUpstreamPresenter);
    }),

  getUpstream: app
    .handler()
    .input(v.object({ upstreamId: v.string() }))
    .do(async ctx =>
      mirrorUpstreamPresenter(
        await mirrorService.getUpstreamById({ id: ctx.input.upstreamId })
      )
    ),

  createUpstream: app
    .handler()
    .input(
      v.object({
        name: v.string(),
        url: v.string(),
        subRegistryId: v.optional(v.nullable(v.string()))
      })
    )
    .do(async ctx =>
      mirrorUpstreamPresenter(await mirrorService.createUpstream({ input: ctx.input }))
    ),

  updateUpstream: app
    .handler()
    .input(
      v.object({
        upstreamId: v.string(),
        name: v.optional(v.string()),
        url: v.optional(v.string()),
        subRegistryId: v.optional(v.nullable(v.string())),
        status: v.optional(v.enumOf(['active', 'paused']))
      })
    )
    .do(async ctx => {
      let { upstreamId, ...input } = ctx.input;

      return mirrorUpstreamPresenter(
        await mirrorService.updateUpstream({ id: upstreamId, input })
      );
    }),

  archiveUpstream: app
    .handler()
    .input(v.object({ upstreamId: v.string() }))
    .do(async ctx =>
      mirrorUpstreamPresenter(
        await mirrorService.archiveUpstream({ id: ctx.input.upstreamId })
      )
    ),

  resyncUpstream: app
    .handler()
    .input(v.object({ upstreamId: v.string() }))
    .do(async ctx =>
      mirrorUpstreamPresenter(await mirrorService.resyncUpstream({ id: ctx.input.upstreamId }))
    ),

  listResults: app
    .handler()
    .input(
      Paginator.validate(
        v.object({
          upstreamId: v.optional(v.string()),
          packImportId: v.optional(v.string()),
          status: v.optional(v.array(v.enumOf([...resultStatuses])))
        })
      )
    )
    .do(async ctx => {
      let paginator = await mirrorService.listResults(ctx.input);
      let list = await paginator.run(ctx.input);

      return Paginator.presentLight(list, mirrorResultPresenter);
    }),

  listPackImports: app
    .handler()
    .input(Paginator.validate(v.object({})))
    .do(async ctx => {
      let paginator = await slatePackService.listImports();
      let list = await paginator.run(ctx.input);

      return Paginator.presentLight(list, slatePackImportPresenter);
    }),

  getPackImport: app
    .handler()
    .input(v.object({ packImportId: v.string() }))
    .do(async ctx =>
      slatePackImportPresenter(
        await slatePackService.getImport({ id: ctx.input.packImportId })
      )
    ),

  listCatalog: app
    .handler()
    .input(
      Paginator.validate(
        v.object({
          search: v.optional(v.string()),
          activation: v.optional(v.enumOf(['activated', 'available']))
        })
      )
    )
    .do(async ctx => {
      let paginator = await activationService.listCatalog(ctx.input);
      let list = await paginator.run(ctx.input);

      return Paginator.presentLight(list, catalogSlatePresenter);
    }),

  getCatalogSlate: app
    .handler()
    .input(v.object({ slateId: v.string() }))
    .do(async ctx =>
      catalogSlatePresenter(await activationService.getCatalogSlate(ctx.input))
    ),

  listCatalogVersions: app
    .handler()
    .input(Paginator.validate(v.object({ slateId: v.string() })))
    .do(async ctx => {
      let slate = await activationService.getCatalogSlate(ctx.input);
      let paginator = await activationService.listCatalogVersions(ctx.input);
      let list = await paginator.run(ctx.input);

      return Paginator.presentLight(list, version =>
        catalogSlateVersionPresenter(version, {
          pinnedVersionOid:
            slate.activation?.mode === 'pinned' ? slate.activation.pinnedVersionOid : null
        })
      );
    }),

  setActivation: app
    .handler()
    .input(
      v.object({
        slateId: v.string(),
        mode: v.enumOf(['latest', 'pinned']),
        pinnedVersionId: v.optional(v.nullable(v.string()))
      })
    )
    .do(async ctx => catalogSlatePresenter(await activationService.setActivation(ctx.input)))
});
