import React from 'react';
import { showModal } from '.';
import { Alert } from '../alert';
import { Button } from '../button';

export let confirm = ({
  title,
  description,

  onConfirm,
  onCancel,
  cancelText = 'Cancel',
  confirmText = 'Confirm'
}: {
  title: React.ReactNode;
  description: React.ReactNode;
  onConfirm: () => void;
  onCancel?: () => void;
  cancelText?: React.ReactNode;
  confirmText?: React.ReactNode;
}) => {
  showModal(({ dialogProps }) => {
    return (
      <Alert.Wrapper {...dialogProps}>
        <Alert.Title>{title}</Alert.Title>

        <Alert.Description>{description}</Alert.Description>

        <Alert.Actions>
          <Alert.Action type="cancel">
            <Button variant="soft" onClick={onCancel}>
              {cancelText}
            </Button>
          </Alert.Action>
          <Alert.Action type="action">
            <Button variant="solid" onClick={onConfirm}>
              {confirmText}
            </Button>
          </Alert.Action>
        </Alert.Actions>
      </Alert.Wrapper>
    );
  });
};
