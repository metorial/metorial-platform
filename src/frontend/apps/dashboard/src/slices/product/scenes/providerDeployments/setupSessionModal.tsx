import type { DashboardInstanceProviderDeploymentsSetupSessionsGetOutput } from '@metorial/dashboard-sdk';
import { Dialog, showModal } from '@metorial/ui';
import { ProviderSetupSessionEmbed } from './setupSessionEmbed';

export let showProviderSetupSessionModal = (p: {
  instanceId: string;
  providerId: string;
  deploymentId: string;
  onComplete?: (result: DashboardInstanceProviderDeploymentsSetupSessionsGetOutput | null) => void;
}) =>
  showModal(({ dialogProps, close }) => {
    return (
      <Dialog.Wrapper {...dialogProps} width={700}>
        <Dialog.Title>Configure Authentication</Dialog.Title>
        <Dialog.Description>
          Complete the authentication flow to create a connection for this deployment.
        </Dialog.Description>

        <ProviderSetupSessionEmbed
          instanceId={p.instanceId}
          providerId={p.providerId}
          deploymentId={p.deploymentId}
          onComplete={result => {
            p.onComplete?.(result);
            close();
          }}
          onCancel={close}
        />
      </Dialog.Wrapper>
    );
  });
