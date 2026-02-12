import { Dialog, showModal } from '@metorial/ui';
import { ProviderConfigForm, ProviderConfigFormProps } from './form';

export let showProviderConfigFormModal = (
  p: ProviderConfigFormProps & {
    onCreate?: (config: any) => any;
    onBack?: () => void;
  }
) =>
  showModal(({ dialogProps, close }) => (
    <Dialog.Wrapper {...dialogProps} width={650}>
      <Dialog.Title>
        {p.type == 'update' ? 'Update Config' : 'Create Config'}
      </Dialog.Title>

      <Dialog.Description>
        {p.type == 'update'
          ? 'Update the config details.'
          : 'Create a new configuration for this deployment.'}
      </Dialog.Description>

      <ProviderConfigForm
        {...p}
        close={close}
        onCreate={p.onCreate}
        onBack={() => {
          close();
          p.onBack?.();
        }}
      />
    </Dialog.Wrapper>
  ));
