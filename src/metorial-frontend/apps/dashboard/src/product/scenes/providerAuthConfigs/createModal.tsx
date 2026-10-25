import { useProviderDeployment } from '@metorial/state';
import { Button, CenteredSpinner, Dialog, Spacer, Text, showModal } from '@metorial/ui';
import type { ReactElement } from 'react';
import { useProviderAuthCreationCapabilities } from '../../lib/providerCreationCapabilities';
import { ProviderOAuthAuthenticateContent } from './authenticateContent';
import { ProviderAuthConfigManualCreateContent } from './createManualModal';
import { closeAndThen, isSetupFlowAuthMethod } from './modalHelpers';

export type ProviderAuthConfigCreateModalProps = {
  instanceId: string;
  providerDeploymentId?: string;
  providerId?: string;
  initialAuthMethodId: string;
  fixedAuthCredentialsId?: string;
  authMethodAdapter?: string;
  defaultAuthConfigName?: string;
  source?: 'explorer';
  onCreate?: (authConfig: { id: string; name?: string | null }) => void;
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
    p.providerId ?? deployment.data?.providerId,
    p.authMethodAdapter
  );
  let selectedMethod = authCreation.authMethodItems.find(
    method => method.id === p.initialAuthMethodId
  );
  let dialogWidth = !selectedMethod || isSetupFlowAuthMethod(selectedMethod) ? 560 : 650;

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
    cancelLabel?: string;
    onWindowOpenStateChange?: (isOpen: boolean) => void;
  }
) => {
  let deployment = useProviderDeployment(p.instanceId, p.providerDeploymentId);
  let authCreation = useProviderAuthCreationCapabilities(
    p.instanceId,
    p.providerDeploymentId,
    p.providerId ?? deployment.data?.providerId,
    p.authMethodAdapter
  );
  let isDeploymentScoped = !!p.providerDeploymentId;
  let providerName = authCreation.provider.data?.name ?? deployment.data?.name ?? 'Provider';
  let providerId =
    p.providerId ?? deployment.data?.providerId ?? authCreation.provider.data?.id;
  let selectedMethod =
    authCreation.authMethodItems.find(method => method.id === p.initialAuthMethodId) ??
    (authCreation.authMethodItems.length === 1 ? authCreation.authMethodItems[0] : undefined);

  let renderError = (message: string) => (
    <>
      {!p.embedded && <Dialog.Title>Authenticate with {providerName}</Dialog.Title>}
      {p.embedded ? (
        <Text size="2" color="gray600">
          {message}
        </Text>
      ) : (
        <Dialog.Description>{message}</Dialog.Description>
      )}
      <Spacer size={15} />
      <Dialog.Actions>
        <Button variant="outline" onClick={p.onBack}>
          {p.embedded ? 'Back' : 'Close'}
        </Button>
      </Dialog.Actions>
    </>
  );

  let content: ReactElement;

  if (authCreation.isLoading) {
    content = <CenteredSpinner />;
  } else if (!authCreation.canCreateAuthConfig) {
    content = renderError(
      authCreation.authConfigDisabledReason ??
        (isDeploymentScoped
          ? 'This deployment cannot be authenticated from the dashboard.'
          : 'This provider cannot be authenticated from the dashboard.')
    );
  } else if (!selectedMethod) {
    content = renderError(
      'The selected authentication method is no longer available. Go back and choose another method.'
    );
  } else if (isSetupFlowAuthMethod(selectedMethod)) {
    content = providerId ? (
      <ProviderOAuthAuthenticateContent
        instanceId={p.instanceId}
        providerId={providerId}
        providerDeploymentId={p.providerDeploymentId}
        method={selectedMethod}
        fixedAuthCredentialsId={p.fixedAuthCredentialsId}
        defaultAuthConfigName={p.defaultAuthConfigName}
        source={p.source}
        embedded={p.embedded}
        cancelLabel={p.cancelLabel}
        onCancel={p.onBack}
        onWindowOpenStateChange={p.onWindowOpenStateChange}
        onCreate={authConfig => {
          p.onCreate?.(authConfig);
          p.close();
        }}
      />
    ) : (
      renderError(
        isDeploymentScoped
          ? 'Could not resolve the provider for this deployment.'
          : 'Could not resolve the selected provider.'
      )
    );
  } else {
    content = (
      <ProviderAuthConfigManualCreateContent
        instanceId={p.instanceId}
        providerDeploymentId={p.providerDeploymentId}
        providerId={providerId}
        providerName={providerName}
        initialAuthMethodId={selectedMethod.id}
        defaultAuthConfigName={p.defaultAuthConfigName}
        source={p.source}
        close={p.close}
        onBack={p.onBack}
        onCreate={p.onCreate}
        embedded={p.embedded}
      />
    );
  }

  return content;
};

export let showProviderAuthConfigCreateModal = (p: ProviderAuthConfigCreateModalProps) =>
  showModal(({ dialogProps, close }) => (
    <ProviderAuthConfigCreateModalContent {...p} dialogProps={dialogProps} close={close} />
  ));
