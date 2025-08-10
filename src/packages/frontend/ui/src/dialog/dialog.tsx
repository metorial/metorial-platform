import * as RadixDialogDialog from '@radix-ui/react-dialog';
import { RiCloseLine } from '@remixicon/react';
import React from 'react';
import { styled } from 'styled-components';
import { theme } from '../theme';
import { DialogProvider, useDialogZIndex } from './state';
import { Close, Content, Overlay } from './styles';

export { useDialog, useDialogContext, useIsInDialog } from './state';

let Wrapper = styled(Content)`
  width: 90vw;
  max-height: 90vh;
  overflow: auto;
  background: ${theme.colors.background};
  box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);
  padding: 0px;
  border-radius: 15px;
  border: solid 1px ${theme.colors.gray500};
`;

let Inner = styled('div')<{ variant: 'slim' | 'padded' }>`
  color: ${theme.colors.gray900};

  ${({ variant }: any) =>
    variant === 'padded'
      ? `
    padding: 120px 60px;

    @media (max-width: 800px) {
      padding: 20px;
    }
  `
      : `
    padding: 20px;
  `}
`;

let Title = styled(RadixDialogDialog.Title)`
  padding: 0;
  font-size: 20px;
  font-weight: 600;
  padding: 0px 0px 6px 0px;
`;

let Description = styled(RadixDialogDialog.Description)`
  padding: 0px 0px 20px 0px;
  font-size: 14px;
  font-weight: 500;
  color: ${theme.colors.gray600};
`;

let Actions = styled('div')`
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  padding: 0;
`;

export let Dialog = {
  Wrapper: ({
    children,
    isOpen,
    onOpenChange,
    style,
    autoCloseOnSubmit,
    variant = 'slim',
    width
  }: {
    children: React.ReactNode;
    isOpen: boolean;
    onOpenChange: (isOpen: boolean) => void;
    style?: React.CSSProperties;
    autoCloseOnSubmit?: boolean;
    variant?: 'slim' | 'padded';
    width?: number;
  }) => {
    let zIndex = useDialogZIndex(isOpen);

    return (
      <DialogProvider value={{ isOpen, onOpenChange, autoCloseOnSubmit }}>
        <RadixDialogDialog.Root open={isOpen} onOpenChange={onOpenChange}>
          <RadixDialogDialog.Portal>
            <Overlay style={{ zIndex }} />

            <Wrapper
              style={{
                zIndex: zIndex + 1,
                maxWidth: width ? width : variant == 'padded' ? 480 : 400,

                ...style
              }}
            >
              <Inner variant={variant}>
                {children}

                <RadixDialogDialog.Close asChild>
                  <Close aria-label="Close">
                    <RiCloseLine size={16} />
                  </Close>
                </RadixDialogDialog.Close>
              </Inner>
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
  }
};
