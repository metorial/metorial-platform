import { Button, Dialog, showModal, Spacer } from '@metorial/ui';
import React from 'react';

export type DeleteConfirmationModalProps = {
  title?: string;
  description?: string;
  onConfirm: () => void | Promise<void>;
  isOpen: boolean;
  onClose: () => void;
};

export let DeleteConfirmationModal = ({
  title = 'Confirm Delete',
  description = 'Are you sure you want to delete this item? This action cannot be undone.',
  onConfirm,
  isOpen,
  onClose
}: DeleteConfirmationModalProps) => {
  if (!isOpen) return null;

  let [isLoading, setIsLoading] = React.useState(false);

  let handleConfirm = async () => {
    setIsLoading(true);
    try {
      await onConfirm();
      onClose();
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog.Wrapper isOpen={isOpen} onOpenChange={open => !open && onClose()}>
      <Dialog.Title>{title}</Dialog.Title>
      <Dialog.Description>{description}</Dialog.Description>

      <Spacer size={20} />

      <Dialog.Actions>
        <Button variant="outline" onClick={onClose} disabled={isLoading}>
          Cancel
        </Button>
        <Button variant="solid" color="red" onClick={handleConfirm} loading={isLoading}>
          Delete
        </Button>
      </Dialog.Actions>
    </Dialog.Wrapper>
  );
};

export let showDeleteConfirmationModal = ({
  title,
  description,
  onConfirm
}: Omit<DeleteConfirmationModalProps, 'isOpen' | 'onClose'>) =>
  showModal(({ dialogProps, close }) => (
    <DeleteConfirmationModal
      title={title}
      description={description}
      onConfirm={async () => {
        await onConfirm();
        close();
      }}
      isOpen={dialogProps.isOpen}
      onClose={close}
    />
  ));
