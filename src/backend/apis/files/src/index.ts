import { badRequestError, forbiddenError, ServiceError } from '@lowerdeck/error';
import { createExecutionContext, provideExecutionContext } from '@lowerdeck/execution-context';
import { extractIp } from '@lowerdeck/forwarded-for';
import { cors, createHono } from '@lowerdeck/hono';
import { authenticate } from '@metorial/auth';
import { generatePlainId } from '@metorial/id';
import { fileService, fileLinkService, purposeSlugs } from '@metorial/module-file';
import { organizationService } from '@metorial/module-organization';
import { getOssFilesBucketName, getStorage } from './storage';

type FileApiAuthResult = Awaited<ReturnType<typeof authenticate>>;

let fileApiRoutes = [
  {
    methods: ['POST', 'OPTIONS'],
    pattern: /^\/files$/
  },
  {
    methods: ['GET', 'OPTIONS'],
    pattern: /^\/files\/fil_[^/]+\/(?!links$)[^/]+$/
  }
];

export let shouldUseFileApi = (req: Request) => {
  let pathname = new URL(req.url).pathname;

  return fileApiRoutes.some(
    route => route.methods.includes(req.method) && route.pattern.test(pathname)
  );
};

export let createFileApi = (d?: {
  authenticateRequest?: (
    req: Request,
    url: URL
  ) => Promise<{
    auth: FileApiAuthResult['auth'];
  }>;
}) => {
  let authenticateRequest = d?.authenticateRequest ?? authenticate;

  return createHono()
    .use(
      cors({
        origin: o => o,
        allowMethods: ['GET', 'POST', 'OPTIONS'],
        allowHeaders: ['Authorization', 'Content-Type', 'metorial-version'],
        credentials: true
      })
    )
    .post('/files', async c =>
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
      )
    )
    .get('/files/:fileId/:key', async c => {
      let { fileId, key } = c.req.param();

      let { link, file } = await fileLinkService.getFileLinkByKey({
        fileId,
        key
      });

      if (link.expiresAt && link.expiresAt < new Date()) {
        throw new ServiceError(badRequestError({ message: 'Link has expired' }));
      }

      let res = await getStorage().getObject(getOssFilesBucketName(), file.storeId);

      return new Response(res.data, {
        headers: {
          'Content-Type': res.metadata.content_type ?? file.fileType,
          'Cache-Control': link.expiresAt
            ? 'private, no-store'
            : 'public, max-age=31536000, immutable'
        }
      });
    });
};

export let fileApi = createFileApi();
