import { DashboardInstanceIdentitiesDelegationConfigsCreateOutput } from '@metorial/dashboard-sdk';
import { Dialog, showModal } from '@metorial/ui';
import { IdentityDelegationConfigForm } from './delegationConfigForm';

export let showIdentityDelegationConfigFormModal = (p: {
  instanceId?: string;
  onCreate?: (
    delegationConfig: DashboardInstanceIdentitiesDelegationConfigsCreateOutput
  ) => void;
}) =>
  showModal(({ dialogProps, close }) => (
    <Dialog.Wrapper {...dialogProps} width={550}>
      <Dialog.Title>Create Delegation Config</Dialog.Title>
      <Dialog.Description>
        Create a delegation policy that controls sub-delegation behavior and depth.
      </Dialog.Description>

      <IdentityDelegationConfigForm {...p} close={close} onCreate={p.onCreate} />
    </Dialog.Wrapper>
  ));
