import type {
  DashboardInstanceProviderDeploymentsSetupSessionsCreateOutput,
  DashboardInstanceProviderDeploymentsSetupSessionsGetOutput,
  DashboardInstanceProvidersAuthMethodsListOutput
} from '@metorial/dashboard-sdk';

export type AuthMethod = DashboardInstanceProvidersAuthMethodsListOutput['items'][number];
export type CredentialsMode = 'existing' | 'new';
export type SetupSessionState =
  | DashboardInstanceProviderDeploymentsSetupSessionsCreateOutput
  | DashboardInstanceProviderDeploymentsSetupSessionsGetOutput;

export type ProviderSetupSessionEmbedProps = {
  instanceId: string;
  providerId: string;
  deploymentId?: string;
  fixedCredentialId?: string;
  onComplete: (setupSession: DashboardInstanceProviderDeploymentsSetupSessionsGetOutput | null) => void;
  onCancel?: () => void;
  cancelLabel?: string;
  onWindowOpenCancel?: () => void;
  windowOpenCancelLabel?: string;
  onWindowOpenStateChange?: (isOpen: boolean) => void;
  initialMethodId?: string;
  hideMethodStep?: boolean;
  onBackToMethodSelection?: () => void;
  showMethodStepInStepper?: boolean;
  hideCredentialsIntro?: boolean;
  flattenOAuthCredentialsFlow?: boolean;
  showExternalPreviewSidebar?: boolean;
  collectAuthConfigDetails?: boolean;
  initialAuthConfigDetails?: {
    name?: string;
    description?: string;
  };
  autoStartManagedCredentialSetup?: boolean;
  onAuthConfigDetailsChange?: (details: { name: string; description: string }) => void;
  onPreviewCredentialTypeChange?: (type: 'managed' | 'manual') => void;
  onPreviewModeChange?: (mode: 'managed' | 'manual_existing' | 'manual_new') => void;
  onActiveStepChange?: (step: 'method' | 'credentials' | 'connect') => void;
};
