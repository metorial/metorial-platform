import { authConfigPresenter, AuthConfigData } from './authConfig';
import { authCredentialsPresenter, AuthCredentialsData } from './authCredentials';
import { authMethodPresenter, AuthMethodData } from './authMethod';
import { configPresenter, ConfigData } from './config';
import { deploymentPreviewPresenter } from './deployment';

export type SetupSessionDeploymentData = {
  id: string;
  isEphemeral: boolean;
  isDefault: boolean;
  name: string | null;
  description: string | null;
  metadata: unknown;
  providerId: string;
  createdAt: Date;
  updatedAt: Date;
};

export type SetupSessionData = {
  id: string;
  type: string;
  status: string;
  url: string;
  name: string | null;
  description: string | null;
  metadata: unknown;
  providerId: string;
  authMethod: AuthMethodData;
  deployment: SetupSessionDeploymentData | null;
  credentials: AuthCredentialsData | null;
  authConfig: AuthConfigData | null;
  config: ConfigData | null;
  uiMode: string;
  redirectUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
  expiresAt: Date;
};

export let setupSessionPresenter = (session: SetupSessionData) => ({
  object: 'provider.setup_session' as const,
  id: session.id,
  type: session.type,
  status: session.status,
  url: session.url,
  name: session.name,
  description: session.description,
  metadata: session.metadata,
  providerId: session.providerId,
  authMethod: authMethodPresenter(session.authMethod),
  deployment: session.deployment ? deploymentPreviewPresenter(session.deployment) : null,
  credentials: session.credentials ? authCredentialsPresenter(session.credentials) : null,
  authConfig: session.authConfig ? authConfigPresenter(session.authConfig) : null,
  config: session.config ? configPresenter(session.config) : null,
  uiMode: session.uiMode,
  redirectUrl: session.redirectUrl,
  createdAt: session.createdAt,
  updatedAt: session.updatedAt,
  expiresAt: session.expiresAt
});
