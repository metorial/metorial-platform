import { Dialog, Button, showModal, Spacer } from '@metorial/ui';
import { type ReactNode } from 'react';
import { showProviderAuthConfigCreateModal } from '../../../scenes/providerAuthConfigs/modal';
import { showProviderAuthCredentialsFormModal } from '../../../scenes/providerAuthCredentials/modal';
import { showProviderConfigVaultFormModal } from '../../../scenes/providerConfigVaults/modal';
import { showProviderConfigFormModal } from '../../../scenes/providerConfigs/modal';
import { ProviderDeploymentsList } from '../../../scenes/providerDeployments/list';
import { ProvidersWithDeploymentsSearch } from '../../../scenes/providers/search';

let PickerDialogScaffold = ({
  title,
  description,
  close,
  onBack,
  children
}: {
  title: string;
  description: string;
  close: () => void;
  onBack?: () => void;
  children: ReactNode;
}) => {
  let hasFooterActions = !!onBack;

  return (
    <>
      <Dialog.Title>{title}</Dialog.Title>
      <Dialog.Description>{description}</Dialog.Description>

      <Spacer size={10} />

      {children}

      {hasFooterActions && (
        <>
          <Spacer size={10} />

          <Dialog.Actions>
            <Button
              size="2"
              variant="outline"
              onClick={() => {
                close();
                onBack();
              }}
            >
              Back
            </Button>
          </Dialog.Actions>
        </>
      )}
    </>
  );
};

let DeploymentPicker = ({
  title,
  description,
  close,
  onSelect,
  onBack,
  providerId,
  selectionMode = 'default'
}: {
  title: string;
  description: string;
  close: () => void;
  onSelect: (deploymentId: string) => void;
  onBack?: () => void;
  providerId?: string;
  selectionMode?:
    | 'default'
    | 'configCreate'
    | 'configVaultCreate'
    | 'authConfigCreate'
    | 'authCredentialsCreate';
}) => {
  return (
    <PickerDialogScaffold
      title={title}
      description={description}
      close={close}
      onBack={onBack}
    >
      <ProviderDeploymentsList
        providerId={providerId}
        selectionMode={selectionMode}
        searchable
        compact
        columns={3}
        limit={18}
        sectionLabel="Deployments"
        emptyText={
          providerId
            ? 'No deployments found for this provider.'
            : 'No deployments found. Create a deployment first.'
        }
        onDeploymentClick={deployment => {
          close();
          onSelect(deployment.id);
        }}
      />
    </PickerDialogScaffold>
  );
};

let ProviderPicker = ({
  instanceId,
  title,
  description,
  close,
  onSelect,
  selectionMode = 'default'
}: {
  instanceId: string;
  title: string;
  description: string;
  close: () => void;
  onSelect: (providerId: string) => void;
  selectionMode?: 'default' | 'authCredentialsCreate';
}) => {
  return (
    <PickerDialogScaffold title={title} description={description} close={close}>
      <ProvidersWithDeploymentsSearch
        instanceId={instanceId}
        columns={3}
        limit={18}
        selectionMode={selectionMode}
        emptyText="No providers found. Create a deployment first."
        onSelect={provider => {
          close();
          onSelect(provider.id);
        }}
      />
    </PickerDialogScaffold>
  );
};

let showPickerModal = (children: (d: { close: () => void }) => ReactNode) =>
  showModal(({ dialogProps, close }) => (
    <Dialog.Wrapper {...dialogProps} width={550}>
      {children({ close })}
    </Dialog.Wrapper>
  ));

export let showCreateProviderConfigFlow = (instanceId: string) =>
  showPickerModal(({ close }) => (
    <DeploymentPicker
      title="Create Config"
      description="Select a deployment to create a configuration for."
      close={close}
      selectionMode="configCreate"
      onSelect={deploymentId =>
        showProviderConfigFormModal({
          type: 'create',
          instanceId,
          providerDeploymentId: deploymentId,
          onBack: () => showCreateProviderConfigFlow(instanceId)
        })
      }
    />
  ));

export let showCreateProviderConfigVaultFlow = (instanceId: string) =>
  showPickerModal(({ close }) => (
    <DeploymentPicker
      title="Create Config Vault"
      description="Select a deployment to create a reusable config vault for."
      close={close}
      selectionMode="configVaultCreate"
      onSelect={deploymentId =>
        showProviderConfigVaultFormModal({
          type: 'create',
          instanceId,
          providerDeploymentId: deploymentId,
          onBack: () => showCreateProviderConfigVaultFlow(instanceId)
        })
      }
    />
  ));

export let showCreateProviderAuthCredentialsFlow = (instanceId: string) => {
  let showDeploymentStep = (providerId: string) =>
    showPickerModal(({ close }) => (
      <DeploymentPicker
        title="Select Deployment"
        description="Choose a deployment to associate these credentials with."
        close={close}
        selectionMode="authCredentialsCreate"
        providerId={providerId}
        onBack={() => showCreateProviderAuthCredentialsFlow(instanceId)}
        onSelect={deploymentId =>
          showProviderAuthCredentialsFormModal({
            instanceId,
            providerId,
            deploymentId,
            onBack: () => showDeploymentStep(providerId)
          })
        }
      />
    ));

  return showPickerModal(({ close }) => (
    <ProviderPicker
      instanceId={instanceId}
      title="Create Auth Credentials"
      description="Select a provider to create OAuth credentials for."
      close={close}
      selectionMode="authCredentialsCreate"
      onSelect={providerId => showDeploymentStep(providerId)}
    />
  ));
};

export let showCreateProviderAuthConfigFlow = (
  instanceId: string,
  options?: {
    onCreated?: (deploymentId: string, authConfigId: string) => void;
  }
) => {
  let showDeploymentStep = (providerId: string) =>
    showPickerModal(({ close }) => (
      <DeploymentPicker
        title="Select Deployment"
        description="Choose a deployment to attach this auth configuration to."
        close={close}
        selectionMode="authConfigCreate"
        providerId={providerId}
        onSelect={deploymentId =>
          showProviderAuthConfigCreateModal({
            instanceId,
            providerDeploymentId: deploymentId,
            onBack: () => showDeploymentStep(providerId),
            onCreate: authConfig => {
              options?.onCreated?.(deploymentId, authConfig.id);
            }
          })
        }
      />
    ));

  return showPickerModal(({ close }) => (
    <ProviderPicker
      instanceId={instanceId}
      title="Create Auth Config"
      description="Select a provider to create an authentication configuration for."
      close={close}
      onSelect={providerId => showDeploymentStep(providerId)}
    />
  ));
};
