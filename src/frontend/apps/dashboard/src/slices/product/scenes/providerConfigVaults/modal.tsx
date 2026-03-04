import { Dialog, showModal } from '@metorial/ui';
import { ProviderConfigVaultForm, ProviderConfigVaultFormProps } from './form';

export let showProviderConfigVaultFormModal = (
  p: ProviderConfigVaultFormProps & {
    onCreate?: (vault: any) => any;
    onBack?: () => void;
  }
) =>
  showModal(({ dialogProps, close }) => (
    <Dialog.Wrapper {...dialogProps} width={650}>
      <Dialog.Title>Create Config Vault</Dialog.Title>

      <Dialog.Description>
        Save a reusable set of configuration values for this deployment.
      </Dialog.Description>

      <ProviderConfigVaultForm
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
