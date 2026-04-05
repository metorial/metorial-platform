import { useProviderDeployment } from '@metorial/state';
import { Dialog } from '@metorial/ui';
import { useProviderAuthCreationCapabilities } from '../../lib/providerCreationCapabilities';
import { ProviderAuthConfigForm } from './form';

export let ProviderAuthConfigManualCreateContent = (p: {
  instanceId: string;
  providerDeploymentId?: string;
  providerId?: string;
  initialAuthMethodId: string;
  close: () => void;
  onCreate?: (authConfig: { id: string }) => void;
  onBack?: () => void;
  embedded?: boolean;
}) => {
  let deployment = useProviderDeployment(p.instanceId, p.providerDeploymentId);
  let authCreation = useProviderAuthCreationCapabilities(
    p.instanceId,
    p.providerDeploymentId,
    p.providerId ?? deployment.data?.providerId
  );
  let selectedMethod = authCreation.authMethodItems.find(
    method => method.id === p.initialAuthMethodId
  );
  let isManualCredentialStyle =
    selectedMethod?.type === 'custom' || selectedMethod?.type === 'token';

  let useFlatLayout = !!p.embedded || !!p.providerDeploymentId || isManualCredentialStyle;

  return (
    <>
      {!p.embedded && (
        <>
          <Dialog.Title>Create Auth Config</Dialog.Title>
          <Dialog.Description>
            Create a new authentication configuration for the selected provider.
          </Dialog.Description>
        </>
      )}

      <ProviderAuthConfigForm
        type="create"
        instanceId={p.instanceId}
        providerDeploymentId={p.providerDeploymentId}
        providerId={p.providerId}
        initialAuthMethodId={p.initialAuthMethodId}
        hideAuthMethodStep
        flattenCreateStep={useFlatLayout}
        hideProviderContext={useFlatLayout}
        close={p.close}
        onBack={p.onBack}
        onCreate={authConfig => {
          p.onCreate?.({ id: authConfig.id });
        }}
      />
    </>
  );
};
