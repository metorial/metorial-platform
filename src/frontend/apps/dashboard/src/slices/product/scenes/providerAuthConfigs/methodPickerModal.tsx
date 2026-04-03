import { useProviderDeployment } from '@metorial/state';
import { Button, CenteredSpinner, Dialog, Spacer, showModal } from '@metorial/ui';
import { useEffect } from 'react';
import { useProviderAuthCreationCapabilities } from '../../lib/providerCreationCapabilities';
import { closeAndThen } from './modalHelpers';
import {
  ProviderAuthConfigCreateModalProps,
  showProviderAuthConfigCreateModal
} from './createModal';

let ProviderAuthConfigMethodPickerModalContent = (
  p: Omit<ProviderAuthConfigCreateModalProps, 'initialAuthMethodId'> & {
    close: () => void;
  }
) => {
  let deployment = useProviderDeployment(p.instanceId, p.providerDeploymentId);
  let authCreation = useProviderAuthCreationCapabilities(
    p.instanceId,
    p.providerDeploymentId,
    p.providerId ?? deployment.data?.providerId
  );
  let providerName = authCreation.provider.data?.name ?? deployment.data?.name ?? 'provider';

  let handleBackOrClose = () => {
    if (p.onBack) {
      closeAndThen(p.close, p.onBack);
      return;
    }
    p.close();
  };

  useEffect(() => {
    if (authCreation.isLoading || !authCreation.canCreateAuthConfig) return;
    if (authCreation.authMethodItems.length !== 1) return;

    closeAndThen(p.close, () =>
      showProviderAuthConfigCreateModal({
        instanceId: p.instanceId,
        providerDeploymentId: p.providerDeploymentId,
        providerId: p.providerId,
        initialAuthMethodId: authCreation.authMethodItems[0]?.id,
        onCreate: p.onCreate,
        onBack: p.onBack
      })
    );
  }, [
    authCreation.isLoading,
    authCreation.canCreateAuthConfig,
    authCreation.authMethodItems,
    p.close,
    p.instanceId,
    p.providerDeploymentId,
    p.providerId,
    p.onCreate,
    p.onBack
  ]);

  if (authCreation.isLoading) {
    return <CenteredSpinner />;
  }

  if (!authCreation.canCreateAuthConfig) {
    return (
      <>
        <Dialog.Title>Create Auth Config</Dialog.Title>
        <Dialog.Description>
          {authCreation.authConfigDisabledReason ??
            'Authentication cannot be configured for this provider right now.'}
        </Dialog.Description>

        <Spacer size={15} />

        <Dialog.Actions>
          <Button variant="outline" onClick={handleBackOrClose}>
            {p.onBack ? 'Back' : 'Close'}
          </Button>
        </Dialog.Actions>
      </>
    );
  }

  if (authCreation.authMethodItems.length <= 1) {
    return <CenteredSpinner />;
  }

  return (
    <>
      <Dialog.Title>Create Auth Config</Dialog.Title>
      <Dialog.Description>
        Choose an authentication method for {providerName}.
      </Dialog.Description>

      <Spacer size={15} />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {authCreation.authMethodItems.map(method => (
          <Button
            key={method.id}
            type="button"
            variant="outline"
            fullWidth
            onClick={() =>
              closeAndThen(p.close, () =>
                showProviderAuthConfigCreateModal({
                  instanceId: p.instanceId,
                  providerDeploymentId: p.providerDeploymentId,
                  providerId: p.providerId,
                  initialAuthMethodId: method.id,
                  onCreate: p.onCreate,
                  onBack: p.onBack
                })
              )
            }
          >
            {method.name}
          </Button>
        ))}
      </div>

      <Spacer size={15} />

      <Dialog.Actions>
        <Button variant="outline" onClick={handleBackOrClose}>
          {p.onBack ? 'Back' : 'Cancel'}
        </Button>
      </Dialog.Actions>
    </>
  );
};

export let showProviderAuthConfigMethodPickerModal = (
  p: Omit<ProviderAuthConfigCreateModalProps, 'initialAuthMethodId'>
) =>
  showModal(({ dialogProps, close }) => (
    <Dialog.Wrapper {...dialogProps} width={460}>
      <ProviderAuthConfigMethodPickerModalContent
        {...p}
        close={close}
        onCreate={p.onCreate}
        onBack={p.onBack}
      />
    </Dialog.Wrapper>
  ));
