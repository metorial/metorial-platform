import { badRequestError, forbiddenError, ServiceError } from '@lowerdeck/error';
import { createExecutionContext, provideExecutionContext } from '@lowerdeck/execution-context';
import { extractIp } from '@lowerdeck/forwarded-for';
import { Context, cors, createHono } from '@lowerdeck/hono';
import { authenticate } from '@metorial/auth';
import { documentService } from '@metorial/cargo-module-doc';
import { createDocumentLiveApi } from '@metorial/cargo-module-doc/live';
import {
  getCargoFileContent,
  purposeSlugs,
  resolveCargoAccess,
  uploadCargoFile
} from '@metorial/cargo-module-file';
import { generatePlainId } from '@metorial/id';
import { websocket } from 'hono/bun';
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
          fileName: file.name,
          authorization: access.authorization,
          defaultPermissions: access.defaultPermissions,
          overridePermissions: access.overridePermissions,
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
        metadata.source === 'document' || link.expiresAt
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

              let target = await resolveDocumentsLiveTarget({
                req: request,
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

              let access = await resolveCargoAccess({
                owner: target.owner,
                ...target.cargoAccess
              });
              if (!access.actorId) {
                throw new ServiceError(
                  forbiddenError({ message: 'Actor context is required' })
                );
              }

              let document = await documentService.getDocumentById({
                ...access.scope,
                documentId,
                authorization: access.authorization,
                defaultPermissions: access.defaultPermissions,
                overridePermissions: access.overridePermissions
              });
              let permissions = await documentService.getDocumentPermissions({
                ...access.scope,
                document,
                authorization: access.authorization,
                defaultPermissions: access.defaultPermissions,
                overridePermissions: access.overridePermissions
              });

              return {
                documentId,
                actorId: access.actorId,
                accessTags: access.accessTags,
                defaultPermissions: access.defaultPermissions,
                overridePermissions: access.overridePermissions,
                canWrite:
                  target.canWrite &&
                  !document.isReadOnly &&
                  (permissions.hasFullAccess ||
                    permissions.permissions.includes('content_write'))
              };
            }
          );
        }
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
