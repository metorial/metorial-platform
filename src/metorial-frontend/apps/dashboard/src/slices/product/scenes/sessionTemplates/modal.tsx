import { DashboardInstanceSessionTemplatesCreateOutput } from '@metorial/dashboard-sdk';
import { Dialog, showModal } from '@metorial/ui';
import { SessionTemplateForm, SessionTemplateFormProps } from './form';

export let showSessionTemplateFormModal = (
  p: SessionTemplateFormProps & {
    onCreate?: (template: DashboardInstanceSessionTemplatesCreateOutput) => void;
  }
) =>
  showModal(({ dialogProps, close }) => (
    <Dialog.Wrapper {...dialogProps} width={650}>
      <Dialog.Title>
        {p.type == 'update' ? 'Update Template' : 'Create Session Template'}
      </Dialog.Title>

      <Dialog.Description>
        {p.type == 'update'
          ? 'Update the template details.'
          : 'Create a new session template for quick session creation.'}
      </Dialog.Description>

      <SessionTemplateForm {...p} close={close} onCreate={p.onCreate} />
    </Dialog.Wrapper>
  ));
