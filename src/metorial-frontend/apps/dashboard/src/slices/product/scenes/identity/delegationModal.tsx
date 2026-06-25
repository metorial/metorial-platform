import { DashboardInstanceIdentitiesDelegationsCreateOutput } from '@metorial/dashboard-sdk';
import { Dialog, showModal } from '@metorial/ui';
import { IdentityDelegationForm } from './delegationForm';

export let showIdentityDelegationFormModal = (p: {
  instanceId?: string;
  identityId: string;
  identityName?: string | null;
  onCreate?: (delegation: DashboardInstanceIdentitiesDelegationsCreateOutput) => void;
}) =>
  showModal(({ dialogProps, close }) => (
    <Dialog.Wrapper {...dialogProps} width={560}>
      <Dialog.Title>Create Delegation</Dialog.Title>
      <Dialog.Description>
        Create a new delegation for {p.identityName ?? 'this identity'}.
      </Dialog.Description>

      <IdentityDelegationForm {...p} close={close} onCreate={p.onCreate} />
    </Dialog.Wrapper>
  ));
