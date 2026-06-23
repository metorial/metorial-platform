import { DashboardInstanceIdentitiesCreateOutput } from '@metorial/dashboard-sdk';
import { Dialog, showModal } from '@metorial/ui';
import { IdentityForm } from './identityForm';

export let showIdentityFormModal = (p: {
  instanceId?: string;
  actorId: string;
  actorName?: string;
  onCreate?: (identity: DashboardInstanceIdentitiesCreateOutput) => void;
}) =>
  showModal(({ dialogProps, close }) => (
    <Dialog.Wrapper {...dialogProps} width={550}>
      <Dialog.Title>Create Identity</Dialog.Title>
      <Dialog.Description>
        {p.actorName
          ? `Create a new identity for ${p.actorName}.`
          : 'Create a new identity for this actor.'}
      </Dialog.Description>

      <IdentityForm {...p} close={close} onCreate={p.onCreate} />
    </Dialog.Wrapper>
  ));
