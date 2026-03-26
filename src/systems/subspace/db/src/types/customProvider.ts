export type CustomProviderFrom =
  | {
      type: 'container';
      repository: {
        imageRef: string;
        username?: string;
        password?: string;
      };
    }
  | {
      type: 'remote';
      remoteUrl: string;
      protocol: 'sse' | 'streamable_http';
      oauthConfig?: Record<string, any>;
    }
  | {
      type: 'function';
      env: Record<string, string>;
      runtime:
        | { identifier: 'nodejs'; version: '24.x' | '22.x' }
        | { identifier: 'python'; version: '3.14' | '3.13' | '3.12' };

      files?: {
        filename: string;
        content: string;
        encoding?: 'utf-8' | 'base64';
      }[];

      repository?:
        | {
            repositoryId: string;
            branch: string;
          }
        | {
            type: 'git';
            repositoryUrl: string;
            branch: string;
          };
    };

export type CustomProviderConfig = {
  schema: Record<string, any>;
  transformer: string;
};
