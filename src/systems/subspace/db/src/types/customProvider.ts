export type CustomProviderFromContainer = {
  type: 'container';
  repository: {
    imageRef: string;
    username?: string;
    password?: string;
  };
};

export type CustomProviderFromRemote = {
  type: 'remote';
  remoteUrl: string;
  protocol: 'sse' | 'streamable_http';
  oauthConfig?: Record<string, any>;
};

export type CustomProviderFromFunction = {
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

export type CustomProviderFrom =
  | CustomProviderFromContainer
  | CustomProviderFromRemote
  | CustomProviderFromFunction;

export type CustomProviderFromUpdate =
  | CustomProviderFromContainer
  | CustomProviderFromRemote
  | (Omit<CustomProviderFromFunction, 'files' | 'env' | 'runtime'> & {
      runtime?: CustomProviderFromFunction['runtime'];
      env?: CustomProviderFromFunction['env'];
      files?: CustomProviderFromFunction['files'];
    });

export type CustomProviderConfig = {
  schema: Record<string, any>;
  transformer: string;
};
