import {
  badRequestError,
  forbiddenError,
  notFoundError,
  ServiceError
} from '@lowerdeck/error';
import { createHono } from '@lowerdeck/hono';
import { createLock } from '@lowerdeck/lock';
import { safeFetch } from '@lowerdeck/ssrf';
import { PublicUrlPurpose } from 'object-storage-client';
import { db } from '../../db';
import { env } from '../../env';
import { verifyAttachmentSignature } from '../../lib/attachmentSignature';
import { AuthConfigSecretSerializer } from '../../lib/secretSerializer';
import {
  refreshableAttachmentInclude,
  slateAttachmentRefreshService,
  type RefreshableAttachment
} from '../../services/slateAttachmentRefresh';
import { slateAuthHandlerService } from '../../services/slateInstanceAuthHandler';
import { storage } from '../../storage';

let HOP_BY_HOP_RESPONSE_HEADERS = new Set([
  'connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
  'content-encoding'
]);

let UPSTREAM_ERROR_BODY_MAX_BYTES = 16 * 1024;
let MAX_REDIRECTS = 5;
let SIGNED_URL_EXPIRATION_SECS = 2 * 60;

let PREFER_URL_REQUEST_HEADER = 'metorial-prefer-url';
let ATTACHMENT_RESULT_RESPONSE_HEADER = 'metorial-attachment-result';
let ROUTER_SECRET_HEADER = 'metorial-tool-attachment-router-secret';
let ATTACHMENT_CONTENT_DISPOSITION = 'attachment';

let attachmentContentType = (attachment: RefreshableAttachment, fallback?: string | null) =>
  attachment.mimeType ?? fallback ?? 'application/octet-stream';

let attachmentUrlResponseHeaders = (contentType: string) => ({
  'content-type': contentType,
  'content-disposition': ATTACHMENT_CONTENT_DISPOSITION
});

let refreshLock = createLock({
  name: 'shub/att/refresh/lock',
  redisUrl: env.service.REDIS_URL
});

let refreshIfDue = async (
  attachment: RefreshableAttachment
): Promise<RefreshableAttachment> => {
  if (!attachment.refreshAfter || attachment.refreshAfter >= new Date()) return attachment;

  try {
    return await refreshLock.usingLock(
      attachment.id,
      async () => {
        let fresh = await db.slateAttachment.findUniqueOrThrow({
          where: { oid: attachment.oid },
          include: refreshableAttachmentInclude
        });
        if (!fresh.refreshAfter || fresh.refreshAfter >= new Date()) return fresh;

        return slateAttachmentRefreshService.refreshProxiedAttachment({ attachment: fresh });
      },
      { durationMs: 30_000, acquisitionTimeoutMs: 20_000 }
    );
  } catch {
    return attachment;
  }
};

export let integrationAttachmentApp = createHono().get(
  '/integration-attachment/:attachmentId',
  async c => {
    let attachmentId = c.req.param('attachmentId');
    let preferUrl = !!c.req.header(PREFER_URL_REQUEST_HEADER);

    let setResultHeader = (status: 'error' | 'url' | 'direct') => {
      if (preferUrl) c.header(ATTACHMENT_RESULT_RESPONSE_HEADER, status);
    };

    try {
      if (env.secrets.TOOL_ATTACHMENT_ROUTER_SECRET) {
        if (c.req.header(ROUTER_SECRET_HEADER) !== env.secrets.TOOL_ATTACHMENT_ROUTER_SECRET) {
          throw new ServiceError(
            forbiddenError({
              code: 'integration_attachment_forbidden',
              message: 'This attachment link is invalid or has expired.'
            })
          );
        }
        if (!preferUrl) {
          throw new ServiceError(
            badRequestError({
              code: 'integration_attachment_requires_prefer_url',
              message: 'This endpoint requires the metorial-prefer-url header to be set.'
            })
          );
        }
      }

      let ts = c.req.query('ts');
      let sig = c.req.query('sig');
      let hasSignature = ts !== undefined && sig !== undefined;
      if (hasSignature) {
        let verified = await verifyAttachmentSignature(attachmentId, Number(ts), sig!);
        if (!verified) {
          throw new ServiceError(
            forbiddenError({
              code: 'integration_attachment_invalid_signature',
              message: 'This attachment link is invalid or has expired.'
            })
          );
        }
      } else if (!env.secrets.TOOL_ATTACHMENT_ROUTER_SECRET) {
        throw new ServiceError(
          forbiddenError({
            code: 'integration_attachment_invalid_signature',
            message: 'This attachment link is invalid or has expired.'
          })
        );
      }

      let attachment = await db.slateAttachment.findFirst({
        where: { id: attachmentId },
        include: refreshableAttachmentInclude
      });

      let hasStoredObject = !!(attachment?.storageBucket && attachment?.storageKey);
      if (!attachment || (!attachment.targetUrl && !hasStoredObject)) {
        throw new ServiceError(notFoundError('slate.integration_attachment'));
      }
      if (attachment.expiresAt < new Date()) {
        throw new ServiceError(notFoundError('slate.integration_attachment'));
      }

      attachment = await refreshIfDue(attachment);

      if (
        attachment.refreshFailureCount > 0 &&
        attachment.lastRefreshErrorCode &&
        attachment.refreshAfter &&
        attachment.refreshAfter > new Date()
      ) {
        throw new ServiceError(
          badRequestError({
            code: 'integration_attachment_refresh_failed',
            message: `Failed to refresh this attachment's download URL: ${attachment.lastRefreshErrorMessage}`,
            upstreamErrorCode: attachment.lastRefreshErrorCode
          })
        );
      }

      if (attachment.storageBucket && attachment.storageKey) {
        if (preferUrl) {
          let signed = await storage.getPublicURL(
            attachment.storageBucket,
            attachment.storageKey,
            SIGNED_URL_EXPIRATION_SECS,
            PublicUrlPurpose.Retrieve
          );
          setResultHeader('url');
          return c.json({
            url: signed.url,
            headers: attachmentUrlResponseHeaders(attachmentContentType(attachment))
          });
        }

        let object = await storage.getObject(attachment.storageBucket, attachment.storageKey);
        let responseHeaders = new Headers({
          'content-type': attachmentContentType(attachment, object.metadata.content_type),
          'content-disposition': ATTACHMENT_CONTENT_DISPOSITION
        });
        if (preferUrl) responseHeaders.set(ATTACHMENT_RESULT_RESPONSE_HEADER, 'direct');
        return new Response(object.data, { status: 200, headers: responseHeaders });
      }

      if (!attachment.targetUrl) {
        throw new ServiceError(notFoundError('slate.integration_attachment'));
      }

      let headers = (attachment.headers as Record<string, string> | null) ?? {};
      let query = (attachment.query as Record<string, string> | null) ?? {};
      let needsHeaderOrQueryProxy =
        Object.keys(headers).length > 0 || Object.keys(query).length > 0;

      if (attachment.authConfigOid) {
        let freshAuth = await slateAuthHandlerService.getSlateInstanceAuth({
          tenant: attachment.tenant!,
          authConfigId: attachment.authConfig!.id,
          minExpirationBuffer: 30 * 1000
        });

        let serializer = new AuthConfigSecretSerializer(freshAuth.output ?? {});
        headers = serializer.deserialize(headers);
        query = serializer.deserialize(query);
      }

      if (preferUrl && !needsHeaderOrQueryProxy) {
        setResultHeader('url');
        return c.json({
          url: attachment.targetUrl,
          headers: attachmentUrlResponseHeaders(attachmentContentType(attachment))
        });
      }

      let url = new URL(attachment.targetUrl);
      for (let [key, value] of Object.entries(query)) url.searchParams.set(key, value);

      let upstream: Response;
      try {
        upstream = await safeFetch(url.toString(), { headers, maxRedirects: MAX_REDIRECTS });
      } catch (err) {
        throw new ServiceError(
          badRequestError({
            code: 'integration_attachment_fetch_failed',
            message: `Failed to fetch the integration attachment: ${
              err instanceof Error ? err.message : String(err)
            }`
          })
        );
      }

      if (upstream.status === 200) {
        let responseHeaders = new Headers();
        upstream.headers.forEach((value, key) => {
          if (!HOP_BY_HOP_RESPONSE_HEADERS.has(key.toLowerCase()))
            responseHeaders.set(key, value);
        });
        if (attachment.mimeType && !responseHeaders.has('content-type')) {
          responseHeaders.set('content-type', attachment.mimeType);
        }
        responseHeaders.set('content-disposition', ATTACHMENT_CONTENT_DISPOSITION);
        if (preferUrl) responseHeaders.set(ATTACHMENT_RESULT_RESPONSE_HEADER, 'direct');
        return new Response(upstream.body, { status: 200, headers: responseHeaders });
      }

      let upstreamBody = await upstream.text().catch(() => '');
      throw new ServiceError(
        badRequestError({
          code: 'integration_attachment_upstream_error',
          message: `The integration returned an unexpected response (status ${upstream.status}) while fetching this attachment.`,
          upstreamStatus: upstream.status,
          upstreamError: upstreamBody.slice(0, UPSTREAM_ERROR_BODY_MAX_BYTES)
        })
      );
    } catch (err) {
      setResultHeader('error');
      throw err;
    }
  }
);
