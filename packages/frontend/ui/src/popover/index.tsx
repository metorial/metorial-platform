import * as RadixPopover from '@radix-ui/react-popover';
import React, { useEffect, useState } from 'react';
import { keyframes, styled } from 'styled-components';
import { useDialogZIndex } from '../dialog/state';
import { theme } from '../theme';

let fadeInTop = keyframes`
  from {
    opacity: 0;
    transform: translateY(-10px) scale(0.99);
  }

  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
`;

let fadeOutTop = keyframes`
  from {
    opacity: 1;
    transform: translateY(0) scale(0.99);
  }

  to {
    opacity: 0;
    transform: translateY(-10px) scale(1);
  }
`;

let fadeInBottom = keyframes`
  from {
    opacity: 0;
    transform: translateY(10px) scale(0.99);
  }

  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
`;

let fadeOutBottom = keyframes`
  from {
    opacity: 1;
    transform: translateY(0) scale(0.99);
  }

  to {
    opacity: 0;
    transform: translateY(10px) scale(1);
  }
`;

let fadeInLeft = keyframes`
  from {
    opacity: 0;
    transform: translateX(-10px) scale(0.99);
  }

  to {
    opacity: 1;
    transform: translateX(0) scale(1);
  }
`;

let fadeOutLeft = keyframes`
  from {
    opacity: 1;
    transform: translateX(0) scale(0.99);
  }

  to {
    opacity: 0;
    transform: translateX(-10px) scale(1);
  }
`;

let fadeInRight = keyframes`
  from {
    opacity: 0;
    transform: translateX(10px) scale(0.99);
  }

  to {
    opacity: 1;
    transform: translateX(0) scale(1);
  }
`;

let fadeOutRight = keyframes`
  from {
    opacity: 1;
    transform: translateX(0) scale(0.99);
  }

  to {
    opacity: 0;
    transform: translateX(10px) scale(1);
  }
`;

let Wrapper = styled(RadixPopover.Content)`
  display: flex;
  gap: 10;
  align-items: center;
  cursor: pointer;
  background: rgba(245, 245, 245, 0.7);
  backdrop-filter: blur(10px);
  border-radius: 10px;
  min-width: 200px;
  will-change: transform, opacity;
  outline: none;
  border: solid 1px ${theme.colors.gray400};
  box-shadow: 0 5px 15px rgba(0, 0, 0, 0.1);

  &[data-state='open'][data-side='top'] {
    animation: ${fadeInBottom} 0.2s ease forwards;
  }

  &[data-state='closed'][data-side='top'] {
    animation: ${fadeOutBottom} 0.2s ease forwards;
  }

  &[data-state='open'][data-side='bottom'] {
    animation: ${fadeInTop} 0.2s ease forwards;
  }

  &[data-state='closed'][data-side='bottom'] {
    animation: ${fadeOutTop} 0.2s ease forwards;
  }

  &[data-state='open'][data-side='left'] {
    animation: ${fadeInLeft} 0.2s ease forwards;
  }

  &[data-state='closed'][data-side='left'] {
    animation: ${fadeOutLeft} 0.2s ease forwards;
  }

  &[data-state='open'][data-side='right'] {
    animation: ${fadeInRight} 0.2s ease forwards;
  }

  &[data-state='closed'][data-side='right'] {
    animation: ${fadeOutRight} 0.2s ease forwards;
  }
`;

let ContentWrapper = styled('div')`
  padding: 15px;
`;

let Arrow = styled(RadixPopover.Arrow)`
  fill: ${theme.colors.background};
`;

let Root = ({
  trigger,
  children,
  arrow,
  operationKey,
  onOpenChange,
  sideOffset,
  alignOffset,
  open: openProp
}: {
  trigger: React.ReactNode;
  children: React.ReactNode;
  arrow?: boolean;
  onOpenChange?: (open: boolean) => void;
  open?: boolean;

  sideOffset?: number;
  alignOffset?: number;

  // The the operationKey changes, the popover will close
  operationKey?: string;
}) => {
  let [open, setOpen] = useState(false);

  useEffect(() => {
    setOpen(false);
  }, [operationKey]);

  useEffect(() => {
    if (onOpenChange) onOpenChange(open);
  }, [open]);

  useEffect(() => {
    if (typeof openProp === 'boolean') setOpen(openProp);
  }, [openProp]);

  let zIndex = useDialogZIndex(open);

  return (
    <RadixPopover.Root open={open} onOpenChange={setOpen}>
      <RadixPopover.Trigger asChild>{trigger}</RadixPopover.Trigger>

      <RadixPopover.Portal>
        <Wrapper style={{ zIndex }} sideOffset={sideOffset} alignOffset={alignOffset}>
          {children}

          {arrow && <Arrow />}
        </Wrapper>
      </RadixPopover.Portal>
    </RadixPopover.Root>
  );
};

let Content = ({ children }: { children: React.ReactNode }) => {
  return <ContentWrapper>{children}</ContentWrapper>;
};

export let Popover = Object.assign(Root, {
  Content,
  Root
});
