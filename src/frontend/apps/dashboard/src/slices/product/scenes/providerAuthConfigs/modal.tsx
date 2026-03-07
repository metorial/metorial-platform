import { DashboardInstanceProviderDeploymentsAuthConfigsCreateOutput } from '@metorial/dashboard-sdk';
import { useProviderDeployment } from '@metorial/state';
import { Button, CenteredSpinner, Dialog, Spacer, Text, showModal } from '@metorial/ui';
import { useProviderAuthCreationCapabilities } from '../../lib/providerCreationCapabilities';
import { ProviderSetupSessionEmbed } from '../providerDeployments/setupSessionEmbed';
import { ProviderAuthConfigForm, ProviderAuthConfigFormProps } from './form';

export let showProviderAuthConfigFormModal = (
  p: ProviderAuthConfigFormProps & {
    onCreate?: (authConfig: DashboardInstanceProviderDeploymentsAuthConfigsCreateOutput) => void;
    onBack?: () => void;
  }
) =>
  showModal(({ dialogProps, close }) => (
    <Dialog.Wrapper {...dialogProps} width={650}>
      <Dialog.Title>
        {p.type == 'update' ? 'Update Auth Config' : 'Create Auth Config'}
      </Dialog.Title>

      <Dialog.Description>
        {p.type == 'update'
          ? 'Update the auth config details.'
          : 'Create a new authentication configuration for the selected provider.'}
      </Dialog.Description>

      <ProviderAuthConfigForm
        {...p}
        close={close}
        onCreate={p.onCreate}
        onBack={() => {
          close();
          p.onBack?.();
        }}
      />
    </Dialog.Wrapper>
  ));

let ProviderAuthConfigCreateModalContent = (p: {
  instanceId: string;
  providerDeploymentId: string;
  close: () => void;
  onCreate?: (authConfig: { id: string }) => void;
  onBack?: () => void;
}) => {
  let deployment = useProviderDeployment(p.instanceId, p.providerDeploymentId);
  let authCreation = useProviderAuthCreationCapabilities(
    p.instanceId,
    p.providerDeploymentId,
    deployment.data?.providerId
  );
  let providerName =
    authCreation.provider.data?.name ?? deployment.data?.name ?? 'provider';

  if (authCreation.isLoading) {
    return <CenteredSpinner />;
  }

  if (!authCreation.canCreateAuthConfig) {
    return (
      <>
        <Dialog.Title>Create Auth Config</Dialog.Title>
        <Dialog.Description>
          {authCreation.authConfigDisabledReason ??
            'This deployment cannot create an auth config from the dashboard.'}
        </Dialog.Description>

        <Spacer size={15} />

        <Dialog.Actions>
          <Button variant="outline" onClick={p.onBack ?? p.close}>
            Back
          </Button>
        </Dialog.Actions>
      </>
    );
  }

  if (!authCreation.hasManualAuthConfigMethod && authCreation.hasSetupAuthFlow) {
    let providerId = deployment.data?.providerId ?? authCreation.provider.data?.id;
    if (!providerId) {
      return (
        <>
          <Dialog.Title>Create Auth Config</Dialog.Title>
          <Dialog.Description>
            Could not resolve the provider for this deployment.
          </Dialog.Description>

          <Spacer size={15} />

          <Dialog.Actions>
            <Button variant="outline" onClick={p.onBack ?? p.close}>
              Back
            </Button>
          </Dialog.Actions>
        </>
      );
    }

    return (
      <>
        <Dialog.Title>Configure {providerName} Authentication</Dialog.Title>
        <Dialog.Description>
          Complete the {providerName} authentication flow to create an auth config
          for this deployment.
        </Dialog.Description>

        <ProviderSetupSessionEmbed
          instanceId={p.instanceId}
          providerId={providerId}
          deploymentId={p.providerDeploymentId}
          onComplete={result => {
            let authConfigId = result?.authConfig?.id;
            if (authConfigId) {
              p.onCreate?.({ id: authConfigId });
            }
            p.close();
          }}
          onCancel={p.close}
        />
      </>
    );
  }

  return (
    <>
      <Dialog.Title>Create Auth Config</Dialog.Title>
      <Dialog.Description>
        Create a new authentication configuration for the selected provider.
      </Dialog.Description>

      <ProviderAuthConfigForm
        type="create"
        instanceId={p.instanceId}
        providerDeploymentId={p.providerDeploymentId}
        close={p.close}
        onBack={() => {
          p.close();
          p.onBack?.();
        }}
        onCreate={authConfig => {
          p.onCreate?.({ id: authConfig.id });
        }}
      />
    </>
  );
};

export let showProviderAuthConfigCreateModal = (p: {
  instanceId: string;
  providerDeploymentId: string;
  onCreate?: (authConfig: { id: string }) => void;
  onBack?: () => void;
}) =>
  showModal(({ dialogProps, close }) => (
    <Dialog.Wrapper {...dialogProps} width={700}>
      <ProviderAuthConfigCreateModalContent
        {...p}
        close={close}
        onCreate={p.onCreate}
        onBack={p.onBack}
      />
    </Dialog.Wrapper>
  ));
