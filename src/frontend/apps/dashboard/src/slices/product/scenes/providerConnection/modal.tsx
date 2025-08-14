import { ProviderOauthConnectionsGetOutput } from '@metorial/generated/src/mt_2025_01_01_dashboard';
import { Dialog, showModal } from '@metorial/ui';
import { useState } from 'react';
import { ProviderConnectionCreateForm } from './createForm';

export let showProviderConnectionFormModal = (p: {
  onCreate?: (deal: ProviderOauthConnectionsGetOutput) => any;
}) =>
  showModal(({ dialogProps, close }) => {
    let [modalSize, setModalSize] = useState<'default' | 'large'>('default');

    return (
      <Dialog.Wrapper {...dialogProps} width={modalSize == 'default' ? 650 : 800}>
        <Dialog.Title>Create OAuth Connection</Dialog.Title>

        <Dialog.Description>Let's create a new OAuth connection.</Dialog.Description>

        <ProviderConnectionCreateForm
          {...p}
          close={close}
          onCreate={p.onCreate}
          setModalSize={setModalSize}
        />
      </Dialog.Wrapper>
    );
  });
