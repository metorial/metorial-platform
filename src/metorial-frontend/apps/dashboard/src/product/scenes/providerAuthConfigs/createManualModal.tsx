import { Dialog } from '@metorial/ui';
import { ProviderAuthConfigForm } from './form';

export let ProviderAuthConfigManualCreateContent = (p: {
  instanceId: string;
  providerDeploymentId?: string;
  providerId?: string;
  initialAuthMethodId: string;
  defaultAuthConfigName?: string;
  close: () => void;
  onCreate?: (authConfig: { id: string; name?: string | null }) => void;
  onBack?: () => void;
  embedded?: boolean;
  hideDetailsInputs?: boolean;
}) => {
  let useFlatLayout = true;

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
        defaultName={p.defaultAuthConfigName}
        hideDetailsInputs={p.hideDetailsInputs}
        close={p.close}
        onBack={p.onBack}
        onCreate={authConfig => {
          p.onCreate?.({ id: authConfig.id, name: authConfig.name });
        }}
      />
    </>
  );
};
