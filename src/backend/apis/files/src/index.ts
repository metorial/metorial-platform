import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { authenticate } from '@metorial/auth';
import { getConfig } from '@metorial/config';
import { badRequestError, forbiddenError, ServiceError } from '@metorial/error';
import { cors, createHono } from '@metorial/hono';
import { generatePlainId } from '@metorial/id';
import { fileService, purposeSlugs } from '@metorial/module-file';
import { organizationService } from '@metorial/module-organization';

let s3Config = getConfig().s3;
let s3Client = s3Config
  ? new S3Client({
      region: s3Config.region,
      endpoint: s3Config.endpoint,
      credentials: {
        accessKeyId: s3Config.accessKeyId,
        secretAccessKey: s3Config.secretAccessKey
      }
    })
  : null;

export let fileApi = createHono()
  .use(
    cors({
      origin: o => o,
      allowMethods: ['POST', 'OPTIONS'],
      allowHeaders: ['Authorization', 'Content-Type', 'metorial-version'],
      credentials: true
    })
  )
  .post('/files', async c => {
    let { auth } = await authenticate(c.req.raw, new URL(c.req.url));

    if (auth.type == 'machine' && auth.restrictions.type == 'instance') {
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

    if (!s3Client) {
      throw new ServiceError(
        badRequestError({
          message: 'File upload is not configured'
        })
      );
    }

    let storeId = generatePlainId(20);

    let command = new PutObjectCommand({
      Bucket: s3Config!.bucket,
      Key: storeId,
      Body: file.stream(),
      ContentType: file.type ?? 'application/octet-stream'
    });

    await s3Client.send(command);

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
  });
