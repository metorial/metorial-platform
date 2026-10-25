import { Dialog } from '@metorial/ui';
import { useState } from 'react';
import { ProviderAuthConfigForm } from './form';
import { getGeneratedAuthConfigName } from './modalHelpers';

export let ProviderAuthConfigManualCreateContent = (p: {
  instanceId: string;
  providerDeploymentId?: string;
  providerId?: string;
  providerName: string;
  initialAuthMethodId: string;
  defaultAuthConfigName?: string;
  source?: 'explorer';
  close: () => void;
  onCreate?: (authConfig: { id: string; name?: string | null }) => void;
  onBack?: () => void;
  embedded?: boolean;
}) => {
  let useFlatLayout = true;
  let [authConfigName] = useState(() =>
    getGeneratedAuthConfigName(p.defaultAuthConfigName, p.providerName)
  );

  return (
    <>
      {!p.embedded && (
        <>
          <Dialog.Title>Authenticate with {p.providerName}</Dialog.Title>
          <Dialog.Description>
            Enter the details {p.providerName} needs to connect.
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
        defaultName={authConfigName}
        hideDetailsInputs
        source={p.source}
        close={p.close}
        onBack={p.onBack}
        onCreate={authConfig => {
          p.onCreate?.({ id: authConfig.id, name: authConfig.name });
        }}
      />
    </>
  );
};
