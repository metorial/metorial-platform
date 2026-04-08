import { useProviderDeployment } from '@metorial/state';
import { Button, CenteredSpinner, Dialog, Spacer, Text, showModal } from '@metorial/ui';
import { type ReactElement, useEffect, useState } from 'react';
import { useProviderAuthCreationCapabilities } from '../../lib/providerCreationCapabilities';
import { ProviderAuthConfigManualCreateContent } from './createManualModal';
import { ProviderAuthConfigSetupFlowCreateContent } from './createSetupFlowModal';
import { closeAndThen, isSetupFlowAuthMethod } from './modalHelpers';
import { PreviewMode } from './previewSidebar';

export type ProviderAuthConfigCreateModalProps = {
  instanceId: string;
  providerDeploymentId?: string;
  providerId?: string;
  initialAuthMethodId: string;
  onCreate?: (authConfig: { id: string }) => void;
  onBack?: () => void;
};

let ProviderAuthConfigCreateModalContent = (
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
  let selectedMethod = authCreation.authMethodItems.find(
    method => method.id === p.initialAuthMethodId
  );
  let effectiveAuthMethod =
    selectedMethod ??
    (authCreation.authMethodItems.length === 1 ? authCreation.authMethodItems[0] : undefined);

  let dialogWidth =
    effectiveAuthMethod && isSetupFlowAuthMethod(effectiveAuthMethod) ? 1180 : 650;

  let handleBack = () => {
    if (!p.onBack) {
      p.close();
      return;
    }

    closeAndThen(p.close, p.onBack);
  };

  return (
    <Dialog.Wrapper {...p.dialogProps} width={dialogWidth}>
      <ProviderAuthConfigCreateFlowContent {...p} close={p.close} onBack={handleBack} />
    </Dialog.Wrapper>
  );
};

export let ProviderAuthConfigCreateFlowContent = (
  p: ProviderAuthConfigCreateModalProps & {
    close: () => void;
    onBack: () => void;
    embedded?: boolean;
    onWindowOpenStateChange?: (isOpen: boolean) => void;
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
  let effectiveAuthMethod =
    selectedMethod ??
    (authCreation.authMethodItems.length === 1 ? authCreation.authMethodItems[0] : undefined);
  let [previewMode, setPreviewMode] = useState<PreviewMode>(
    effectiveAuthMethod?.type === 'oauth'
      ? authCreation.oauthAutoRegistrationEnabled
        ? 'managed'
        : 'manual_existing'
      : 'manual_existing'
  );

  useEffect(() => {
    if (effectiveAuthMethod?.type === 'oauth') {
      setPreviewMode(
        authCreation.oauthAutoRegistrationEnabled ? 'managed' : 'manual_existing'
      );
      return;
    }

    setPreviewMode('manual_existing');
  }, [authCreation.oauthAutoRegistrationEnabled, effectiveAuthMethod]);

  let content: ReactElement;

  let renderError = (message: string) =>
    p.embedded ? (
      <>
        <Text size="2" color="gray600">
          {message}
        </Text>
        <Spacer size={15} />
        <Dialog.Actions>
          <Button variant="outline" onClick={p.onBack}>
            Back
          </Button>
        </Dialog.Actions>
      </>
    ) : (
      <>
        <Dialog.Title>Create Auth Config</Dialog.Title>
        <Dialog.Description>{message}</Dialog.Description>
        <Spacer size={15} />
        <Dialog.Actions>
          <Button variant="outline" onClick={p.onBack}>
            Close
          </Button>
        </Dialog.Actions>
      </>
    );

  if (authCreation.isLoading) {
    content = <CenteredSpinner />;
  } else if (!authCreation.canCreateAuthConfig) {
    content = renderError(
      authCreation.authConfigDisabledReason ??
        (isDeploymentScoped
          ? 'This deployment cannot create an auth config from the dashboard.'
          : 'This provider cannot create an auth config from the dashboard.')
    );
  } else if (!effectiveAuthMethod) {
    content = renderError(
      'The selected authentication method is no longer available. Go back and choose another method.'
    );
  } else {
    let method = effectiveAuthMethod;

    if (isSetupFlowAuthMethod(method)) {
      if (!providerId) {
        content = renderError(
          isDeploymentScoped
            ? 'Could not resolve the provider for this deployment.'
            : 'Could not resolve the selected provider.'
        );
      } else {
        content = (
          <ProviderAuthConfigSetupFlowCreateContent
            instanceId={p.instanceId}
            providerDeploymentId={p.providerDeploymentId}
            providerId={providerId}
            providerName={providerName}
            providerImageUrl={authCreation.provider.data?.publisher.imageUrl}
            selectedMethod={method}
            previewMode={previewMode}
            onPreviewModeChange={setPreviewMode}
            close={p.close}
            onCreate={p.onCreate}
            onCancel={p.onBack}
            onWindowOpenStateChange={p.onWindowOpenStateChange}
          />
        );
      }
    } else {
      content = (
        <ProviderAuthConfigManualCreateContent
          instanceId={p.instanceId}
          providerDeploymentId={p.providerDeploymentId}
          providerId={providerId}
          initialAuthMethodId={method.id}
          close={p.close}
          onBack={p.onBack}
          onCreate={p.onCreate}
          embedded={p.embedded}
        />
      );
    }
  }

  return content;
};

export let showProviderAuthConfigCreateModal = (p: ProviderAuthConfigCreateModalProps) =>
  showModal(({ dialogProps, close }) => (
    <ProviderAuthConfigCreateModalContent {...p} dialogProps={dialogProps} close={close} />
  ));
