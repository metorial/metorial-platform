import { DashboardInstanceIdentitiesDelegationRequestsCreateOutput } from '@metorial/dashboard-sdk';
import { Dialog, showModal } from '@metorial/ui';
import { IdentityDelegationRequestForm } from './delegationRequestForm';

export let showIdentityDelegationRequestFormModal = (p: {
  instanceId?: string;
  identityId: string;
  identityName?: string | null;
  onCreate?: (request: DashboardInstanceIdentitiesDelegationRequestsCreateOutput) => void;
}) =>
  showModal(({ dialogProps, close }) => (
    <Dialog.Wrapper {...dialogProps} width={560}>
      <Dialog.Title>Create Delegation Request</Dialog.Title>
      <Dialog.Description>
        Request delegated access for {p.identityName ?? 'this identity'}.
      </Dialog.Description>

      <IdentityDelegationRequestForm {...p} close={close} onCreate={p.onCreate} />
    </Dialog.Wrapper>
  ));
