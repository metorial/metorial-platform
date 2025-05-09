export interface MetorialConfig {
  redisUrl: string;

  env: 'development' | 'production' | 'staging';

  email: (
    | {
        type: 'ses';
        aws: {
          accessKeyId: string;
          secretAccessKey: string;
          region: string;
        };
      }
    | {
        type: 'smtp';
        host: string;
        port: number;
        secure: boolean;
        auth: {
          user: string;
          pass: string;
        };
      }
  ) & {
    fromEmail: string;
    fromName: string;
  };

  urls: {
    getInviteUrl: (invite: { key: string; email?: string | null }) => string;
    apiUrl: string;
    appUrl: string;
  };

  s3?: {
    accessKeyId: string;
    secretAccessKey: string;
    region: string;
    bucket: string;
    endpoint?: string;
  };
}
