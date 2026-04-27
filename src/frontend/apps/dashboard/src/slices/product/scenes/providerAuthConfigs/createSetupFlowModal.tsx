import { instanceProviderAuthConfigsLoader } from '@metorial/state';
import { Dialog, Spacer } from '@metorial/ui';
import { useState } from 'react';
import { ProviderSetupSessionEmbed } from '../providerDeployments/setupSessionEmbed';
import { AuthMethod } from './modalHelpers';
import { PreviewMode, SetupFlowLayout, SetupFlowPreviewSidebar } from './previewSidebar';

let getDefaultAuthDetails = (defaultAuthConfigName: string) => ({
  name: defaultAuthConfigName,
  description: ''
});

export let ProviderAuthConfigSetupFlowCreateContent = (p: {
  instanceId: string;
  providerDeploymentId?: string;
  providerId: string;
  providerName: string;
  providerImageUrl?: string | null;
  defaultAuthConfigName?: string;
  selectedMethod: AuthMethod;
  autoStartManagedCredentialSetup?: boolean;
  previewMode: PreviewMode;
  onPreviewModeChange: (mode: PreviewMode) => void;
  close: () => void;
  onCreate?: (authConfig: { id: string; name?: string | null }) => void;
  onCancel?: () => void;
  onWindowOpenStateChange?: (isOpen: boolean) => void;
  embedded?: boolean;
}) => {
  let defaultAuthDetails = getDefaultAuthDetails(p.defaultAuthConfigName ?? 'Provider Auth');
  let [authPreviewDetails, setAuthPreviewDetails] = useState(defaultAuthDetails);

  return (
    <>
      {!p.embedded && (
        <>
          <Dialog.Title>Create Auth Config</Dialog.Title>
          <Spacer size={12} />
        </>
      )}

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
            initialAuthConfigDetails={defaultAuthDetails}
            autoStartManagedCredentialSetup={p.autoStartManagedCredentialSetup}
            onAuthConfigDetailsChange={setAuthPreviewDetails}
            cancelLabel={p.onCancel ? 'Close' : 'Cancel'}
            onWindowOpenCancel={p.close}
            windowOpenCancelLabel="Cancel"
            onWindowOpenStateChange={p.onWindowOpenStateChange}
            onPreviewModeChange={p.onPreviewModeChange}
            onPreviewCredentialTypeChange={() => {}}
            onActiveStepChange={() => {}}
            onComplete={result => {
              if (result?.authConfig) {
                void instanceProviderAuthConfigsLoader.refetchAll();
                p.onCreate?.(result.authConfig);
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
          showBrandingLink
          previewMode={p.previewMode}
          previewAuthName={authPreviewDetails.name}
          previewAuthDescription={authPreviewDetails.description}
        />
      </SetupFlowLayout>
    </>
  );
};
