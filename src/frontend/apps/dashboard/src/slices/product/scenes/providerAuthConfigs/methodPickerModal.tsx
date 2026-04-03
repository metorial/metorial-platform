import { useProviderDeployment } from '@metorial/state';
import { Button, CenteredSpinner, Dialog, Select, Spacer, showModal } from '@metorial/ui';
import { useEffect, useMemo, useState } from 'react';
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
  let [selectedMethodId, setSelectedMethodId] = useState('');

  let handleBackOrClose = () => {
    if (p.onBack) {
      closeAndThen(p.close, p.onBack);
      return;
    }
    p.close();
  };

  let selectItems = useMemo(
    () =>
      authCreation.authMethodItems.map(method => ({
        id: method.id,
        label: method.name
      })),
    [authCreation.authMethodItems]
  );

  useEffect(() => {
    if (authCreation.isLoading || !authCreation.canCreateAuthConfig) return;
    if (authCreation.authMethodItems.length !== 1) return;

    closeAndThen(p.close, () =>
      showProviderAuthConfigCreateModal({
        instanceId: p.instanceId,
        providerDeploymentId: p.providerDeploymentId,
        providerId: p.providerId,
        initialAuthMethodId: authCreation.authMethodItems[0]!.id,
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

  let continueWithSelection = () => {
    if (!selectedMethodId) return;
    closeAndThen(p.close, () =>
      showProviderAuthConfigCreateModal({
        instanceId: p.instanceId,
        providerDeploymentId: p.providerDeploymentId,
        providerId: p.providerId,
        initialAuthMethodId: selectedMethodId,
        onCreate: p.onCreate,
        onBack: p.onBack
      })
    );
  };

  return (
    <>
      <Dialog.Title>Create Auth Config</Dialog.Title>
      <Dialog.Description>
        Choose an authentication method for {providerName}.
      </Dialog.Description>

      <Spacer size={10} />

      <Select
        label="Authentication method"
        placeholder="Select a method…"
        value={selectedMethodId}
        onChange={setSelectedMethodId}
        items={selectItems}
      />

      <Spacer height={12} />

      <Spacer size={15} />

      <Dialog.Actions>
        <Button type="button" variant="outline" size="2" onClick={handleBackOrClose}>
          {p.onBack ? 'Back' : 'Cancel'}
        </Button>
        <Button
          color="black"
          variant="solid"
          size="2"
          disabled={!selectedMethodId}
          onClick={continueWithSelection}
        >
          Continue
        </Button>
      </Dialog.Actions>
    </>
  );
};

export let showProviderAuthConfigMethodPickerModal = (
  p: Omit<ProviderAuthConfigCreateModalProps, 'initialAuthMethodId'>
) =>
  showModal(({ dialogProps, close }) => (
    <Dialog.Wrapper {...dialogProps} width={650}>
      <ProviderAuthConfigMethodPickerModalContent
        {...p}
        close={close}
        onCreate={p.onCreate}
        onBack={p.onBack}
      />
    </Dialog.Wrapper>
  ));
