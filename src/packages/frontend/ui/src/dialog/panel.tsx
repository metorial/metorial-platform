import * as RadixDialogDialog from '@radix-ui/react-dialog';
import { RiCloseLine } from '@remixicon/react';
import React from 'react';
import { styled } from 'styled-components';
import { Button } from '../button';
import { theme } from '../theme';
import { DialogProvider, useDialogZIndex } from './state';
import { ContentSide, Overlay } from './styles';

let Wrapper = styled(ContentSide)``;

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
`;

let Content = styled('main')`
  padding: 20px;
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
    width
  }: {
    children: React.ReactNode;
    isOpen: boolean;
    onOpenChange: (isOpen: boolean) => void;
    style?: React.CSSProperties;
    autoCloseOnSubmit?: boolean;
    width?: number | string;
  }) => {
    let zIndex = useDialogZIndex(isOpen);

    return (
      <DialogProvider value={{ isOpen, onOpenChange, autoCloseOnSubmit }}>
        <RadixDialogDialog.Root open={isOpen} onOpenChange={onOpenChange}>
          <RadixDialogDialog.Portal>
            <Overlay style={{ zIndex }} />

            <Wrapper
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
          <Button aria-label="Close" iconLeft={<RiCloseLine />} />
        </RadixDialogDialog.Close>
      </Header>
    );
  }
};
