import { useProviderDeployment } from '@metorial/state';
import { Button, CenteredSpinner, Dialog, Spacer, showModal } from '@metorial/ui';
import { useEffect, useState } from 'react';
import { useProviderAuthCreationCapabilities } from '../../lib/providerCreationCapabilities';
import { ProviderAuthConfigManualCreateContent } from './createManualModal';
import { ProviderAuthConfigSetupFlowCreateContent } from './createSetupFlowModal';
import { closeAndThen, getAuthMethodHasSchema, isSetupFlowAuthMethod } from './modalHelpers';
import { PreviewMode } from './previewSidebar';

export type ProviderAuthConfigCreateModalProps = {
  instanceId: string;
  providerDeploymentId?: string;
  providerId?: string;
  initialAuthMethodId?: string;
  onCreate?: (authConfig: { id: string }) => void;
  onBack?: () => void;
};

let ProviderAuthConfigCreateModalContent = (
  p: ProviderAuthConfigCreateModalProps & {
    close: () => void;
  }
) => {
  let deployment = useProviderDeployment(p.instanceId, p.providerDeploymentId);
  let authCreation = useProviderAuthCreationCapabilities(
    p.instanceId,
    p.providerDeploymentId,
    p.providerId ?? deployment.data?.providerId
  );
  let isDeploymentScoped = !!p.providerDeploymentId;
  let providerName = authCreation.provider.data?.name ?? deployment.data?.name ?? 'provider';
  let providerId =
    p.providerId ?? deployment.data?.providerId ?? authCreation.provider.data?.id;
  let selectedMethod = authCreation.authMethodItems.find(
    method => method.id === p.initialAuthMethodId
  );
  let [previewMode, setPreviewMode] = useState<PreviewMode>(
    selectedMethod?.type === 'oauth' && !getAuthMethodHasSchema(selectedMethod)
      ? authCreation.oauthAutoRegistrationEnabled
        ? 'managed'
        : 'manual_existing'
      : 'manual_existing'
  );

  useEffect(() => {
    if (selectedMethod?.type === 'oauth' && !getAuthMethodHasSchema(selectedMethod)) {
      setPreviewMode(
        authCreation.oauthAutoRegistrationEnabled ? 'managed' : 'manual_existing'
      );
      return;
    }

    setPreviewMode('manual_existing');
  }, [authCreation.oauthAutoRegistrationEnabled, selectedMethod]);

  let handleBack = () => {
    if (!p.onBack) {
      p.close();
      return;
    }

    closeAndThen(p.close, p.onBack);
  };

  if (authCreation.isLoading) {
    return <CenteredSpinner />;
  }

  if (!authCreation.canCreateAuthConfig) {
    return (
      <>
        <Dialog.Title>Create Auth Config</Dialog.Title>
        <Dialog.Description>
          {authCreation.authConfigDisabledReason ??
            (isDeploymentScoped
              ? 'This deployment cannot create an auth config from the dashboard.'
              : 'This provider cannot create an auth config from the dashboard.')}
        </Dialog.Description>

        <Spacer size={15} />

        <Dialog.Actions>
          <Button variant="outline" onClick={handleBack}>
            Back
          </Button>
        </Dialog.Actions>
      </>
    );
  }

  if (!selectedMethod) {
    return (
      <>
        <Dialog.Title>Create Auth Config</Dialog.Title>
        <Dialog.Description>
          Authentication method selection now happens before this modal opens.
        </Dialog.Description>

        <Spacer size={15} />

        <Dialog.Actions>
          <Button variant="outline" onClick={handleBack}>
            Back
          </Button>
        </Dialog.Actions>
      </>
    );
  }

  if (isSetupFlowAuthMethod(selectedMethod)) {
    if (!providerId) {
      return (
        <>
          <Dialog.Title>Create Auth Config</Dialog.Title>
          <Dialog.Description>
            {isDeploymentScoped
              ? 'Could not resolve the provider for this deployment.'
              : 'Could not resolve the selected provider.'}
          </Dialog.Description>

          <Spacer size={15} />

          <Dialog.Actions>
            <Button variant="outline" onClick={handleBack}>
              Back
            </Button>
          </Dialog.Actions>
        </>
      );
    }

    return (
      <ProviderAuthConfigSetupFlowCreateContent
        instanceId={p.instanceId}
        providerDeploymentId={p.providerDeploymentId}
        providerId={providerId}
        providerName={providerName}
        providerImageUrl={authCreation.provider.data?.publisher.imageUrl}
        selectedMethod={selectedMethod}
        previewMode={previewMode}
        onPreviewModeChange={setPreviewMode}
        close={p.close}
        onCreate={p.onCreate}
      />
    );
  }

  return (
    <ProviderAuthConfigManualCreateContent
      instanceId={p.instanceId}
      providerDeploymentId={p.providerDeploymentId}
      providerId={providerId}
      initialAuthMethodId={selectedMethod.id}
      close={p.close}
      onBack={handleBack}
      onCreate={p.onCreate}
    />
  );
};

let ProviderAuthConfigCreateModalShell = (
  p: ProviderAuthConfigCreateModalProps & {
    dialogProps: {
      isOpen: boolean;
      onOpenChange: (isOpen: boolean) => void;
    };
    close: () => void;
  }
) => {
  let deployment = useProviderDeployment(p.instanceId, p.providerDeploymentId);
  let authCreation = useProviderAuthCreationCapabilities(
    p.instanceId,
    p.providerDeploymentId,
    p.providerId ?? deployment.data?.providerId
  );
  let selectedMethod =
    authCreation.authMethodItems.find(method => method.id === p.initialAuthMethodId) ??
    (authCreation.authMethodItems.length === 1 ? authCreation.authMethodItems[0] : undefined);
  let width = isSetupFlowAuthMethod(selectedMethod) ? 1180 : 650;

  return (
    <Dialog.Wrapper {...p.dialogProps} width={width}>
      <ProviderAuthConfigCreateModalContent
        instanceId={p.instanceId}
        providerDeploymentId={p.providerDeploymentId}
        providerId={p.providerId}
        initialAuthMethodId={p.initialAuthMethodId}
        close={p.close}
        onCreate={p.onCreate}
        onBack={p.onBack}
      />
    </Dialog.Wrapper>
  );
};

export let showProviderAuthConfigCreateModal = (p: ProviderAuthConfigCreateModalProps) =>
  showModal(({ dialogProps, close }) => (
    <ProviderAuthConfigCreateModalShell {...p} dialogProps={dialogProps} close={close} />
  ));
