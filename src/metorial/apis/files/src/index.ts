import { badRequestError, forbiddenError, ServiceError } from '@lowerdeck/error';
import { createExecutionContext, provideExecutionContext } from '@lowerdeck/execution-context';
import { extractIp } from '@lowerdeck/forwarded-for';
import { Context, cors, createHono } from '@lowerdeck/hono';
import { getFileDownloadUrl } from '@metorial-platform-systems/cargo-client';
import { authenticate } from '@metorial/auth';
import { generatePlainId } from '@metorial/id';
import {
  documentService,
  purposeSlugs,
  resolveCargoAccess,
  uploadCargoFile
} from '@metorial/module-file';
import { upgradeWebSocket, websocket } from 'hono/bun';
import { resolveDocumentsLiveTarget } from './documentsLiveAuth';
import { resolveUploadTarget } from './uploadAccess';

type FileApiAuthResult = Awaited<ReturnType<typeof authenticate>>;

type FileApiOptions = {
  authenticateRequest?: (
    req: Request,
    url: URL
  ) => Promise<{
    auth: FileApiAuthResult['auth'];
  }>;
};

export { websocket };

let createFileUploadHandler =
  (authenticateRequest: NonNullable<FileApiOptions['authenticateRequest']>) =>
  async (c: Context) =>
    provideExecutionContext(
      createExecutionContext({
        contextId: `req_${generatePlainId(20)}`,
        type: 'request',
        ip: extractIp(c.req.raw.headers as any) ?? '0.0.0.0',
        userAgent: c.req.raw.headers.get('user-agent') ?? 'unknown'
      }),
      async () => {
        let { auth } = await authenticateRequest(c.req.raw, new URL(c.req.url));

        let body = await c.req.formData();
        let file = body.get('file') as File;
        let purpose = body.get('purpose') as string;
        let organizationId = body.get('organization_id');
        let instanceId = body.get('instance_id');
        let attachedStoreId = body.get('store_id');
        let attachedStorePath = body.get('path');
        let title = (body.get('title') || undefined) as string | undefined;

        if (!file || !purpose) {
          throw new ServiceError(
            badRequestError({
              message: 'Missing file or purpose'
            })
          );
        }

        if (!purposeSlugs.includes(purpose)) {
          throw new ServiceError(
            badRequestError({
              message: 'Invalid purpose'
            })
          );
        }

        if (!!attachedStoreId !== !!attachedStorePath) {
          throw new ServiceError(
            badRequestError({
              message: 'store_id and path must be provided together'
            })
          );
        }

        let target = await resolveUploadTarget({
          auth,
          instanceId: typeof instanceId == 'string' ? instanceId : null,
          organizationId: typeof organizationId == 'string' ? organizationId : null
        });

        if ((attachedStoreId || attachedStorePath) && !target.isInstanceOwner) {
          throw new ServiceError(
            badRequestError({
              message: 'Files can only be attached to stores when uploading to an instance'
            })
          );
        }

        let createdFile = await uploadCargoFile({
          owner: target.owner,
          purpose,
          file,
          title,
          fileName: file.name,
          ...target.cargoAccess,
          store:
            typeof attachedStoreId == 'string' && typeof attachedStorePath == 'string'
              ? {
                  id: attachedStoreId,
                  path: attachedStorePath
                }
              : undefined
        });

        return c.json({
          object: 'file',

          id: createdFile.id,
          status: createdFile.status,

          file_name: createdFile.fileName,
          file_size: createdFile.fileSize,
          file_type: createdFile.fileType,

          title: createdFile.title,

          purpose: {
            name: createdFile.purpose.name,
            identifier: createdFile.purpose.slug
          },

          created_at: createdFile.createdAt,
          updated_at: createdFile.updatedAt
        });
      }
    );

let getCargoHttpBaseUrl = () => {
  if (!process.env.CARGO_API_URL) {
    throw new Error('CARGO_API_URL is required');
  }

  let url = new URL(process.env.CARGO_API_URL);

  if (url.pathname.endsWith('/metorial-cargo')) {
    url.pathname = url.pathname.slice(0, -'/metorial-cargo'.length) || '/';
  }

  url.search = '';

  return url;
};

let getCargoContentEndpoint = () => {
  if (process.env.CARGO_CONTENT_URL) {
    return process.env.CARGO_CONTENT_URL.replace(/\/$/, '');
  }

  let url = getCargoHttpBaseUrl();

  if (url.hostname === 'cargo') {
    url.hostname = 'cargo-content';
    url.port = '52151';
  } else if (
    (url.hostname === 'localhost' || url.hostname === '127.0.0.1') &&
    url.port === '52150'
  ) {
    url.port = '52151';
  }

  return url.toString().replace(/\/$/, '');
};

let getFileContentHandler = async (c: Context) => {
  let { fileId, key } = c.req.param();

  if (!fileId || !key) {
    throw new ServiceError(
      badRequestError({
        message: 'Missing fileId or key'
      })
    );
  }

  let url = new URL(c.req.url);
  let response = await fetch(
    getFileDownloadUrl({
      contentEndpoint: getCargoContentEndpoint(),
      fileId,
      key,
      download: url.searchParams.has('download')
    }),
    {
      headers: {
        ...(c.req.header('Authorization')
          ? { Authorization: c.req.header('Authorization')! }
          : {}),
        ...(c.req.header('sentry-trace')
          ? { 'sentry-trace': c.req.header('sentry-trace')! }
          : {}),
        ...(c.req.header('baggage') ? { baggage: c.req.header('baggage')! } : {})
      }
    }
  );

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers
  });
};

let getQueryParam = (url: URL, keys: string[]) => {
  for (let key of keys) {
    let value = url.searchParams.get(key);
    if (value) return value;
  }

  return null;
};

let getCargoDocumentLiveUrl = (d: { actorId: string; documentId: string }) => {
  let url = getCargoHttpBaseUrl();

  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
  url.pathname = `${url.pathname.replace(/\/$/, '')}/document-live`;
  url.search = '';
  url.searchParams.set('actorId', d.actorId);
  url.searchParams.set('documentId', d.documentId);

  return url.toString();
};

let createDocumentsLiveHandler = (
  authenticateRequest: NonNullable<FileApiOptions['authenticateRequest']>
) =>
  createHono()
    .use(async (c, next) => {
      c.res.headers.set('Access-Control-Allow-Origin', c.req.header('Origin') || '*');
      c.res.headers.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
      c.res.headers.set(
        'Access-Control-Allow-Headers',
        'Content-Type, Authorization, Cookies, metorial-version, metorial-instance-id, metorial-consumer-profile-id, metorial-organization-id, baggage, sentry-trace, metorial-client, metorial-consumer-session-client-secret'
      );
      c.res.headers.set('Access-Control-Allow-Credentials', 'true');
      c.res.headers.set('Access-Control-Max-Age', '86400');

      if (c.req.method === 'OPTIONS') {
        return c.text('OK', 200);
      }

      await next();
    })
    .options('*', c => c.text(''))
    .get(
      '/documents-live',
      upgradeWebSocket(async c =>
        provideExecutionContext(
          createExecutionContext({
            contextId: `req_${generatePlainId(20)}`,
            type: 'request',
            ip: extractIp(c.req.raw.headers as any) ?? '0.0.0.0',
            userAgent: c.req.raw.headers.get('user-agent') ?? 'unknown'
          }),
          async () => {
            let url = new URL(c.req.url);
            let documentId = getQueryParam(url, ['documentId', 'document_id']);
            let instanceId = getQueryParam(url, ['instanceId', 'instance_id']);
            let organizationId = getQueryParam(url, ['organizationId', 'organization_id']);
            let editToken = getQueryParam(url, ['editToken', 'edit_token']);

            if (!documentId) {
              throw new ServiceError(
                badRequestError({
                  message: 'Missing documentId query parameter'
                })
              );
            }

            let target = await resolveDocumentsLiveTarget({
              req: c.req.raw,
              url,
              documentId,
              instanceId,
              organizationId,
              editToken,
              authenticateRequest
            });

            if (!target.cargoAccess?.accessActor) {
              throw new ServiceError(
                forbiddenError({
                  message: 'Actor context is required',
                  description:
                    'Live document connections require an organization actor or consumer actor context.'
                })
              );
            }

            await documentService.getDocumentById({
              owner: target.owner,
              documentId,
              ...target.cargoAccess
            });

            let { actorId } = await resolveCargoAccess({
              owner: target.owner,
              ...target.cargoAccess
            });
            if (!actorId) {
              throw new ServiceError(
                forbiddenError({
                  message: 'Actor context is required'
                })
              );
            }

            let upstreamUrl = getCargoDocumentLiveUrl({
              actorId,
              documentId
            });
            let upstream: WebSocket | null = null;
            let clientWs: any = null;
            let pendingMessages: string[] = [];

            let flushPendingMessages = () => {
              if (!upstream || upstream.readyState !== WebSocket.OPEN) return;

              for (let message of pendingMessages) {
                upstream.send(message);
              }
              pendingMessages = [];
            };

            return {
              onOpen: async (_, ws) => {
                clientWs = ws;
                upstream = new WebSocket(upstreamUrl);

                upstream.onopen = () => {
                  flushPendingMessages();
                };

                upstream.onmessage = event => {
                  ws.send(typeof event.data === 'string' ? event.data : event.data.toString());
                };

                upstream.onerror = () => {
                  pendingMessages = [];
                  try {
                    ws.close(1011, 'upstream_error');
                  } catch {}
                };

                upstream.onclose = event => {
                  pendingMessages = [];
                  try {
                    ws.close(event.code || 1000, event.reason);
                  } catch {}
                };
              },

              onMessage: async event => {
                let message = event.data.toString();

                if (upstream?.readyState === WebSocket.OPEN) {
                  upstream.send(message);
                  return;
                }

                if (!upstream || upstream.readyState === WebSocket.CONNECTING) {
                  pendingMessages.push(message);
                  return;
                }

                try {
                  clientWs?.close(1011, 'upstream_unavailable');
                } catch {}
              },

              onClose: async () => {
                pendingMessages = [];
                if (!upstream) return;
                if (
                  upstream.readyState === WebSocket.OPEN ||
                  upstream.readyState === WebSocket.CONNECTING
                ) {
                  upstream.close();
                }
              },

              onError: async () => {
                pendingMessages = [];
                if (!upstream) return;
                if (
                  upstream.readyState === WebSocket.OPEN ||
                  upstream.readyState === WebSocket.CONNECTING
                ) {
                  upstream.close();
                }
              }
            };
          }
        )
      )
    );

export let createFileUploadApi = (d?: FileApiOptions) => {
  let authenticateRequest = d?.authenticateRequest ?? authenticate;

  return createHono()
    .use(
      cors({
        origin: o => o,
        allowMethods: ['POST', 'OPTIONS'],
        allowHeaders: [
          'Authorization',
          'Content-Type',
          'metorial-version',
          'sentry-trace',
          'baggage',
          'metorial-consumer-session-client-secret'
        ],
        credentials: true
      })
    )
    .post('/files', createFileUploadHandler(authenticateRequest));
};

export let createDocumentsLiveApi = (d?: FileApiOptions) => {
  let authenticateRequest = d?.authenticateRequest ?? authenticate;
  return createDocumentsLiveHandler(authenticateRequest);
};

export let createFileContentApi = () =>
  createHono()
    .use(
      cors({
        origin: o => o,
        allowMethods: ['GET', 'OPTIONS'],
        allowHeaders: [
          'Authorization',
          'Content-Type',
          'metorial-version',
          'sentry-trace',
          'baggage'
        ],
        credentials: true
      })
    )
    .get('/ping', () => new Response('OK'))
    .get('/files/:fileId/:key', getFileContentHandler);

export let fileUploadApi = createFileUploadApi();
export let fileContentApi = createFileContentApi();
export let documentsLiveApi = createDocumentsLiveApi();
