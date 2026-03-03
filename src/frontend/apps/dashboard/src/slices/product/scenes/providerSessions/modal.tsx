import { DashboardInstanceSessionsCreateOutput } from '@metorial/dashboard-sdk';
import { Dialog, showModal } from '@metorial/ui';
import { ProviderSessionForm, ProviderSessionFormProps } from './form';

export let showProviderSessionFormModal = (
  p: ProviderSessionFormProps & {
    onCreate?: (session: DashboardInstanceSessionsCreateOutput) => void;
  }
) =>
  showModal(({ dialogProps, close }) => (
    <Dialog.Wrapper {...dialogProps} width={650}>
      <Dialog.Title>{p.type == 'update' ? 'Update Session' : 'Create Session'}</Dialog.Title>

      <Dialog.Description>
        {p.type == 'update'
          ? 'Update the session details.'
          : 'Create a new session with provider deployments.'}
      </Dialog.Description>

      <ProviderSessionForm {...p} close={close} onCreate={p.onCreate} />
    </Dialog.Wrapper>
  ));
