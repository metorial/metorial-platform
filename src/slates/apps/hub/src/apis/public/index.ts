import { badRequestError, ServiceError } from '@lowerdeck/error';
import { createHono } from '@lowerdeck/hono';
import { deleteCookie, getCookie, setCookie } from 'hono/cookie';
import { env } from '../../env';
import {
  captureWebhookWireRequest,
  extractExplicitPathSecret,
  validateWebhookCaptureConformanceReport,
  WebhookCaptureError,
  type TrustedRawHeaderRequest
} from '../../lib/webhookRequestCapture';
import {
  WebhookCapturePolicyError,
  resolveWebhookTargetCapturePolicy
} from '../../lib/webhookCapturePolicy';
import {
  normalizeSharedAppPublicRejection,
  routeSharedAppWebhook
} from '../../lib/sharedAppRouting';
import type { WebhookWireResponse } from '@slates/proto';
import { createSanitizedWebhookResponse } from '../../lib/triggerWebhookSync';
import { slateOAuthHandlerService } from '../../services/slateOAuthHandler';
import { slateTriggerReceiverService } from '../../services/slateTriggerReceiver';
import {
  buildSlateProvisionedExternalOwnershipKey,
  resolveActiveSlateProvisionedTenantApp,
  resolveSlateProvisionedRouteSecrets,
  resolveSelectedSlateProvisionedAppRouteForRouting
} from '../../services/slateTriggerReceiverSecretProjection';
import { slateTriggerWebhookRequestService } from '../../services/slateTriggerWebhookRequest';
import { slateTriggerWebhookSyncService } from '../../services/slateTriggerWebhookSync';
import { finalizeWebhookRequest } from '../../services/slateTriggerWebhookProcessing';

let SETUP_COOKIE_NAME = 'slates_hub_oauth_setup_id';

let cookieOpts = {
  secure: env.service.METORIAL_ENV !== 'development',
  httpOnly: true,
  sameSite: 'lax' as const,
  path: '/'
};

let handleTriggerWebhookRequest =
  (targetType: 'receiverTrigger' | 'receiver') => async (c: any) => {
    if (c.req.method === 'OPTIONS' && c.req.header('access-control-request-method')) {
      return c.text('');
    }
    let targetId = c.req.param(
      targetType === 'receiverTrigger' ? 'receiverTriggerId' : 'receiverId'
    );
    if (!targetId) return c.text('Missing trigger receiver ID', 400);

    let routePrefix =
      targetType === 'receiverTrigger'
        ? `/slates-hub/triggers/webhook/${encodeURIComponent(targetId)}`
        : `/slates-hub/triggers/receiver-webhook/${encodeURIComponent(targetId)}`;
    let pathSecret = extractExplicitPathSecret({ requestUrl: c.req.url, routePrefix });
    if (!pathSecret) {
      return c.text('Malformed secured webhook path', 400);
    }
    if (
      env.service.METORIAL_ENV === 'production' &&
      !validateWebhookCaptureConformanceReport(
        process.env.SLATES_WEBHOOK_CAPTURE_CONFORMANCE_REPORT_JSON,
        process.env.SLATES_DEPLOYMENT_ID,
        {
          buildId: process.env.SLATES_BUILD_ID,
          route: 'slates_hub_public_native_v1',
          configDigest: process.env.SLATES_EDGE_CONFIG_DIGEST,
          serviceAuthSecret: env.encryption.ENCRYPTION_KEY
        }
      )
    ) {
      return c.text('secured_ingress_conformance_not_approved', 503);
    }

    let capturePolicy;
    try {
      capturePolicy = await resolveWebhookTargetCapturePolicy({
        receiverTriggerId: targetType === 'receiverTrigger' ? targetId : undefined,
        receiverId: targetType === 'receiver' ? targetId : undefined,
        method: c.req.method
      });
    } catch (error) {
      let code =
        error instanceof WebhookCapturePolicyError
          ? error.code
          : 'routing_projection_unavailable';
      await slateTriggerWebhookRequestService.createRejectedWebhookRequest({
        receiverTriggerId: targetType === 'receiverTrigger' ? targetId : undefined,
        receiverId: targetType === 'receiver' ? targetId : undefined,
        url: c.req.url,
        method: c.req.method,
        pathSecret,
        safeRejectionCode: code
      });
      return c.text(code, 503);
    }

    let rawRequest = c.req.raw as TrustedRawHeaderRequest;
    let wireRequest;
    try {
      wireRequest = await captureWebhookWireRequest({
        request: rawRequest,
        requireTrustedRawHeaders: env.service.METORIAL_ENV === 'production',
        maxBodyBytes: capturePolicy?.maxBodyBytes,
        supportedDuplicateSecurityHeaders: capturePolicy?.duplicateSecurityHeaders.map(
          policy => policy.headerName
        )
      });
    } catch (error) {
      let captureError =
        error instanceof WebhookCaptureError
          ? error
          : new WebhookCaptureError('wire_input_malformed', 'Webhook capture failed');
      await slateTriggerWebhookRequestService.createRejectedWebhookRequest({
        receiverTriggerId: targetType === 'receiverTrigger' ? targetId : undefined,
        receiverId: targetType === 'receiver' ? targetId : undefined,
        url: c.req.url,
        method: c.req.method,
        headers: rawRequest.rawHeaders,
        pathSecret: pathSecret ?? undefined,
        safeRejectionCode: captureError.code,
        capturePolicy
      });
      let status =
        captureError.code === 'wire_input_oversized'
          ? 413
          : captureError.code === 'raw_header_capture_unavailable'
            ? 503
            : 400;
      return c.text(captureError.code, status);
    }

    let target = {
      receiverTriggerId: targetType === 'receiverTrigger' ? targetId : undefined,
      receiverId: targetType === 'receiver' ? targetId : undefined
    };
    let result = await slateTriggerWebhookSyncService.handleWebhookRequest({
      ...target,
      request: wireRequest,
      pathSecret,
      capturePolicy
    });

    if (result.type === 'methodNotAllowed') {
      return new Response('Method Not Allowed', {
        status: 405,
        headers: { Allow: result.allowedMethods.join(', ') }
      });
    }

    if (result.type === 'response') {
      return createSanitizedWebhookResponse(result.response);
    }

    return c.json({
      status: 'queued',
      webhookRequestId: result.webhookRequestId
    });
  };

let WEBHOOK_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'];

let sharedAppWireResponse = (response: WebhookWireResponse) =>
  new Response(response.body.present ? Buffer.from(response.body.base64, 'base64') : null, {
    status: response.status,
    headers: response.headers
  });

let handleSharedAppWebhookRequest = async (c: any) => {
  let routeIdentifier = c.req.param('routeIdentifier');
  if (!routeIdentifier) return c.text('Not Found', 404);
  let routePrefix = `/slates-hub/triggers/shared-app/${encodeURIComponent(routeIdentifier)}`;
  let pathSecret = extractExplicitPathSecret({ requestUrl: c.req.url, routePrefix });
  if (!pathSecret) return c.text('Malformed secured webhook path', 400);
  if (
    env.service.METORIAL_ENV === 'production' &&
    !validateWebhookCaptureConformanceReport(
      process.env.SLATES_WEBHOOK_CAPTURE_CONFORMANCE_REPORT_JSON,
      process.env.SLATES_DEPLOYMENT_ID,
      {
        buildId: process.env.SLATES_BUILD_ID,
        route: 'slates_hub_public_native_v1',
        configDigest: process.env.SLATES_EDGE_CONFIG_DIGEST,
        serviceAuthSecret: env.encryption.ENCRYPTION_KEY
      }
    )
  ) {
    return c.text('secured_ingress_conformance_not_approved', 503);
  }

  let wireRequest;
  try {
    wireRequest = await captureWebhookWireRequest({
      request: c.req.raw as TrustedRawHeaderRequest,
      requireTrustedRawHeaders: env.service.METORIAL_ENV === 'production'
    });
  } catch (error) {
    let captureError =
      error instanceof WebhookCaptureError
        ? error
        : new WebhookCaptureError('wire_input_malformed', 'Webhook capture failed');
    let status =
      captureError.code === 'wire_input_oversized'
        ? 413
        : captureError.code === 'raw_header_capture_unavailable'
          ? 503
          : 400;
    return c.text(captureError.code, status);
  }

  let result = await routeSharedAppWebhook({
    routeIdentifier,
    suppliedPathSecret: pathSecret,
    request: wireRequest,
    dependencies: {
      resolveRoute: async selector =>
        await resolveSelectedSlateProvisionedAppRouteForRouting({
          routeIdentifier: selector
        }),
      resolveRouteSecrets: resolveSlateProvisionedRouteSecrets,
      buildExternalOwnershipKey: buildSlateProvisionedExternalOwnershipKey,
      resolveBinding: resolveActiveSlateProvisionedTenantApp,
      dispatch: async ({ boundary, request, suppliedPathSecret }) => {
        let requestRecord =
          await slateTriggerWebhookRequestService.createCapturedSharedAppWebhookRequest({
            receiverTriggerId: boundary.receiverTriggerId,
            wireRequest: request,
            pathSecret: suppliedPathSecret,
            authenticatedBoundary: boundary
          });
        let exactResult;
        try {
          exactResult = await slateTriggerReceiverService.handleCapturedSharedAppWebhook({
            boundary,
            request,
            requestId: requestRecord.id
          });
        } catch {
          await finalizeWebhookRequest({
            request: {
              id: requestRecord.id,
              receiverTriggerId: requestRecord.receiverTriggerId,
              receiverId: requestRecord.receiverId,
              url: requestRecord.url,
              method: requestRecord.method,
              headers: requestRecord.headers,
              createdAt: requestRecord.createdAt
            },
            body: null,
            outcome: 'failed',
            safeRejectionCode: 'routing_projection_stale'
          });
          throw new Error('Shared-app dispatch failed');
        }
        await finalizeWebhookRequest({
          request: {
            id: requestRecord.id,
            receiverTriggerId: requestRecord.receiverTriggerId,
            receiverId: requestRecord.receiverId,
            url: requestRecord.url,
            method: requestRecord.method,
            headers: requestRecord.headers,
            createdAt: requestRecord.createdAt
          },
          body: null,
          outcome: exactResult.status === 'rejected' ? 'rejected' : 'accepted',
          safeRejectionCode: exactResult.status === 'rejected' ? exactResult.code : undefined
        });
        return exactResult.status === 'rejected'
          ? { status: 'rejected' as const, code: exactResult.code }
          : {
              status: 'accepted' as const,
              webhookRequestId: requestRecord.id,
              ...(exactResult.response ? { response: exactResult.response } : {})
            };
      }
    }
  });

  if (result.status === 'rejected') {
    let rejection = normalizeSharedAppPublicRejection(result);
    return c.text(rejection.body, rejection.status);
  }
  if (result.response) return sharedAppWireResponse(result.response);
  return c.json({
    status: 'queued',
    webhookRequestId: result.webhookRequestId
  });
};

export let hubApp = createHono()
  .use(async (c, next) => {
    await next();

    c.res.headers.set('Access-Control-Allow-Origin', c.req.header('Origin') || '*');
    c.res.headers.set(
      'Access-Control-Allow-Methods',
      'GET, POST, PUT, DELETE, OPTIONS, PATCH, HEAD'
    );
    c.res.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    c.res.headers.set('Access-Control-Allow-Credentials', 'true');
  })
  .get('/slates-hub/authorization', async c => {
    let oauthSetupId = c.req.query('setup_id');
    if (!oauthSetupId)
      throw new ServiceError(badRequestError({ message: 'setup_id is required' }));

    let res = await slateOAuthHandlerService.startOAuthFlow({
      setupId: oauthSetupId
    });

    setCookie(c, SETUP_COOKIE_NAME, res.setupCookieValue, cookieOpts);

    return c.redirect(res.authorizationUrl);
  })
  .get('/slates-hub/callback', async c => {
    let setupCookie = getCookie(c, SETUP_COOKIE_NAME);
    if (!setupCookie)
      throw new ServiceError(badRequestError({ message: 'OAuth setup cookie is missing' }));

    deleteCookie(c, SETUP_COOKIE_NAME, cookieOpts);

    let code = c.req.query('code');
    let state = c.req.query('state');
    let error = c.req.query('error');
    let errorDescription = c.req.query('error_description');

    if (error || !code) {
      let res = await slateOAuthHandlerService.reportError({
        input: {
          lastOAuthSetupCookieId: setupCookie,
          state: state || undefined,
          error: error || 'missing_code',
          errorDescription: errorDescription || undefined
        }
      });

      return c.redirect(res.redirectUrl);
    }

    let res = await slateOAuthHandlerService.completeOAuthFlow({
      input: {
        code,
        lastOAuthSetupCookieId: setupCookie,
        state: state || undefined
      }
    });

    return c.redirect(res.redirectUrl);
  })
  .on(
    WEBHOOK_METHODS,
    '/slates-hub/triggers/webhook/:receiverTriggerId/:pathSecret',
    handleTriggerWebhookRequest('receiverTrigger')
  )
  .on(
    WEBHOOK_METHODS,
    '/slates-hub/triggers/receiver-webhook/:receiverId/:pathSecret',
    handleTriggerWebhookRequest('receiver')
  )
  .on(
    WEBHOOK_METHODS,
    '/slates-hub/triggers/shared-app/:routeIdentifier/:pathSecret',
    handleSharedAppWebhookRequest
  )
  .options('*', c => c.text(''))
  .get('/ping', c => c.text('OK'));
