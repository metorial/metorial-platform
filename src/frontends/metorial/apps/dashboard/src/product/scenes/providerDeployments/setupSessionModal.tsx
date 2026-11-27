import type { DashboardInstanceProviderDeploymentsSetupSessionsGetOutput } from '@metorial/dashboard-sdk';
import { useProvider } from '@metorial/state';
import { Dialog, showModal } from '@metorial/ui';
import { ProviderSetupSessionEmbed } from './setupSessionEmbed';

let ProviderSetupSessionDialogContent = (p: {
  instanceId: string;
  providerId: string;
  deploymentId: string;
  close: () => void;
  onComplete?: (
    result: DashboardInstanceProviderDeploymentsSetupSessionsGetOutput | null
  ) => void;
}) => {
  let provider = useProvider(p.instanceId, p.providerId);
  let providerName = provider.data?.name ?? 'provider';

  return (
    <>
      <Dialog.Title>Configure {providerName} Authentication</Dialog.Title>
      <Dialog.Description>
        Complete the {providerName} authentication flow to create a connection for this
        deployment.
      </Dialog.Description>

      <ProviderSetupSessionEmbed
        instanceId={p.instanceId}
        providerId={p.providerId}
        deploymentId={p.deploymentId}
        onComplete={result => {
          p.onComplete?.(result);
          p.close();
        }}
        onCancel={p.close}
      />
    </>
  );
};

export let showProviderSetupSessionModal = (p: {
  instanceId: string;
  providerId: string;
  deploymentId: string;
  onComplete?: (
    result: DashboardInstanceProviderDeploymentsSetupSessionsGetOutput | null
  ) => void;
}) =>
  showModal(({ dialogProps, close }) => {
    return (
      <Dialog.Wrapper {...dialogProps} width={700}>
        <ProviderSetupSessionDialogContent {...p} close={close} />
      </Dialog.Wrapper>
    );
  });
