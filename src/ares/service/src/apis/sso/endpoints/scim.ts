import type { DirectorySyncEvent } from '@boxyhq/saml-jackson';
import { createHono } from '@lowerdeck/hono';
import { jackson } from '../../../lib/jackson';
import { ssoDirectoryService } from '../../../services/sso/directory';
import { ssoDirectorySyncService } from '../../../services/sso/directorySync';

let getBody = async (c: any) => {
  if (c.req.method === 'GET' || c.req.method === 'DELETE') return undefined;

  try {
    return await c.req.json();
  } catch {
    return undefined;
  }
};

let getBearerToken = (authorization: string | undefined) => {
  let [type, token] = (authorization ?? '').split(' ');
  if (type?.toLowerCase() !== 'bearer') return '';
  return token ?? '';
};

let getQuery = (c: any) => {
  let query: Record<string, string | number> = {};

  let count = c.req.query('count');
  if (count) query.count = Number(count);

  let startIndex = c.req.query('startIndex');
  if (startIndex) query.startIndex = Number(startIndex);

  let filter = c.req.query('filter');
  if (filter) query.filter = filter;

  return query;
};

export let scimApp = createHono().all('/:directoryId/:resourceType/:resourceId?', async c => {
  let startedAt = Date.now();
  let directoryId = c.req.param('directoryId');
  let resourceType = c.req.param('resourceType');
  let resourceId = c.req.param('resourceId');
  let requestBody = await getBody(c);
  let query = getQuery(c);
  let directory: Awaited<ReturnType<typeof ssoDirectoryService.getDirectoryByInternalId>> | null =
    null;
  let eventNames: string[] = [];

  try {
    directory = await ssoDirectoryService.getDirectoryByInternalId({ internalId: directoryId });

    let res = await jackson.directorySyncController.requests.handle(
      {
        method: c.req.method,
        body: requestBody,
        directoryId,
        resourceId,
        resourceType: resourceType.toLowerCase(),
        apiSecret: getBearerToken(c.req.header('authorization')),
        query
      },
      async (event: DirectorySyncEvent) => {
        eventNames.push(event.event);
        await ssoDirectorySyncService.handleDirectorySyncEvent({ directory: directory!, event });
      }
    );

    await ssoDirectorySyncService.recordScimOperation({
      directory,
      input: {
        internalDirectoryId: directoryId,
        method: c.req.method,
        resourceType: resourceType.toLowerCase(),
        resourceId,
        query,
        requestBody,
        responseBody: res.data,
        statusCode: res.status,
        success: res.status >= 200 && res.status < 400,
        durationMs: Date.now() - startedAt,
        eventNames
      }
    });

    return c.json(res.data, res.status as any);
  } catch (error: any) {
    let responseBody = {
      schemas: ['urn:ietf:params:scim:api:messages:2.0:Error'],
      detail: error?.message ?? 'SCIM request failed',
      status: '400'
    };

    await ssoDirectorySyncService.recordScimOperation({
      directory,
      input: {
        internalDirectoryId: directoryId,
        method: c.req.method,
        resourceType: resourceType.toLowerCase(),
        resourceId,
        query,
        requestBody,
        responseBody,
        statusCode: 400,
        success: false,
        durationMs: Date.now() - startedAt,
        eventNames,
        errorMessage: error?.message ?? 'SCIM request failed'
      }
    });

    return c.json(responseBody, 400);
  }
});
