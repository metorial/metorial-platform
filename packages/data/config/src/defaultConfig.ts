import { env } from './env';
import { MetorialConfig } from './types';

export let defaultConfig: MetorialConfig = {
  redisUrl: env.service.REDIS_URL,

  env:
    process.env.METORIAL_ENV == 'staging'
      ? 'staging'
      : process.env.NODE_ENV == 'development'
        ? 'development'
        : 'production',

  email: {
    type: 'smtp',
    host: env.smtp.EMAIL_HOST,
    port: env.smtp.EMAIL_PORT,
    secure: env.smtp.EMAIL_SECURE,
    auth: {
      user: env.smtp.EMAIL_USER,
      pass: env.smtp.EMAIL_PASS
    },
    fromEmail: env.smtp.EMAIL_FROM,
    fromName: env.smtp.EMAIL_FROM_NAME
  }
};
