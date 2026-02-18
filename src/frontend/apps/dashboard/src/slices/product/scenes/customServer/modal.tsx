import { Dialog, showModal } from '@metorial/ui';

export let showCustomServerRemoteFormModal = (_p: {
  type: 'remote' | 'managed' | 'docker';
  templateId?: string;
  onCreate?: (deal: unknown) => void;
}) =>
  showModal(({ dialogProps }) => {
    return (
      <Dialog.Wrapper {...dialogProps} width={650}>
        <Dialog.Title>Custom Server</Dialog.Title>
        <Dialog.Description>
          Custom server management has been moved to the provider API.
        </Dialog.Description>
      </Dialog.Wrapper>
    );
  });
