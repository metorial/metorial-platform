import { badRequestError, notFoundError, ServiceError } from '@lowerdeck/error';
import { createHono } from '@lowerdeck/hono';
import { createLock } from '@lowerdeck/lock';
import { safeFetch } from '@lowerdeck/ssrf';
import { db } from '../../db';
import { env } from '../../env';
import { AuthConfigSecretSerializer } from '../../lib/secretSerializer';
import {
  refreshableAttachmentInclude,
  slateAttachmentRefreshService,
  type RefreshableAttachment
} from '../../services/slateAttachmentRefresh';
import { slateAuthHandlerService } from '../../services/slateInstanceAuthHandler';

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

    let attachment = await db.slateAttachment.findFirst({
      where: { id: attachmentId },
      include: refreshableAttachmentInclude
    });

    if (!attachment || !attachment.isProxied || !attachment.targetUrl) {
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

    if (!attachment.targetUrl) {
      throw new ServiceError(notFoundError('slate.integration_attachment'));
    }

    let headers = (attachment.headers as Record<string, string> | null) ?? {};
    let query = (attachment.query as Record<string, string> | null) ?? {};

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
  }
);
