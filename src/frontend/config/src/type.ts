export interface FrontendConfig {
  apiUrl: string;
  filesUrl?: string;
  publicApiUrl: string;

  environment: 'production' | 'staging' | 'development';

  auth: {
    authFrontendUrl?: string;
    loginPath: string;
    signupPath: string;
    logoutPath: string;
  };

  microFrontends?: {
    codeEditorUrl?: string;
  };
}

export let defaultConfig = {
  auth: {
    authFrontendUrl: undefined as string | undefined,
    loginPath: '/auth/login',
    signupPath: '/auth/signup',
    logoutPath: '/auth/logout'
  }
} satisfies Partial<FrontendConfig>;

type DefaultFrontendConfig = typeof defaultConfig;

export type RequiredFrontendConfig = Omit<FrontendConfig, keyof DefaultFrontendConfig> &
  Partial<DefaultFrontendConfig>;
