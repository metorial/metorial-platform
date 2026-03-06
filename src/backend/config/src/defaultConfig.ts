import { env } from './env';
import { MetorialConfig } from './types';

export let defaultConfig: MetorialConfig = {
  redisUrl: env.service.REDIS_URL,

  env: env.env.METORIAL_ENV,

  email: env.smtp.EMAIL_HOST
    ? {
        type: 'smtp',
        host: env.smtp.EMAIL_HOST!,
        port: env.smtp.EMAIL_PORT!,
        secure: env.smtp.EMAIL_SECURE!,
        auth: {
          user: env.smtp.EMAIL_USER!,
          pass: env.smtp.EMAIL_PASS!
        },
        fromEmail: env.smtp.EMAIL_FROM,
        fromName: env.smtp.EMAIL_FROM_NAME
      }
    : {
        type: 'ses',
        aws: env.smtp.EMAIL_SES_ACCESS_KEY_ID
          ? {
              accessKeyId: env.smtp.EMAIL_SES_ACCESS_KEY_ID!,
              secretAccessKey: env.smtp.EMAIL_SES_SECRET_ACCESS_KEY!,
              region: env.smtp.EMAIL_SES_REGION!
            }
          : undefined,
        fromEmail: env.smtp.EMAIL_FROM,
        fromName: env.smtp.EMAIL_FROM_NAME
      },

  urls: {
    getInviteUrl: invite => {
      let url = new URL(`${env.urls.APP_URL}/join?invite_key=${invite.key}`);
      if (invite.email) url.searchParams.set('email', invite.email);

      return url.toString();
    },

    apiUrl: env.urls.API_URL,
    appUrl: env.urls.APP_URL,
    mcpUrl: env.urls.MCP_URL,
    filesUrl: env.urls.API_URL,
    portalsUrl: env.urls.PORTALS_URL
  },

  objectStorage: {
    url: env.objectStorage.OBJECT_STORAGE_URL,
    filesBucketName: env.objectStorage.OSS_FILES_BUCKET_NAME
  },

  encryptionSecret: env.encryption.ENCRYPTION_SECRET
};
