import { badRequestError, ServiceError } from '@lowerdeck/error';
import { createExecutionContext, provideExecutionContext } from '@lowerdeck/execution-context';
import { extractIp } from '@lowerdeck/forwarded-for';
import type { Context } from '@lowerdeck/hono';
import { cors, createHono } from '@lowerdeck/hono';
import { generatePlainId } from '@lowerdeck/id';
import { documentService } from '@metorial-cargo/module-doc';
import { getCargoFilesBucketName, getStorage } from '@metorial-cargo/module-file/storage';
import {
  environmentService,
  fileDownloadService,
  fileService,
  tenantService
} from './services';

let createFileUploadHandler = async (c: Context) =>
  provideExecutionContext(
    createExecutionContext({
      contextId: `req_${generatePlainId(20)}`,
      type: 'request',
      ip: extractIp(c.req.raw.headers as any) ?? '0.0.0.0',
      userAgent: c.req.raw.headers.get('user-agent') ?? 'unknown'
    }),
    async () => {
      let body = await c.req.formData();

      let file = body.get('file');
      let tenantId = body.get('tenantId');
      let environmentId = body.get('environmentId');
      let purpose = body.get('purpose');
      let actorId = body.get('actorId');
      let overridePermissions = body.get('overridePermissions');
      let attachedStoreId = body.get('attachedStoreId');
      let attachedStorePath = body.get('attachedStorePath');
      let defaultPermissions = body
        .getAll('defaultPermissions')
        .filter((value): value is string => typeof value == 'string');

      if (
        !(file instanceof File) ||
        typeof tenantId !== 'string' ||
        typeof environmentId !== 'string' ||
        typeof purpose !== 'string'
      ) {
        throw new ServiceError(
          badRequestError({
            message: 'Missing required upload fields'
          })
        );
      }

      if (!!attachedStoreId !== !!attachedStorePath) {
        throw new ServiceError(
          badRequestError({
            message: 'attachedStoreId and attachedStorePath must be provided together'
          })
        );
      }

      if (
        defaultPermissions.some(
          permission => permission !== 'content_read' && permission !== 'content_write'
        )
      ) {
        throw new ServiceError(
          badRequestError({
            message: 'Invalid defaultPermissions'
          })
        );
      }

      if (
        overridePermissions !== null &&
        typeof overridePermissions === 'string' &&
        overridePermissions !== 'true' &&
        overridePermissions !== 'false'
      ) {
        throw new ServiceError(
          badRequestError({
            message: 'Invalid overridePermissions'
          })
        );
      }

      let tenant = await tenantService.getTenantById({ id: tenantId });
      let environment = await environmentService.getEnvironmentById({
        tenant,
        id: environmentId
      });

      let storeId = (body.get('storeId') as string | null) ?? generatePlainId(20);

      await getStorage().putObject(
        getCargoFilesBucketName(),
        storeId,
        file,
        file.type ?? 'application/octet-stream'
      );

      let createdFile = await fileService.createFile({
        tenant,
        environment,
        purpose,
        storeId,
        input: {
          id: (body.get('fileId') as string | null) ?? undefined,
          name: file.name,
          mimeType: file.type ?? 'application/octet-stream',
          size: file.size,
          title: (body.get('title') as string | null) ?? undefined,
          actorId: typeof actorId == 'string' ? actorId : undefined,
          defaultPermissions: defaultPermissions.length
            ? (defaultPermissions as any)
            : undefined,
          overridePermissions:
            typeof overridePermissions == 'string'
              ? overridePermissions === 'true'
              : undefined,
          store:
            typeof attachedStoreId == 'string' && typeof attachedStorePath == 'string'
              ? {
                  id: attachedStoreId,
                  path: attachedStorePath
                }
              : undefined
        }
      });

      return c.json({
        object: 'cargo#file',
        id: createdFile.id,
        status: createdFile.status,
        fileName: createdFile.fileName,
        fileSize: createdFile.fileSize,
        fileType: createdFile.fileType,
        title: createdFile.title,
        purpose: {
          id: createdFile.purpose.id,
          slug: createdFile.purpose.slug,
          name: createdFile.purpose.name
        },
        createdAt: createdFile.createdAt,
        updatedAt: createdFile.updatedAt
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

let getContentDispositionHeader = (fileName: string) => {
  let fallbackName = fileName.replace(/["\\\r\n]/g, '_').replace(/[^\x20-\x7e]/g, '_');

  return `attachment; filename="${fallbackName}"; filename*=UTF-8''${encodeURIComponent(fileName)}`;
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

  let { link, file } = await fileDownloadService.getFileByDownloadKey({
    fileId,
    key
  });

  if (link.expiresAt && link.expiresAt < new Date()) {
    throw new ServiceError(
      badRequestError({
        message: 'Link has expired'
      })
    );
  }
  let shouldDownload = new URL(c.req.url).searchParams.has('download');
  let contentDisposition = shouldDownload
    ? getContentDispositionHeader(file.fileName)
    : undefined;

  let document = await documentService.getDocumentByFileId({
    fileId: file.id
  });
  if (document) {
    return new Response(document.resolvedContent ?? document.content.content, {
      headers: {
        'Content-Type': getDocumentContentType(file.fileType),
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
        ...(contentDisposition ? { 'Content-Disposition': contentDisposition } : {})
      }
    });
  }

  let res = await getStorage().getObject(getCargoFilesBucketName(), file.storeId);
  let contentType = getServedContentType(res.metadata.content_type ?? file.fileType);

  return new Response(res.data as any, {
    headers: {
      'Content-Type': contentType,
      'Cache-Control': link.expiresAt
        ? 'private, no-store'
        : 'public, max-age=31536000, immutable',
      'X-Content-Type-Options': 'nosniff',
      ...(contentDisposition ? { 'Content-Disposition': contentDisposition } : {})
    }
  });
};

export let createCargoUploadApi = () =>
  createHono()
    .use(
      cors({
        origin: o => o,
        allowMethods: ['POST', 'OPTIONS'],
        allowHeaders: ['Authorization', 'Content-Type', 'sentry-trace', 'baggage'],
        credentials: true
      })
    )
    .post('/files', createFileUploadHandler);

export let createCargoContentApi = () =>
  createHono()
    .use(
      cors({
        origin: o => o,
        allowMethods: ['GET', 'OPTIONS'],
        allowHeaders: ['Authorization', 'Content-Type', 'sentry-trace', 'baggage'],
        credentials: true
      })
    )
    .get('/ping', () => new Response('OK'))
    .get('/files/:fileId/:key', getFileContentHandler);

export let cargoUploadApi = createCargoUploadApi();
export let cargoContentApi = createCargoContentApi();
