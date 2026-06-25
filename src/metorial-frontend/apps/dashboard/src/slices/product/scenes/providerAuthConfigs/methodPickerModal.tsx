import { useForm } from '@metorial/data-hooks';
import { useProviderDeployment } from '@metorial/state';
import { Button, CenteredSpinner, Dialog, Spacer, showModal } from '@metorial/ui';
import { useEffect, useMemo, useRef } from 'react';
import { useProviderAuthCreationCapabilities } from '../../lib/providerCreationCapabilities';
import { AuthMethodPicker } from './authMethodPicker';
import { closeAndThen, getCreateMethodDescription } from './modalHelpers';
import {
  ProviderAuthConfigCreateModalProps,
  showProviderAuthConfigCreateModal
} from './createModal';

let lastSingleMethodAutoAdvance: { key: string; at: number } = { key: '', at: 0 };

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

  let onCreateRef = useRef(p.onCreate);
  let onBackRef = useRef(p.onBack);
  useEffect(() => {
    onCreateRef.current = p.onCreate;
    onBackRef.current = p.onBack;
  });

  let singleMethodId = useMemo(() => {
    if (authCreation.authMethodItems.length !== 1) return null;
    return authCreation.authMethodItems[0]?.id ?? null;
  }, [authCreation.authMethodItems.length, authCreation.authMethodItems[0]?.id]);

  let form = useForm({
    initialValues: {
      authMethodId: ''
    },
    onSubmit: async values => {
      form.setFieldTouched('authMethodId', true, false);
      await form.validateField('authMethodId');

      if (!values.authMethodId) return;

      closeAndThen(p.close, () =>
        showProviderAuthConfigCreateModal({
          instanceId: p.instanceId,
          providerDeploymentId: p.providerDeploymentId,
          providerId: p.providerId,
          initialAuthMethodId: values.authMethodId,
          defaultAuthConfigName: p.defaultAuthConfigName,
          autoStartManagedCredentialSetup: p.autoStartManagedCredentialSetup,
          onCreate: p.onCreate,
          onBack: p.onBack
        })
      );
    },
    schema: yup =>
      yup.object({
        authMethodId: yup.string().required('Authentication method is required')
      })
  });

  let handleBackOrClose = () => {
    if (p.onBack) {
      closeAndThen(p.close, p.onBack);
      return;
    }
    p.close();
  };

  useEffect(() => {
    if (authCreation.isLoading || !authCreation.canCreateAuthConfig) return;
    if (!singleMethodId) return;

    let dedupeKey = `${p.instanceId}:${p.providerDeploymentId ?? ''}:${singleMethodId}`;
    let now = Date.now();
    if (
      lastSingleMethodAutoAdvance.key === dedupeKey &&
      now - lastSingleMethodAutoAdvance.at < 600
    ) {
      return;
    }

    lastSingleMethodAutoAdvance = { key: dedupeKey, at: now };

    closeAndThen(p.close, () =>
      showProviderAuthConfigCreateModal({
        instanceId: p.instanceId,
        providerDeploymentId: p.providerDeploymentId,
        providerId: p.providerId,
        initialAuthMethodId: singleMethodId,
        defaultAuthConfigName: p.defaultAuthConfigName,
        autoStartManagedCredentialSetup: p.autoStartManagedCredentialSetup,
        onCreate: onCreateRef.current,
        onBack: onBackRef.current
      })
    );
  }, [
    authCreation.isLoading,
    authCreation.canCreateAuthConfig,
    singleMethodId,
    p.close,
    p.instanceId,
    p.providerDeploymentId,
    p.providerId
  ]);

  useEffect(() => {
    if (authCreation.isLoading || !authCreation.canCreateAuthConfig) return;
    if (form.values.authMethodId) return;

    let firstMethodId = authCreation.authMethodItems[0]?.id;
    if (!firstMethodId) return;

    form.setFieldValue('authMethodId', firstMethodId);
  }, [
    authCreation.isLoading,
    authCreation.canCreateAuthConfig,
    authCreation.authMethodItems.length,
    authCreation.authMethodItems[0]?.id,
    form.values.authMethodId,
    form.setFieldValue
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
            Close
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

      <form onSubmit={form.handleSubmit}>
        <Spacer size={10} />

        <AuthMethodPicker
          label="Authentication method"
          hideLabel
          focusOnMount
          value={form.values.authMethodId}
          onChange={value => {
            form.setFieldValue('authMethodId', value);
          }}
          items={authCreation.authMethodItems.map(method => ({
            id: method.id,
            name: method.name,
            description: method.description?.trim() || getCreateMethodDescription(method)
          }))}
        />

        <form.RenderError field="authMethodId" />

        <Spacer height={12} />

        <Spacer size={15} />

        <Dialog.Actions>
          <Button type="button" variant="outline" size="2" onClick={handleBackOrClose}>
            {p.onBack ? 'Close' : 'Cancel'}
          </Button>
          <Button
            type="submit"
            color="black"
            variant="solid"
            size="2"
            disabled={!form.values.authMethodId}
          >
            Continue
          </Button>
        </Dialog.Actions>
      </form>
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
