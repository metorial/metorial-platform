import * as RadixAlertDialog from '@radix-ui/react-alert-dialog';
import React from 'react';
import { keyframes, styled } from 'styled-components';
import { theme } from '..';
import { useDialogZIndex } from '../dialog/state';

let fadeInShift = keyframes`
  from {
    opacity: 0;
    transform: translate(-50%, -50%) scale(0.9);
  }
  to {
    opacity: 1;
    transform: translate(-50%, -50%) scale(1);
  }
`;

let fadeOutShift = keyframes`
  from {
    opacity: 1;
    transform: translate(-50%, -50%) scale(1);
  }
  to {
    opacity: 0;
    transform: translate(-50%, -50%) scale(0.9);
  }
`;

let fadeIn = keyframes`
  from {
    opacity: 0;
  }
  to {
    opacity: 0.4;
  }
`;

let fadeOut = keyframes`
  from {
    opacity: 0.4;
  }
  to {
    opacity: 0;
  }
`;

let Overlay = styled(RadixAlertDialog.Overlay)`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: ${theme.colors.gray600};
  z-index: 1000;

  &[data-state='open'] {
    animation: ${fadeIn} 200ms ease-out forwards;
  }

  &[data-state='closed'] {
    animation: ${fadeOut} 200ms ease-in forwards;
  }
`;

let Content = styled(RadixAlertDialog.Content)`
  position: fixed;
  z-index: 1001;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 90vw;
  max-width: 400px;
  max-height: 90vh;
  overflow: auto;
  background: ${theme.colors.gray200};
  border-radius: 10px;
  box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);
  color: ${theme.colors.gray900};

  &[data-state='open'] {
    animation: ${fadeInShift} 200ms ease-out;
  }

  &[data-state='closed'] {
    animation: ${fadeOutShift} 200ms ease-in;
  }
`;

let Title = styled(RadixAlertDialog.Title)`
  padding: 20px 20px 0px 20px;
  font-size: 20px;
  font-weight: 600;
`;

let Description = styled(RadixAlertDialog.Description)`
  padding: 6px 20px 0px 20px;
  font-size: 14px;
  color: ${theme.colors.gray600};
`;

let Actions = styled('div')`
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  padding: 20px;
`;

export let Alert = {
  Wrapper: ({
    children,
    isOpen,
    onOpenChange
  }: {
    children: React.ReactNode;
    isOpen: boolean;
    onOpenChange: (isOpen: boolean) => void;
  }) => {
    let zIndex = useDialogZIndex(isOpen);

    return (
      <RadixAlertDialog.Root open={isOpen} onOpenChange={onOpenChange}>
        <RadixAlertDialog.Portal>
          <Overlay style={{ zIndex }} />

          <Content style={{ zIndex: zIndex + 1 }}>{children}</Content>
        </RadixAlertDialog.Portal>
      </RadixAlertDialog.Root>
    );
  },
  Title: ({ children }: { children: React.ReactNode }) => {
    return <Title>{children}</Title>;
  },
  Description: ({ children }: { children: React.ReactNode }) => {
    return <Description>{children}</Description>;
  },
  Actions: ({ children }: { children: React.ReactNode }) => {
    return <Actions>{children}</Actions>;
  },
  Action: ({ children, type }: { children: React.ReactNode; type: 'cancel' | 'action' }) => {
    if (type == 'cancel') {
      return <RadixAlertDialog.Cancel asChild>{children}</RadixAlertDialog.Cancel>;
    }

    return <RadixAlertDialog.Action asChild>{children}</RadixAlertDialog.Action>;
  }
};
