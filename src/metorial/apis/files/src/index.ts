import { badRequestError, ServiceError } from '@lowerdeck/error';
import { createExecutionContext, provideExecutionContext } from '@lowerdeck/execution-context';
import { extractIp } from '@lowerdeck/forwarded-for';
import { Context, cors, createHono } from '@lowerdeck/hono';
import { authenticate } from '@metorial/auth';
import { createDocumentLiveApi } from '@metorial/module-documents/live';
import {
  getCargoFileContent,
  purposeSlugs,
  resolveCargoAccess,
  uploadCargoFile
} from '@metorial/module-file';
import { generatePlainId } from '@metorial/id';
import { websocket } from 'hono/bun';
import { resolveDocumentsLiveToken } from './documentsLiveAuth';
import { resolveUploadTarget } from './uploadAccess';
import { parseStoreReplace } from './uploadForm';

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
        let storeReplaceValue = body.get('store_replace');
        let title = (body.get('title') || undefined) as string | undefined;

        if (!file || !purpose) {
          throw new ServiceError(
            badRequestError({
              message: 'Missing file or purpose'
            })
          );
        }

        let fileNameFromStorePath =
          typeof attachedStorePath == 'string'
            ? attachedStorePath.split('/').filter(Boolean).at(-1)?.trim()
            : undefined;
        let fileName =
          typeof file.name == 'string' && file.name.trim()
            ? file.name.trim()
            : fileNameFromStorePath
              ? fileNameFromStorePath
              : typeof title == 'string' && title.trim()
                ? title.trim()
                : null;

        if (!fileName) {
          throw new ServiceError(
            badRequestError({
              message: 'Missing file name'
            })
          );
        }

        if (!purposeSlugs.includes(purpose as (typeof purposeSlugs)[number])) {
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

        let storeReplace = parseStoreReplace(
          storeReplaceValue,
          !!attachedStoreId && !!attachedStorePath
        );

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

        let access = await resolveCargoAccess({
          owner: target.owner,
          ...target.cargoAccess
        });
        let createdFile = await uploadCargoFile({
          ...access.scope,
          purpose,
          file,
          title,
          fileName,
          authorization: access.authorization,
          defaultPermissions: access.defaultPermissions,
          overridePermissions: access.overridePermissions,
          store:
            typeof attachedStoreId == 'string' && typeof attachedStorePath == 'string'
              ? {
                  id: attachedStoreId,
                  path: attachedStorePath,
                  replace: storeReplace
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

let getServedContentType = (contentType?: string | null) => {
  if (contentType?.startsWith('image/')) return contentType;
  return 'application/octet-stream';
};

let getDocumentContentType = (contentType?: string | null) =>
  contentType && contentType !== 'application/octet-stream'
    ? contentType
    : 'text/plain; charset=utf-8';

let getContentDispositionHeader = (fileName: string, disposition: 'inline' | 'attachment') => {
  let fallbackName = fileName.replace(/["\\\r\n]/g, '_').replace(/[^\x20-\x7e]/g, '_');
  return `${disposition}; filename="${fallbackName}"; filename*=UTF-8''${encodeURIComponent(fileName)}`;
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

  let { file, link, content, metadata } = await getCargoFileContent({
    fileId,
    key
  });

  let shouldDownload = new URL(c.req.url).searchParams.has('download');
  let fileName = file.fileName?.trim();
  let contentDisposition = fileName
    ? getContentDispositionHeader(fileName, shouldDownload ? 'attachment' : 'inline')
    : undefined;

  return new Response(content as any, {
    headers: {
      'Content-Type':
        metadata.source === 'document'
          ? getDocumentContentType(metadata.contentType)
          : getServedContentType(metadata.contentType),
      'Cache-Control':
        metadata.source === 'document' ||
        metadata.source === 'database' ||
        metadata.source === 'delegate' ||
        link.expiresAt
          ? 'private, no-store'
          : 'public, max-age=31536000, immutable',
      'X-Content-Type-Options': 'nosniff',
      ...(contentDisposition ? { 'Content-Disposition': contentDisposition } : {})
    }
  });
};

let getQueryParam = (url: URL, keys: string[]) => {
  for (let key of keys) {
    let value = url.searchParams.get(key);
    if (value) return value;
  }

  return null;
};

let createDocumentsLiveHandler = () =>
  createHono()
    .use(async (c, next) => {
      c.res.headers.set('Access-Control-Allow-Origin', c.req.header('Origin') || '*');
      c.res.headers.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
      c.res.headers.set(
        'Access-Control-Allow-Headers',
        'Content-Type, baggage, sentry-trace, metorial-client'
      );
      c.res.headers.set('Access-Control-Max-Age', '86400');

      if (c.req.method === 'OPTIONS') {
        return c.text('OK', 200);
      }

      await next();
    })
    .options('*', c => c.text(''))
    .route(
      '/',
      createDocumentLiveApi({
        path: '/documents-live',
        resolveConnection: async ({ request, url }) => {
          return await provideExecutionContext(
            createExecutionContext({
              contextId: `req_${generatePlainId(20)}`,
              type: 'request',
              ip: extractIp(request.headers as any) ?? '0.0.0.0',
              userAgent: request.headers.get('user-agent') ?? 'unknown'
            }),
            async () => {
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
              if (!editToken) {
                throw new ServiceError(
                  badRequestError({ message: 'Missing edit_token query parameter' })
                );
              }

              return await resolveDocumentsLiveToken({
                editToken,
                documentId,
                instanceId,
                organizationId
              });
            }
          );
        },
        resolveToken: async ({ token, documentId, instanceId, organizationId }) =>
          await resolveDocumentsLiveToken({
            editToken: token,
            documentId,
            instanceId,
            organizationId
          })
      })
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

export let createDocumentsLiveApi = () => createDocumentsLiveHandler();

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
