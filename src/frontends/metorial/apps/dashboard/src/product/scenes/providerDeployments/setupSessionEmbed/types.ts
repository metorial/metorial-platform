import type {
  DashboardInstanceProviderDeploymentsSetupSessionsCreateOutput,
  DashboardInstanceProviderDeploymentsSetupSessionsGetOutput,
  DashboardInstanceProvidersAuthMethodsListOutput
} from '@metorial/state';

export type AuthMethod = DashboardInstanceProvidersAuthMethodsListOutput['items'][number];
export type CredentialsMode = 'existing' | 'new';
export type SetupSessionState =
  | DashboardInstanceProviderDeploymentsSetupSessionsCreateOutput
  | DashboardInstanceProviderDeploymentsSetupSessionsGetOutput;

export type ProviderSetupSessionEmbedProps = {
  instanceId: string;
  providerId: string;
  deploymentId?: string;
  onComplete: (setupSession: DashboardInstanceProviderDeploymentsSetupSessionsGetOutput | null) => void;
  onCancel?: () => void;
  cancelLabel?: string;
};
