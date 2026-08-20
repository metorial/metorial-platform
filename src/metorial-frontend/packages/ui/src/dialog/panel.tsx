import * as RadixDialogDialog from '@radix-ui/react-dialog';
import { RiCloseLine } from '@remixicon/react';
import React, { useRef } from 'react';
import { styled } from 'styled-components';
import { Button } from '../button';
import { theme } from '../theme';
import { DialogProvider, preventDialogDismissForSelectInteraction, useDialogZIndex } from './state';
import { ContentSide, Overlay } from './styles';

let Wrapper = styled(ContentSide)`
  transition: width 0.2s ease;
  overflow-y: auto;
  overflow-x: hidden;
  overscroll-behavior: contain;
`;

let Header = styled('header')`
  display: flex;
  padding: 15px 20px;
  border-bottom: 1px solid ${theme.colors.gray400};
  background: rgba(255, 255, 255, 0.7);
  z-index: 9999;
  backdrop-filter: blur(10px);
  justify-content: space-between;
  align-items: center;
  position: sticky;
  top: 0;
  border-top-right-radius: var(--dialog-radius);
  border-top-left-radius: var(--dialog-radius);
`;

let Content = styled('main')`
  display: flex;
  flex-direction: column;
  flex: 1 0 auto;
  padding: 15px 20px;
`;

let Title = styled(RadixDialogDialog.Title)`
  padding: 0;
  font-size: 20px;
  font-weight: 600;
`;

let Description = styled(RadixDialogDialog.Description)`
  font-size: 14px;
  font-weight: 500;
  color: ${theme.colors.gray600};
  margin-top: 4px;
`;

let Actions = styled('div')`
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  padding: 0;
`;

export let Panel = {
  Wrapper: ({
    children,
    isOpen,
    onOpenChange,
    style,
    autoCloseOnSubmit,
    width,
    onEscapeKeyDown,
    onPointerDownOutside,
    onInteractOutside,
    onFocusOutside
  }: {
    children: React.ReactNode;
    isOpen: boolean;
    onOpenChange: (isOpen: boolean) => void;
    style?: React.CSSProperties;
    autoCloseOnSubmit?: boolean;
    width?: number | string;
    onEscapeKeyDown?: RadixDialogDialog.DialogContentProps['onEscapeKeyDown'];
    onPointerDownOutside?: RadixDialogDialog.DialogContentProps['onPointerDownOutside'];
    onInteractOutside?: RadixDialogDialog.DialogContentProps['onInteractOutside'];
    onFocusOutside?: RadixDialogDialog.DialogContentProps['onFocusOutside'];
  }) => {
    let zIndex = useDialogZIndex(isOpen);
    let contentRef = useRef<HTMLDivElement | null>(null);

    return (
      <DialogProvider value={{ isOpen, onOpenChange, autoCloseOnSubmit, contentRef }}>
        <RadixDialogDialog.Root open={isOpen} onOpenChange={onOpenChange}>
          <RadixDialogDialog.Portal>
            <Overlay style={{ zIndex }} />

            <Wrapper
              ref={contentRef}
              onEscapeKeyDown={onEscapeKeyDown}
              onPointerDownOutside={event => {
                preventDialogDismissForSelectInteraction(event);
                onPointerDownOutside?.(event);
              }}
              onInteractOutside={event => {
                preventDialogDismissForSelectInteraction(event);
                onInteractOutside?.(event);
              }}
              onFocusOutside={event => {
                preventDialogDismissForSelectInteraction(event);
                onFocusOutside?.(event);
              }}
              style={{
                ...style,

                width,
                zIndex: zIndex + 1
              }}
            >
              {children}
            </Wrapper>
          </RadixDialogDialog.Portal>
        </RadixDialogDialog.Root>
      </DialogProvider>
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
  Content: ({ children }: { children: React.ReactNode }) => {
    return <Content>{children}</Content>;
  },
  Header: ({ children }: { children: React.ReactNode }) => {
    return (
      <Header>
        <div>{children}</div>

        <RadixDialogDialog.Close asChild>
          <Button type="button" aria-label="Close" iconLeft={<RiCloseLine />} />
        </RadixDialogDialog.Close>
      </Header>
    );
  }
};
