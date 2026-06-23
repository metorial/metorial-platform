import { DashboardInstanceConsumersCreateOutput } from '@metorial/dashboard-sdk';
import { Dialog, showModal } from '@metorial/ui';
import { ConsumerForm } from './form';

export let showConsumerFormModal = (p: {
  instanceId?: string;
  onCreate?: (consumer: DashboardInstanceConsumersCreateOutput) => void;
}) =>
  showModal(({ dialogProps, close }) => (
    <Dialog.Wrapper {...dialogProps} width={550}>
      <Dialog.Title>Create Account</Dialog.Title>
      <Dialog.Description>
        Add an account to this instance so you can manage profiles across account surfaces.
      </Dialog.Description>

      <ConsumerForm {...p} close={close} onCreate={p.onCreate} />
    </Dialog.Wrapper>
  ));
