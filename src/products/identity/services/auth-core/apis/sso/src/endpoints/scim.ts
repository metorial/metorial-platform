import type { DirectorySyncEvent } from '@boxyhq/saml-jackson';
import { createHono, type Context } from '@lowerdeck/hono';
import { v } from '@lowerdeck/validation';
import {
  redactScimQuery,
  redactSsoPayload,
  scimErrorBody
} from '@mtsrc/auth-core-http/src/ssoDiagnostics';
import {
  jackson,
  ssoDirectoryService,
  ssoDirectorySyncService
} from '@mtsrc/auth-core-module-sso';
import { timingSafeEqual } from 'crypto';
import { bodyLimit } from 'hono/body-limit';
import type { ContentfulStatusCode } from 'hono/utils/http-status';

let maxScimBodySize = 5 * 1024 * 1024;
let scimHeaders = { 'Content-Type': 'application/scim+json' };
let scimBodyValidator = v.record(v.any());

let unauthorized = (c: Context) =>
  c.json(scimErrorBody(401), 401, { ...scimHeaders, 'WWW-Authenticate': 'Bearer' });

let getBearerToken = (authorization: string | undefined) =>
  /^Bearer +(\S+)$/i.exec(authorization ?? '')?.[1];

let matchesSecret = (token: string, secret: string) => {
  let actual = Buffer.from(token);
  let expected = Buffer.from(secret);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
};

let getQuery = (c: Context) => {
  let query: { count?: number; startIndex?: number; filter?: string } = {};

  let count = c.req.query('count');
  if (count) query.count = Number(count);

  let startIndex = c.req.query('startIndex');
  if (startIndex) query.startIndex = Number(startIndex);

  let filter = c.req.query('filter');
  if (filter) query.filter = filter;

  return query;
};

type ScimDirectory = NonNullable<
  Awaited<ReturnType<typeof ssoDirectoryService.getDirectoryByInternalId>>
>;

export let scimApp = createHono<{ Variables: { directory: ScimDirectory } }>()
  .onError((_error, c) => {
    console.error('SCIM request failed');
    return c.json(scimErrorBody(500), 500, scimHeaders);
  })

  .all(
    '/:directoryId/:resourceType/:resourceId?',
    async (c, next) => {
      let token = getBearerToken(c.req.header('authorization'));
      if (!token) return unauthorized(c);

      let directory = await ssoDirectoryService.getDirectoryByInternalId({
        internalId: c.req.param('directoryId')
      });
      if (!directory?.scimSecret || !matchesSecret(token, directory.scimSecret)) {
        return unauthorized(c);
      }

      c.set('directory', directory);
      await next();
    },
    bodyLimit({
      maxSize: maxScimBodySize,
      onError: c => c.json(scimErrorBody(413), 413, scimHeaders)
    }),
    async c => {
      let startedAt = Date.now();
      let directory = c.get('directory');
      let directoryId = c.req.param('directoryId');
      let resourceType = c.req.param('resourceType').toLowerCase();
      let resourceId = c.req.param('resourceId');
      let query = getQuery(c);
      let requestBody: Record<string, unknown> | undefined;
      let eventNames: string[] = [];

      if (c.req.method !== 'GET' && c.req.method !== 'DELETE' && c.req.raw.body) {
        let body = await c.req.json<Record<string, unknown>>().catch(() => undefined);
        if (!scimBodyValidator.validate(body).success) {
          return c.json(scimErrorBody(400), 400, scimHeaders);
        }

        requestBody = body;
      }

      let operationInput = {
        internalDirectoryId: directoryId,
        method: c.req.method,
        resourceType,
        resourceId,
        query: redactScimQuery(query),
        requestBody: redactSsoPayload(requestBody)
      };
      let operation = await ssoDirectorySyncService.beginScimOperation({
        directory,
        input: operationInput
      });

      let status: number;
      let responseBody: unknown;
      try {
        let result = await jackson.directorySyncController.requests.handle(
          {
            method: c.req.method,
            body: requestBody,
            directoryId,
            resourceId,
            resourceType,
            apiSecret: directory.scimSecret,
            query
          },
          async (event: DirectorySyncEvent) => {
            eventNames.push(event.event);
            await ssoDirectorySyncService.handleDirectorySyncEvent({
              directory,
              event,
              scimOperationId: operation?.id,
              scimRequest: { method: c.req.method, resourceType, body: requestBody }
            });
          }
        );

        status = result.status;
        responseBody = status >= 400 ? scimErrorBody(status) : result.data;
        let groupName = result.data?.displayName;
        if (
          resourceType === 'groups' &&
          groupName &&
          c.req.method !== 'DELETE' &&
          status < 300
        ) {
          responseBody = {
            ...result.data,
            members: await ssoDirectorySyncService.listDirectoryGroupMembers({
              directory,
              groupValue: groupName
            })
          };
        }
      } catch {
        console.error('SCIM directory operation failed');
        status = 500;
        responseBody = scimErrorBody(status);
      }

      let outcome = {
        responseBody: redactSsoPayload(responseBody),
        statusCode: status,
        success: status >= 200 && status < 300,
        durationMs: Date.now() - startedAt,
        eventNames,
        errorMessage: status >= 400 ? scimErrorBody(status).detail : undefined
      };
      if (operation) {
        await ssoDirectorySyncService.completeScimOperation({
          scimOperationId: operation.id,
          input: outcome
        });
      } else {
        await ssoDirectorySyncService.recordScimOperation({
          directory,
          input: { ...operationInput, ...outcome }
        });
      }

      if (status === 204) return c.body(null, 204);
      if (status === 401) return unauthorized(c);

      return c.json(responseBody, status as ContentfulStatusCode, scimHeaders);
    }
  );
