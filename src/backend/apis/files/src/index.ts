import { badRequestError, forbiddenError, ServiceError } from '@lowerdeck/error';
import { createExecutionContext, provideExecutionContext } from '@lowerdeck/execution-context';
import { extractIp } from '@lowerdeck/forwarded-for';
import { Context, cors, createHono } from '@lowerdeck/hono';
import { authenticate } from '@metorial/auth';
import { generatePlainId } from '@metorial/id';
import {
  fileLinkService,
  fileService,
  getOssFilesBucketName,
  getStorage,
  purposeSlugs
} from '@metorial/module-file';
import { organizationService } from '@metorial/module-organization';

type FileApiAuthResult = Awaited<ReturnType<typeof authenticate>>;

type FileApiOptions = {
  authenticateRequest?: (
    req: Request,
    url: URL
  ) => Promise<{
    auth: FileApiAuthResult['auth'];
  }>;
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

        if (
          auth.type == 'fine_grained' ||
          (auth.type == 'machine' && auth.restrictions.type == 'instance')
        ) {
          throw new ServiceError(
            forbiddenError({
              message: 'Instance API keys are not allowed to upload files'
            })
          );
        }

        let body = await c.req.formData();
        let file = body.get('file') as File;
        let purpose = body.get('purpose') as string;
        let organizationId = body.get('organization_id') as string;

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

        let storeId = generatePlainId(20);
        await getStorage().putObject(
          getOssFilesBucketName(),
          storeId,
          file,
          file.type ?? 'application/octet-stream'
        );

        let createdFile = await fileService.createFile({
          owner:
            auth.type == 'machine'
              ? {
                  type: 'organization',
                  organization: auth.restrictions.organization
                }
              : organizationId
                ? {
                    type: 'organization',
                    organization: (
                      await organizationService.getOrganizationByIdForUser({
                        organizationId,
                        user: auth.user
                      })
                    ).organization
                  }
                : {
                    type: 'user',
                    user: auth.user
                  },
          storeId,
          purpose,
          input: {
            name: file.name,
            mimeType: file.type ?? 'application/octet-stream',
            size: file.size
          }
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

let getFileContentHandler = async (c: Context) => {
  let { fileId, key } = c.req.param();

  let { link, file } = await fileLinkService.getFileLinkByKey({
    fileId,
    key
  });

  if (link.expiresAt && link.expiresAt < new Date()) {
    throw new ServiceError(badRequestError({ message: 'Link has expired' }));
  }

  let res = await getStorage().getObject(getOssFilesBucketName(), file.storeId);
  let contentType = getServedContentType(res.metadata.content_type ?? file.fileType);

  return new Response(res.data as any, {
    headers: {
      'Content-Type': contentType,
      'Cache-Control': link.expiresAt
        ? 'private, no-store'
        : 'public, max-age=31536000, immutable',
      'X-Content-Type-Options': 'nosniff'
    }
  });
};

export let createFileUploadApi = (d?: FileApiOptions) => {
  let authenticateRequest = d?.authenticateRequest ?? authenticate;

  return createHono()
    .use(
      cors({
        origin: o => o,
        allowMethods: ['POST', 'OPTIONS'],
        allowHeaders: ['Authorization', 'Content-Type', 'metorial-version'],
        credentials: true
      })
    )
    .post('/files', createFileUploadHandler(authenticateRequest));
};

export let createFileContentApi = () =>
  createHono()
    .use(
      cors({
        origin: o => o,
        allowMethods: ['GET', 'OPTIONS'],
        allowHeaders: ['Authorization', 'Content-Type', 'metorial-version'],
        credentials: true
      })
    )
    .get('/files/:fileId/:key', getFileContentHandler);

export let fileUploadApi = createFileUploadApi();
export let fileContentApi = createFileContentApi();
