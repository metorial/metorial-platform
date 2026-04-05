import { ProviderSetupSessionEmbed } from '../providerDeployments/setupSessionEmbed';
import { AuthMethod } from './modalHelpers';
import { PreviewMode, SetupFlowLayout, SetupFlowPreviewSidebar } from './previewSidebar';
import { instanceProviderAuthConfigsLoader } from '@metorial/state';

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
  onCancel?: () => void;
  onWindowOpenStateChange?: (isOpen: boolean) => void;
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
          flattenOAuthCredentialsFlow
          showExternalPreviewSidebar
          collectAuthConfigDetails
          cancelLabel={p.onCancel ? 'Back' : 'Cancel'}
          onWindowOpenCancel={p.close}
          windowOpenCancelLabel="Cancel"
          onWindowOpenStateChange={p.onWindowOpenStateChange}
          onPreviewModeChange={p.onPreviewModeChange}
          onPreviewCredentialTypeChange={() => {}}
          onActiveStepChange={() => {}}
          onComplete={result => {
            let authConfigId = result?.authConfig?.id;
            if (authConfigId) {
              void instanceProviderAuthConfigsLoader.refetchAll();
              p.onCreate?.({ id: authConfigId });
            }
            p.close();
          }}
          onCancel={p.onCancel ?? p.close}
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
