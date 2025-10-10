export let libOauthTs = `import { ProgrammablePromise } from '../promise.ts';

export let setOauthHandler = (c: {
  getAuthForm?: () => Promise<{
    fields: ({
      type: 'text' | 'password';
      label: string;
      key: string;
      isRequired?: boolean;
      placeholder?: string;
    } | {
      type: 'select';
      label: string;
      key: string;
      isRequired?: boolean;
      options: {
        label: string;
        value: string;
      }[]; 
    })[];
  }>;
  getAuthorizationUrl: (d: {
    fields: Record<string, string>;
    clientId: string;
    clientSecret: string;
    state: string;
    redirectUri: string;
  }) => Promise<string | {
    authorizationUrl: string;
    supportsPKCE?: boolean; 
  }>;
  handleCallback: (d: {
    fields: Record<string, string>;
    clientId: string;
    clientSecret: string;
    code: string;
    state: string;
    redirectUri: string;
    fullUrl: string;
  }) => Promise<{
    accessToken: string;
    refreshToken?: string;
    expiresIn?: number;
    scope?: string;
    tokenType?: string;
    [key: string]: any;
  }>;
  refreshAccessToken?: (data: { 
    refreshToken: string
    clientId: string;
    clientSecret: string;
  }) => Promise<{
    accessToken: string;
    refreshToken?: string;
    expiresIn?: number;
    scope?: string;
    tokenType?: string;
    [key: string]: any;
  }>;
}) => {
  if (c.getAuthorizationUrl === undefined) {
    throw new Error('getAuthorizationUrl is required');
  }
  if (c.handleCallback === undefined) {
    throw new Error('handleCallback is required');
  }

  globalThis.__metorial_setMcpAuth__({
    getAuthForm: c.getAuthForm,
    getAuthorizationUrl: c.getAuthorizationUrl,
    handleCallback: c.handleCallback,
    refreshAccessToken: c.refreshAccessToken,
  });
}
`;
