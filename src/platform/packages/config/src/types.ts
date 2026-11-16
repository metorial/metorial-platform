export interface MetorialConfig {
  redisUrl: string;
  rabbitmqUrl?: string;

  env: 'development' | 'production' | 'staging';

  urls: {
    getInviteUrl: (invite: {
      key: string;
      email?: string | null;
      enterpriseId?: string | null;
      type: 'email' | 'link' | 'enterprise';
    }) => string;
    apiUrl: string;
    appUrl: string;
    filesUrl: string;
    portalsUrl: string;
    publicMcpUrl: string | null;
  };

  encryptionSecret: string;
}
