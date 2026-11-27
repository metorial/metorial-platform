import {
  badRequestError,
  forbiddenError,
  notFoundError,
  ServiceError
} from '@lowerdeck/error';
import { createHono } from '@lowerdeck/hono';
import { safeFetch } from '@lowerdeck/ssrf';
import { PublicUrlPurpose } from 'object-storage-client';
import { env } from '@mtsrc/slates-hub-env/env';
import { verifyAttachmentSignature } from '@mtsrc/slates-hub-module-invocations/attachmentSignature';
import { resolveAttachmentEgress } from '@mtsrc/slates-hub-module-invocations/attachmentEgress';
import {
  isGatewayEgress,
  resolveEgressSubject
} from '@mtsrc/slates-hub-network/egressGateway';
import {
  EgressGatewayRefusedError,
  gatewayFetch
} from '@mtsrc/slates-hub-network/gatewayFetch';
import {
  AuthConfigSecretSerializer,
  containsSecretPlaceholder
} from '@mtsrc/slates-hub-protocol/secretSerializer';
import { getIntegrationAttachment } from '@mtsrc/slates-hub-module-sessions/integrationAttachment';
import type { RefreshableAttachment } from '@mtsrc/slates-hub-module-sessions/slateAttachmentRefresh';
import { slateAuthHandlerService } from '@mtsrc/slates-hub-module-instances/slateInstanceAuthHandler';
import { storage } from '@mtsrc/slates-hub-storage/storage';

let PROXIED_RESPONSE_HEADERS = [
  'content-type',
  'cache-control',
  'expires',
  'etag',
  'last-modified'
];

let UPSTREAM_ERROR_BODY_MAX_BYTES = 16 * 1024;
let MAX_REDIRECTS = 5;
let SIGNED_URL_EXPIRATION_SECS = 7 * 60;

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

let fetchUpstream = async (
  attachment: RefreshableAttachment,
  url: URL,
  headers: Record<string, string>
) => {
  if (!isGatewayEgress()) {
    return safeFetch(url.toString(), {
      headers,
      maxRedirects: MAX_REDIRECTS,
      crossOriginRedirectStripHeaders: Object.keys(headers)
    });
  }

  // A download can outlast a request grant, so it gets the stream lifetime.
  return gatewayFetch(url.toString(), {
    subject: await resolveEgressSubject({
      tenant: attachment.tenant,
      ...resolveAttachmentEgress(attachment)
    }),
    headers,
    maxRedirects: MAX_REDIRECTS,
    lifetime: 'stream'
  });
};

let proxiedResponseHeaders = (upstream: Headers) => {
  let headers = new Headers();

  for (let name of PROXIED_RESPONSE_HEADERS) {
    let value = upstream.get(name);
    if (value) headers.set(name, value);
  }

  let contentLength = upstream.get('content-length');
  if (contentLength && !upstream.has('content-encoding')) {
    headers.set('content-length', contentLength);
  }

  return headers;
};

let readBodyPrefix = async (response: Response, maxBytes: number) => {
  let reader = response.body?.getReader();
  if (!reader) return '';

  let chunks: Uint8Array[] = [];
  let size = 0;

  try {
    while (size < maxBytes) {
      let { done, value } = await reader.read();
      if (done) break;

      chunks.push(value);
      size += value.byteLength;
    }
  } catch {
    return '';
  } finally {
    await reader.cancel().catch(() => {});
  }

  return new TextDecoder().decode(Buffer.concat(chunks).subarray(0, maxBytes));
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

      let attachment = await getIntegrationAttachment({ attachmentId });
      if (!attachment) {
        throw new ServiceError(notFoundError('slate.integration_attachment'));
      }

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
          'content-disposition': ATTACHMENT_CONTENT_DISPOSITION,
          'x-content-type-options': 'nosniff'
        });
        if (preferUrl) responseHeaders.set(ATTACHMENT_RESULT_RESPONSE_HEADER, 'direct');
        return new Response(new Uint8Array(object.data), {
          status: 200,
          headers: responseHeaders
        });
      }

      if (!attachment.targetUrl) {
        throw new ServiceError(notFoundError('slate.integration_attachment'));
      }

      let targetUrl = attachment.targetUrl;
      let headers = (attachment.headers as Record<string, string> | null) ?? {};
      let query = (attachment.query as Record<string, string> | null) ?? {};
      // A credential in the URL itself (e.g. Telegram's /bot<token>/ path) must never reach the client.
      let needsProxy =
        Object.keys(headers).length > 0 ||
        Object.keys(query).length > 0 ||
        containsSecretPlaceholder(targetUrl);
      let serializer: AuthConfigSecretSerializer | undefined;

      if (
        attachment.authConfigOid &&
        (containsSecretPlaceholder(targetUrl) ||
          containsSecretPlaceholder(headers) ||
          containsSecretPlaceholder(query))
      ) {
        let freshAuth = await slateAuthHandlerService.getSlateInstanceAuth({
          tenant: attachment.tenant!,
          authConfigId: attachment.authConfig!.id,
          minExpirationBuffer: 30 * 1000
        });

        serializer = new AuthConfigSecretSerializer(freshAuth.output ?? {});
        targetUrl = serializer.deserialize(targetUrl);
        headers = serializer.deserialize(headers);
        query = serializer.deserialize(query);
      }

      if (preferUrl && !needsProxy) {
        setResultHeader('url');
        return c.json({
          url: targetUrl,
          headers: attachmentUrlResponseHeaders(attachmentContentType(attachment))
        });
      }

      let url = new URL(targetUrl);
      for (let [key, value] of Object.entries(query)) url.searchParams.set(key, value);

      let upstream: Response;
      try {
        upstream = await fetchUpstream(attachment, url, headers);
      } catch (err) {
        if (err instanceof EgressGatewayRefusedError && err.refusal == 'denied') {
          throw new ServiceError(
            badRequestError({
              code: 'integration_attachment_egress_blocked',
              message:
                "The integration's network policy does not allow downloading this attachment."
            })
          );
        }

        let reason = err instanceof Error ? err.message : String(err);
        throw new ServiceError(
          badRequestError({
            code: 'integration_attachment_fetch_failed',
            // The resolved URL and headers hold live credentials; never echo them back.
            message: `Failed to fetch the integration attachment: ${serializer?.serialize(reason) ?? reason}`
          })
        );
      }

      if (upstream.status === 200) {
        let responseHeaders = proxiedResponseHeaders(upstream.headers);
        if (attachment.mimeType && !responseHeaders.has('content-type')) {
          responseHeaders.set('content-type', attachment.mimeType);
        }
        responseHeaders.set('content-disposition', ATTACHMENT_CONTENT_DISPOSITION);
        responseHeaders.set('x-content-type-options', 'nosniff');
        if (preferUrl) responseHeaders.set(ATTACHMENT_RESULT_RESPONSE_HEADER, 'direct');
        return new Response(upstream.body, { status: 200, headers: responseHeaders });
      }

      let upstreamBody = await readBodyPrefix(upstream, UPSTREAM_ERROR_BODY_MAX_BYTES);
      throw new ServiceError(
        badRequestError({
          code: 'integration_attachment_upstream_error',
          message: `The integration returned an unexpected response (status ${upstream.status}) while fetching this attachment.`,
          upstreamStatus: upstream.status,
          upstreamError: upstreamBody
        })
      );
    } catch (err) {
      setResultHeader('error');
      throw err;
    }
  }
);
