import { DashboardInstanceIdentityActorsCreateOutput } from '@metorial/dashboard-sdk';
import { Dialog, showModal } from '@metorial/ui';
import { IdentityActorForm } from './actorForm';

export let showIdentityActorFormModal = (p: {
  instanceId?: string;
  onCreate?: (actor: DashboardInstanceIdentityActorsCreateOutput) => void;
}) =>
  showModal(({ dialogProps, close }) => (
    <Dialog.Wrapper {...dialogProps} width={550}>
      <Dialog.Title>Create Identity Actor</Dialog.Title>
      <Dialog.Description>
        Create a new actor that can own identities and participate in delegations.
      </Dialog.Description>

      <IdentityActorForm {...p} close={close} onCreate={p.onCreate} />
    </Dialog.Wrapper>
  ));
