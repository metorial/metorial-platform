import { badRequestError, ServiceError } from '@lowerdeck/error';
import { createExecutionContext, provideExecutionContext } from '@lowerdeck/execution-context';
import { extractIp } from '@lowerdeck/forwarded-for';
import { Context, cors, createHono } from '@lowerdeck/hono';
import { authenticate } from '@metorial/auth';
import { createDocumentLiveApi } from '@metorial/module-documents/live';
import {
  fileRouterResolutionHeader,
  fileRouterResolutionValue,
  fileRouterSecretHeader,
  fileUploadService,
  getCargoFileContent,
  getCargoFileSignedDownload,
  isFileRouterRequest,
  purposeSlugs,
  resolveCargoAccess,
  uploadCargoFile,
  type FileRouterResolution
} from '@metorial/module-file';
import { generatePlainId } from '@metorial/id';
import { websocket } from 'hono/bun';
import { resolveDocumentsLiveToken } from './documentsLiveAuth';
import { resolveUploadTarget } from './uploadAccess';
import { assertDirectUploadBodySize, parseStoreReplace } from './uploadForm';
import { parseUploadMode, parseUploadRequest } from './uploadRequest';

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

type AuthInfo = FileApiAuthResult['auth'];

let presentFile = (file: {
  id: string;
  status: string;
  fileName: string;
  fileSize: number;
  fileType: string;
  title: string | null;
  purpose: { name: string; slug: string };
  createdAt: Date;
  updatedAt: Date;
}) => ({
  object: 'file',

  id: file.id,
  status: file.status,

  file_name: file.fileName,
  file_size: file.fileSize,
  file_type: file.fileType,

  title: file.title,

  purpose: {
    name: file.purpose.name,
    identifier: file.purpose.slug
  },

  created_at: file.createdAt,
  updated_at: file.updatedAt
});

let presentFileUpload = (
  upload: {
    id: string;
    status: string;
    fileName: string;
    fileSize: number;
    fileType: string;
    title: string | null;
    purpose: { name: string; slug: string };
    uploadUrlExpiresAt: Date;
    expiresAt: Date;
    createdAt: Date;
    updatedAt: Date;
  },
  uploadUrl: string
) => ({
  object: 'file_upload',

  id: upload.id,
  status: upload.status,

  file_name: upload.fileName,
  file_size: upload.fileSize,
  file_type: upload.fileType,

  title: upload.title,

  purpose: {
    name: upload.purpose.name,
    identifier: upload.purpose.slug
  },

  upload: {
    url: uploadUrl,
    method: 'PUT',
    expires_at: upload.uploadUrlExpiresAt
  },

  expires_at: upload.expiresAt,
  created_at: upload.createdAt,
  updated_at: upload.updatedAt
});

let handleDirectUpload = async (c: Context, auth: AuthInfo) => {
  assertDirectUploadBodySize(c.req.header('Content-Length'));

  let body = await c.req.formData();

  parseUploadMode(body.get('mode'));

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

  return c.json(presentFile(createdFile));
};

let handleJsonUpload = async (c: Context, auth: AuthInfo) => {
  let raw: unknown;

  try {
    raw = await c.req.json();
  } catch {
    throw new ServiceError(
      badRequestError({
        message: 'Invalid JSON body'
      })
    );
  }

  let body = parseUploadRequest(raw);

  let target = await resolveUploadTarget({
    auth,
    instanceId: body.instance_id ?? null,
    organizationId: body.organization_id ?? null
  });

  let access = await resolveCargoAccess({
    owner: target.owner,
    ...target.cargoAccess
  });

  if (body.mode === 'complete') {
    let file = await fileUploadService.completePendingUpload({
      ...access.scope,
      uploadId: body.file_upload_id,
      authorization: access.authorization,
      defaultPermissions: access.defaultPermissions,
      overridePermissions: access.overridePermissions
    });

    return c.json(presentFile(file));
  }

  if (body.store_id && !target.isInstanceOwner) {
    throw new ServiceError(
      badRequestError({
        message: 'Files can only be attached to stores when uploading to an instance'
      })
    );
  }

  let { upload, uploadUrl } = await fileUploadService.createPendingUpload({
    ...access.scope,
    purpose: body.purpose,
    authorization: access.authorization,
    defaultPermissions: access.defaultPermissions,
    overridePermissions: access.overridePermissions,
    input: {
      name: body.file_name,
      size: body.file_size,
      mimeType: body.file_type,
      title: body.title,
      store:
        body.store_id && body.path
          ? {
              id: body.store_id,
              path: body.path,
              replace: body.store_replace ?? false
            }
          : undefined
    }
  });

  return c.json(presentFileUpload(upload, uploadUrl));
};

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

        return c.req.header('Content-Type')?.includes('multipart/form-data')
          ? await handleDirectUpload(c, auth)
          : await handleJsonUpload(c, auth);
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

/**
 * The headers a file is served with, wherever the bytes come from. The router
 * replays these verbatim onto its own response, so this stays the single place
 * that decides content type, disposition and cacheability.
 */
let getFileContentHeaders = (d: {
  fileName?: string | null;
  contentType?: string | null;
  size?: number;
  source: 'document' | 'database' | 'object';
  isExpiring: boolean;
  shouldDownload: boolean;
}) => {
  let fileName = d.fileName?.trim();
  let contentDisposition = fileName
    ? getContentDispositionHeader(fileName, d.shouldDownload ? 'attachment' : 'inline')
    : undefined;

  return {
    'Content-Type':
      d.source === 'document'
        ? getDocumentContentType(d.contentType)
        : getServedContentType(d.contentType),
    // Streamed bodies would otherwise be chunked, leaving clients without a
    // total size to show progress against.
    ...(d.size !== undefined ? { 'Content-Length': String(d.size) } : {}),
    'Cache-Control':
      d.source === 'document' || d.source === 'database' || d.isExpiring
        ? 'private, no-store'
        : 'public, max-age=31536000, immutable',
    'X-Content-Type-Options': 'nosniff',
    ...(contentDisposition ? { 'Content-Disposition': contentDisposition } : {})
  };
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

  let shouldDownload = new URL(c.req.url).searchParams.has('download');

  // The router still forwards every request here first, so the link is checked
  // on each hit; it only takes over transferring the bytes.
  if (isFileRouterRequest(c.req.header(fileRouterSecretHeader))) {
    let resolved = await getCargoFileSignedDownload({ fileId, key });

    if (resolved) {
      let resolution: FileRouterResolution = {
        url: resolved.url,
        headers: getFileContentHeaders({
          fileName: resolved.file.fileName,
          contentType: resolved.file.fileType,
          size: resolved.file.fileSize,
          source: 'object',
          isExpiring: resolved.link.expiresAt != null,
          shouldDownload
        }),
        cacheKey: resolved.link.expiresAt
          ? null
          : `${resolved.file.id}/${resolved.file.storeId}`
      };

      return Response.json(resolution, {
        headers: {
          [fileRouterResolutionHeader]: fileRouterResolutionValue,
          // The body carries a signed URL; it must not be stored anywhere.
          'Cache-Control': 'private, no-store'
        }
      });
    }
  }

  let { file, link, content, metadata } = await getCargoFileContent({
    fileId,
    key
  });

  return new Response(content as any, {
    headers: getFileContentHeaders({
      fileName: file.fileName,
      contentType: metadata.contentType,
      size: metadata.size,
      source: metadata.source,
      isExpiring: link.expiresAt != null,
      shouldDownload
    })
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
