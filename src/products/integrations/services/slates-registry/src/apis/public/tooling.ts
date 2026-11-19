import { badRequestError, createError, ServiceError } from '@lowerdeck/error';
import { createHono } from '@lowerdeck/hono';
import type { MiddlewareHandler } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { slateToolingPresenter } from '../../presenters';
import { slateToolingService } from '../../services';
import { storage } from '../../storage';
import { useAuth, useUserAuth } from './_app';

let MAX_ZIP_UPLOAD_BYTES = 64 * 1024 * 1024;

let payloadTooLargeError = createError({
  status: 413,
  code: 'payload_too_large',
  message: 'The request body is too large.'
});

let requireZipContentType: MiddlewareHandler = async (c, next) => {
  let contentType = c.req.header('Content-Type')?.split(';')[0]?.trim();
  if (contentType !== 'application/zip') {
    throw new ServiceError(
      badRequestError({
        message: 'Tooling archives must be uploaded with Content-Type: application/zip.'
      })
    );
  }

  await next();
};

// Must run before bodyLimit, which buffers chunked bodies.
let authorizePublisher: MiddlewareHandler = async (c, next) => {
  let auth = await useUserAuth(c);
  await slateToolingService.authorizePublisher({ user: auth.user, tenant: auth.tenant });

  await next();
};

let isTruthy = (value: string | undefined) => value === 'true' || value === '1';

export let toolingController = createHono()
  .use(async (c, next) => {
    if (c.req.method === 'GET') await useAuth(c);

    await next();
  })
  .get('', async c => {
    let tooling = await slateToolingService.list({ kind: c.req.query('kind') || undefined });

    return c.json({ object: 'list', items: tooling.map(slateToolingPresenter) });
  })
  .get(':kind/resolve', async c => {
    let protocols = c.req.queries('protocol')?.filter(Boolean) ?? [];
    if (!protocols.length) {
      throw new ServiceError(
        badRequestError({ message: 'At least one protocol is required.' })
      );
    }

    let tooling = await slateToolingService.resolve({
      kind: c.req.param('kind'),
      protocols,
      version: c.req.query('version') || undefined
    });

    return c.json(slateToolingPresenter(tooling));
  })
  .get(':kind/:version', async c => {
    let tooling = await slateToolingService.get({
      kind: c.req.param('kind'),
      version: c.req.param('version')
    });

    return c.json(slateToolingPresenter(tooling));
  })
  .get(':kind/:version/download', async c => {
    let tooling = await slateToolingService.get({
      kind: c.req.param('kind'),
      version: c.req.param('version')
    });

    // Mirrors behind restrictive egress can only reach the registry host, not object storage.
    if (isTruthy(c.req.query('proxy'))) {
      let object = await storage.getObjectStream(
        tooling.artifact.bucket,
        tooling.artifact.storageKey
      );

      return new Response(object.stream, { headers: { 'Content-Type': 'application/zip' } });
    }

    let { url } = await storage.getPublicURL(
      tooling.artifact.bucket,
      tooling.artifact.storageKey,
      60
    );

    return c.redirect(url);
  })
  .put(
    ':kind/:version',
    requireZipContentType,
    authorizePublisher,
    bodyLimit({
      maxSize: MAX_ZIP_UPLOAD_BYTES,
      onError: () => {
        throw new ServiceError(payloadTooLargeError());
      }
    }),
    async c => {
      let tooling = await slateToolingService.publish({
        kind: c.req.param('kind'),
        version: c.req.param('version'),
        buffer: Buffer.from(await c.req.arrayBuffer())
      });

      return c.json(slateToolingPresenter(tooling));
    }
  );
