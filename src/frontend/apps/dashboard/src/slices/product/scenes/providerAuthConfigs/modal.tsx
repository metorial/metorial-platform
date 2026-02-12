import { Dialog, showModal } from '@metorial/ui';
import { ProviderAuthConfigForm, ProviderAuthConfigFormProps } from './form';

export let showProviderAuthConfigFormModal = (
  p: ProviderAuthConfigFormProps & {
    onCreate?: (authConfig: any) => any;
    onBack?: () => void;
  }
) =>
  showModal(({ dialogProps, close }) => (
    <Dialog.Wrapper {...dialogProps} width={650}>
      <Dialog.Title>
        {p.type == 'update' ? 'Update Auth Config' : 'Create Auth Config'}
      </Dialog.Title>

      <Dialog.Description>
        {p.type == 'update'
          ? 'Update the auth config details.'
          : 'Create a new authentication configuration for the selected provider.'}
      </Dialog.Description>

      <ProviderAuthConfigForm
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
