import { useCreateIdentityCredential } from '@metorial/state';
import {
  ProviderConfigurationSelectionModalContent,
  showProviderConfigurationSelectionModal
} from '../providers/providerConfigurationSelectionModal';

let AddIdentityCredentialModalContent = ({
  instanceId,
  identityId,
  onComplete
}: {
  instanceId: string;
  identityId: string;
  onComplete: () => void;
}) => {
  let createMutation = useCreateIdentityCredential();

  return (
    <ProviderConfigurationSelectionModalContent
      instanceId={instanceId}
      saving={createMutation.isPending}
      mutationError={<createMutation.RenderError />}
      submitLabel="Add Credential"
      allowConfigVaultSelection={false}
      onSubmit={async values => {
        let [result, error] = await createMutation.mutate({
          instanceId,
          identityId,
          deploymentId: values.selectedDeploymentId,
          ...(values.selectedConfiguration.kind === 'config'
            ? {
                configId: values.selectedConfiguration.id
              }
            : {}),
          ...(values.selectedAuthConfigId
            ? {
                authConfigId: values.selectedAuthConfigId
              }
            : {})
        });

        if (result && !error) {
          onComplete();
          return { success: true };
        }

        return { error };
      }}
    />
  );
};

export let showAddIdentityCredentialModal = (p: {
  instanceId: string;
  identityId: string;
  onComplete: () => void;
}) =>
  showProviderConfigurationSelectionModal({
    title: 'Add Credential',
    description: 'Select a provider deployment and optional configuration for this identity.',
    render: close => (
      <AddIdentityCredentialModalContent
        instanceId={p.instanceId}
        identityId={p.identityId}
        onComplete={() => {
          p.onComplete();
          close();
        }}
      />
    )
  });
