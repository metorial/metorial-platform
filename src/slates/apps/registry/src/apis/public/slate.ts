import { badRequestError, createError, ServiceError } from '@lowerdeck/error';
import { createHono } from '@lowerdeck/hono';
import { Paginator } from '@lowerdeck/pagination';
import type { MiddlewareHandler } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { z } from 'zod';
import { paginatorSchema } from '../../lib/paginatorSchema';
import { getPreferredCurrentSlateVersion } from '../../lib/slateVersion/current';
import { useValidation } from '../../lib/validator';
import { slatePresenter, slateVersionPresenter } from '../../presenters';
import { slateService, slateVersionService } from '../../services';
import { storage } from '../../storage';
import { useAuth, useUserAuth } from './_app';

let MB = 1024 * 1024;
let MAX_ZIP_UPLOAD_BYTES = 64 * MB;
// Base64 grows the zip by a third, plus room for the JSON around it.
let MAX_JSON_UPLOAD_BYTES = Math.ceil((MAX_ZIP_UPLOAD_BYTES * 4) / 3) + MB;
let MAX_LOOKUP_BODY_BYTES = MB;
let MAX_LOOKUP_ITEMS = 2000;
// npm's package name limit.
let MAX_IDENTIFIER_LENGTH = 214;
let MAX_VERSION_LENGTH = 256;

let supportsPrebuiltSchema = z.object({
  supports_prebuilt: z.coerce.boolean().optional()
});

let payloadTooLargeError = createError({
  status: 413,
  code: 'payload_too_large',
  message: 'The request body is too large.'
});

let limitBody = (maxSize: number) =>
  bodyLimit({
    maxSize,
    onError: () => {
      throw new ServiceError(payloadTooLargeError());
    }
  });

let accessSchema = z.enum(['public', 'private']);

let requireZipContentType: MiddlewareHandler = async (c, next) => {
  let contentType = c.req.header('Content-Type')?.split(';')[0]?.trim();
  if (contentType !== 'application/zip') {
    throw new ServiceError(
      badRequestError({
        message: 'Slate bundles must be uploaded with Content-Type: application/zip.'
      })
    );
  }

  await next();
};

// Must run before limitBody, which buffers chunked bodies.
let authorizeUpload: MiddlewareHandler = async (c, next) => {
  let auth = await useUserAuth(c);
  await slateVersionService.getPublishableScope({
    user: auth.user,
    scopeIdentifier: c.req.param('scopeId') ?? ''
  });

  await next();
};

export let slatesController = createHono()
  .post(
    'version-lookup',
    limitBody(MAX_LOOKUP_BODY_BYTES),
    useValidation(
      'json',
      z.object({
        items: z
          .array(
            z.object({
              identifier: z.string().max(MAX_IDENTIFIER_LENGTH),
              version: z.string().min(1).max(MAX_VERSION_LENGTH)
            })
          )
          .max(MAX_LOOKUP_ITEMS)
      })
    ),
    async c => {
      let auth = await useUserAuth(c);
      let body = c.req.valid('json');

      return c.json({
        items: await slateVersionService.lookupSlateVersions({
          tenant: auth.tenant,
          items: body.items
        })
      });
    }
  )
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
    authorizeUpload,
    limitBody(MAX_JSON_UPLOAD_BYTES),
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
          content: Buffer.from(body.contentBase64, 'base64')
        }
      });

      return c.json(await slateVersionPresenter(slateVersion));
    }
  )
  .put(
    ':scopeId/:slateId/versions/:version',
    requireZipContentType,
    authorizeUpload,
    limitBody(MAX_ZIP_UPLOAD_BYTES),
    useValidation(
      'query',
      z.object({
        access: accessSchema.optional(),
        default_access: accessSchema.optional()
      })
    ),
    async c => {
      let auth = await useUserAuth(c);
      let query = c.req.valid('query');

      let slateVersion = await slateVersionService.publishSlateVersion({
        user: auth.user,
        input: {
          identifier: {
            scopeIdentifier: c.req.param('scopeId'),
            slateIdentifier: c.req.param('slateId')
          },
          versionOverride: c.req.param('version'),
          access: query.access,
          defaultAccess: query.default_access,
          content: Buffer.from(await c.req.arrayBuffer()),
          prebuiltOnly: true
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
    }
  );
