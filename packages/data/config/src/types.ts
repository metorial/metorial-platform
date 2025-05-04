export interface MetorialConfig {
  redisUrl: string;

  env: 'development' | 'production' | 'staging';

  email: (
    | {
        type: 'ses';
        aws: {
          accessKeyId: string;
          secretAccessKey: string;
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
}
