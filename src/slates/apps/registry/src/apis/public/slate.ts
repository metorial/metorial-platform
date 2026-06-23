import { createHono } from '@lowerdeck/hono';
import { Paginator } from '@lowerdeck/pagination';
import { z } from 'zod';
import { paginatorSchema } from '../../lib/paginatorSchema';
import { getPreferredCurrentSlateVersion } from '../../lib/slateVersion/current';
import { useValidation } from '../../lib/validator';
import { slatePresenter, slateVersionPresenter } from '../../presenters';
import { slateService, slateVersionService } from '../../services';
import { storage } from '../../storage';
import { useAuth, useUserAuth } from './_app';

let supportsPrebuiltSchema = z.object({
  supports_prebuilt: z.coerce.boolean().optional()
});

export let slatesController = createHono()
  .get(
    '',
    useValidation(
      'query',
      paginatorSchema.extend({
        scopeId: z.string().optional(),
        userId: z.string().optional(),
        workspaceId: z.string().optional(),
        supports_prebuilt: z.coerce.boolean().optional()
      })
    ),
    async c => {
      let auth = await useAuth(c);
      let query = c.req.valid('query');

      let paginator = await slateService.listSlates({
        tenant: auth.tenant,
        subRegistry: auth.subRegistry,
        scopeIds: query.scopeId?.split(','),
        userIds: query.userId?.split(','),
        workspaceIds: query.workspaceId?.split(',')
      });
      let list = await paginator.run(query);

      return c.json(
        await Paginator.presentLight(list, slate =>
          slatePresenter(slate, {
            supportsPrebuilt: query.supports_prebuilt
          })
        )
      );
    }
  )
  .get(':scopeId/:slateId', useValidation('query', supportsPrebuiltSchema), async c => {
    let auth = await useAuth(c);
    let query = c.req.valid('query');

    let slate = await slateService.getSlateById({
      tenant: auth.tenant,
      subRegistry: auth.subRegistry,
      id: `${c.req.param('scopeId')}/${c.req.param('slateId')}`,
      supportsPrebuilt: query.supports_prebuilt
    });

    return c.json(
      await slatePresenter(slate, {
        supportsPrebuilt: query.supports_prebuilt
      })
    );
  })
  .post(
    ':scopeId/:slateId/versions',
    useValidation(
      'json',
      z.object({
        contentBase64: z.string(),
        access: z.enum(['public', 'private']),
        version: z.string().optional()
      })
    ),
    async c => {
      let auth = await useUserAuth(c);
      let body = c.req.valid('json');

      let slateVersion = await slateVersionService.publishSlateVersion({
        user: auth.user,
        input: {
          identifier: {
            scopeIdentifier: c.req.param('scopeId'),
            slateIdentifier: c.req.param('slateId')
          },

          versionOverride: body.version,

          access: body.access,
          contentBase64: body.contentBase64
        }
      });

      return c.json(await slateVersionPresenter(slateVersion));
    }
  )
  .get(
    ':scopeId/:slateId/versions',
    useValidation(
      'query',
      paginatorSchema.extend({
        supports_prebuilt: z.coerce.boolean().optional()
      })
    ),
    async c => {
      let auth = await useAuth(c);
      let query = c.req.valid('query');

      let slate = await slateService.getSlateById({
        tenant: auth.tenant,
        subRegistry: auth.subRegistry,
        id: `${c.req.param('scopeId')}/${c.req.param('slateId')}`,
        supportsPrebuilt: query.supports_prebuilt
      });

      let paginator = await slateVersionService.listSlateVersions({
        slate,
        supportsPrebuilt: query.supports_prebuilt
      });
      let list = await paginator.run(query);
      let currentVersionId =
        getPreferredCurrentSlateVersion({
          supportsBuilt: query.supports_prebuilt ?? false,
          unbuiltCurrentVersion: slate.unbuiltCurrentVersion,
          builtOrUnbuiltCurrentVersion: slate.builtOrUnbuiltCurrentVersion
        })?.id ?? null;

      return c.json(
        await Paginator.presentLight(list, slateVersion =>
          slateVersionPresenter(slateVersion, {
            currentVersionId
          })
        )
      );
    }
  )
  .get(
    ':scopeId/:slateId/versions/:versionId',
    useValidation('query', supportsPrebuiltSchema),
    async c => {
      let auth = await useAuth(c);
      let query = c.req.valid('query');

      let slate = await slateService.getSlateById({
        tenant: auth.tenant,
        subRegistry: auth.subRegistry,
        id: `${c.req.param('scopeId')}/${c.req.param('slateId')}`,
        supportsPrebuilt: query.supports_prebuilt
      });

      let slateVersion = await slateVersionService.getSlateVersionById({
        slate,
        id: c.req.param('versionId'),
        supportsPrebuilt: query.supports_prebuilt
      });

      return c.json(
        await slateVersionPresenter(slateVersion, {
          currentVersionId:
            getPreferredCurrentSlateVersion({
              supportsBuilt: query.supports_prebuilt ?? false,
              unbuiltCurrentVersion: slate.unbuiltCurrentVersion,
              builtOrUnbuiltCurrentVersion: slate.builtOrUnbuiltCurrentVersion
            })?.id ?? null
        })
      );
    }
  )
  .get(
    ':scopeId/:slateId/versions/:versionId/download',
    useValidation('query', supportsPrebuiltSchema),
    async c => {
    let auth = await useAuth(c);
    let query = c.req.valid('query');

    let slate = await slateService.getSlateById({
      tenant: auth.tenant,
      subRegistry: auth.subRegistry,
      id: `${c.req.param('scopeId')}/${c.req.param('slateId')}`,
      supportsPrebuilt: query.supports_prebuilt
    });

    let slateVersion = await slateVersionService.getSlateVersionById({
      slate,
      id: c.req.param('versionId'),
      supportsPrebuilt: query.supports_prebuilt
    });

    let { url } = await storage.getPublicURL(
      slateVersion.bundleArtifact.bucket,
      slateVersion.bundleArtifact.storageKey,
      60
    );

    return c.redirect(url);
  });
