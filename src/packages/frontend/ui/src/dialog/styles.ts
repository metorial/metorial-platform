import * as RadixDialogDialog from '@radix-ui/react-dialog';
import { keyframes, styled } from 'styled-components';
import { theme } from '../theme';

export let fadeInShift = keyframes`
  from {
    opacity: 0;
    transform: translate(-50%, -50%) scale(0.9);
  }
  to {
    opacity: 1;
    transform: translate(-50%, -50%) scale(1);
  }
`;

export let fadeOutShift = keyframes`
  from {
    opacity: 1;
    transform: translate(-50%, -50%) scale(1);
  }
  to {
    opacity: 0;
    transform: translate(-50%, -50%) scale(0.9);
  }
`;

export let fadeIn = keyframes`
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
`;

export let fadeOut = keyframes`
  from {
    opacity: 1;
  }
  to {
    opacity: 0;
  }
`;

export let fadeInRight = keyframes`
  from {
    opacity: 0;
    transform: translateX(50px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
`;

export let fadeOutRight = keyframes`
  from {
    opacity: 1;
    transform: translateX(0);
  }
  to {
    opacity: 0;
    transform: translateX(50px);
  }
`;

export let Overlay = styled(RadixDialogDialog.Overlay)`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(100, 100, 100, 0.1);
  backdrop-filter: blur(5px);

  &[data-state='open'] {
    animation: ${fadeIn} 200ms ease-out forwards;
  }

  &[data-state='closed'] {
    animation: ${fadeOut} 200ms ease-in forwards;
  }
`;

export let Content = styled(RadixDialogDialog.Content)`
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  background: ${theme.colors.background};
  border-radius: 10px;
  box-shadow: ${theme.shadows.large};
  color: ${theme.colors.gray900};
  padding: 20px;

  &[data-state='open'] {
    animation: ${fadeInShift} 200ms ease-out;
  }

  &[data-state='closed'] {
    animation: ${fadeOutShift} 200ms ease-in;
  }
`;

export let ContentSide = styled(RadixDialogDialog.Content)`
  position: fixed;
  top: 10px;
  right: 10px;
  bottom: 10px;
  background: ${theme.colors.background};
  box-shadow: ${theme.shadows.large};
  height: calc(100% - 20px);
  width: min(600px, 90vw);
  border-radius: 10px;
  overflow: auto;
  /* max-width: 90vw; */

  --dialog-radius: 10px;

  &[data-state='open'] {
    animation: ${fadeInRight} 200ms ease-out;
  }

  &[data-state='closed'] {
    animation: ${fadeOutRight} 200ms ease-in;
  }
`;

export let Close = styled('button')`
  position: absolute;
  top: 15px;
  right: 15px;
  height: 26px;
  width: 26px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  border-radius: 50%;
  border: none;
  transition: background 0.3s ease;
  background: ${theme.colors.gray400};

  &:hover {
    background: ${theme.colors.gray500};
  }
`;
