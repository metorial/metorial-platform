import { instanceProviderAuthConfigsLoader } from '@metorial/state';
import { ProviderSetupSessionEmbed } from '../providerDeployments/setupSessionEmbed';
import { AuthMethod } from './modalHelpers';
import { PreviewMode, SetupFlowLayout, SetupFlowPreviewSidebar } from './previewSidebar';

export let ProviderAuthConfigSetupFlowCreateContent = (p: {
  instanceId: string;
  providerDeploymentId?: string;
  providerId: string;
  providerName: string;
  providerImageUrl?: string | null;
  selectedMethod: AuthMethod;
  previewMode: PreviewMode;
  onPreviewModeChange: (mode: PreviewMode) => void;
  close: () => void;
  onCreate?: (authConfig: { id: string }) => void;
}) => {
  return (
    <SetupFlowLayout $showPreview={true}>
      <div>
        <ProviderSetupSessionEmbed
          instanceId={p.instanceId}
          providerId={p.providerId}
          deploymentId={p.providerDeploymentId}
          initialMethodId={p.selectedMethod.id}
          hideMethodStep
          hideCredentialsIntro
          showExternalPreviewSidebar
          collectAuthConfigDetails
          onPreviewModeChange={p.onPreviewModeChange}
          onPreviewCredentialTypeChange={() => {}}
          onActiveStepChange={() => {}}
          onComplete={result => {
            let authConfigId = result?.authConfig?.id;
            if (authConfigId) {
              instanceProviderAuthConfigsLoader.refetchAll();
              p.onCreate?.({ id: authConfigId });
            }
            p.close();
          }}
          onCancel={p.close}
        />
      </div>

      <SetupFlowPreviewSidebar
        instanceId={p.instanceId}
        providerName={p.providerName}
        providerId={p.providerId}
        providerImageUrl={p.providerImageUrl}
        showBrandingLink={p.previewMode !== 'managed'}
        previewMode={p.previewMode}
      />
    </SetupFlowLayout>
  );
};
