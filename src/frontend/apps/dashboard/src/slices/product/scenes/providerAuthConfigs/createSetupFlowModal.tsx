import { instanceProviderAuthConfigsLoader } from '@metorial/state';
import { Dialog, Spacer } from '@metorial/ui';
import { useState } from 'react';
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
  onCancel?: () => void;
  onWindowOpenStateChange?: (isOpen: boolean) => void;
  embedded?: boolean;
}) => {
  let [authPreviewDetails, setAuthPreviewDetails] = useState({ name: '', description: '' });

  return (
    <>
      {!p.embedded && (
        <>
          <Dialog.Title>Create Auth Config</Dialog.Title>
          <Dialog.Description>
            Set up OAuth credentials, name this connection, and preview how users will see the
            sign-in experience.
          </Dialog.Description>
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
            onAuthConfigDetailsChange={setAuthPreviewDetails}
            cancelLabel={p.onCancel ? 'Close' : 'Cancel'}
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
          previewAuthName={authPreviewDetails.name}
          previewAuthDescription={authPreviewDetails.description}
        />
      </SetupFlowLayout>
    </>
  );
};
