import * as RadixDialogDialog from '@radix-ui/react-dialog';
import { RiCloseLine } from '@remixicon/react';
import React, { useRef } from 'react';
import { keyframes, styled } from 'styled-components';
import { Button } from '../button';
import { theme } from '../theme';
import { useModalAutoFocus } from './focus';
import {
  DialogProvider,
  preventDialogDismissForSelectInteraction,
  useDialogZIndex
} from './state';

let widths = {
  narrow: 600,
  medium: 880,
  wide: 1180
};

let rise = keyframes`
  from {
    opacity: 0;
    transform: translateY(12px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
`;

let fade = keyframes`
  from {
    opacity: 1;
  }
  to {
    opacity: 0;
  }
`;

let Content = styled(RadixDialogDialog.Content)`
  position: fixed;
  inset: 0;
  display: flex;
  flex-direction: column;
  background: ${theme.colors.gray100};
  color: ${theme.colors.gray900};
  overflow-y: auto;
  overscroll-behavior: contain;

  &[data-state='open'] {
    animation: ${rise} 220ms ease-out;
  }

  &[data-state='closed'] {
    animation: ${fade} 150ms ease-in forwards;
  }
`;

let TopBar = styled.header`
  position: sticky;
  top: 0;
  z-index: 2;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  flex-shrink: 0;
  height: 60px;
  padding: 0 24px;
  background: color-mix(in srgb, ${theme.colors.gray100} 85%, transparent);
  backdrop-filter: blur(10px);
  border-bottom: 1px solid ${theme.colors.gray300};
`;

let TopBarTitle = styled(RadixDialogDialog.Title)`
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

let TopBarActions = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
`;

let Body = styled.main`
  width: 100%;
  margin: 0 auto;
  padding: 40px 24px 80px;
  box-sizing: border-box;

  @media (max-width: 600px) {
    padding: 24px 16px 60px;
  }
`;

export type FullscreenDialogWidth = keyof typeof widths | number;

export let FullscreenDialog = {
  Wrapper: ({
    children,
    isOpen,
    onOpenChange,
    title,
    actions,
    width = 'medium',
    autoCloseOnSubmit
  }: {
    children: React.ReactNode;
    isOpen: boolean;
    onOpenChange: (isOpen: boolean) => void;
    title: React.ReactNode;
    actions?: React.ReactNode;
    width?: FullscreenDialogWidth;
    autoCloseOnSubmit?: boolean;
  }) => {
    let zIndex = useDialogZIndex(isOpen);
    let contentRef = useRef<HTMLDivElement | null>(null);
    let autoFocus = useModalAutoFocus(contentRef, isOpen);

    return (
      <DialogProvider value={{ isOpen, onOpenChange, autoCloseOnSubmit, contentRef }}>
        <RadixDialogDialog.Root open={isOpen} onOpenChange={onOpenChange}>
          <RadixDialogDialog.Portal>
            <Content
              ref={autoFocus.ref}
              onOpenAutoFocus={autoFocus.onOpenAutoFocus}
              onPointerDownOutside={preventDialogDismissForSelectInteraction}
              onInteractOutside={preventDialogDismissForSelectInteraction}
              onFocusOutside={preventDialogDismissForSelectInteraction}
              aria-describedby={undefined}
              style={{ zIndex: zIndex + 1 }}
            >
              <TopBar>
                <TopBarTitle>{title}</TopBarTitle>

                <TopBarActions>
                  {actions}

                  <RadixDialogDialog.Close asChild>
                    <Button
                      size="2"
                      variant="outline"
                      iconLeft={<RiCloseLine size={16} />}
                      aria-label="Close"
                    >
                      Close
                    </Button>
                  </RadixDialogDialog.Close>
                </TopBarActions>
              </TopBar>

              <Body style={{ maxWidth: typeof width == 'number' ? width : widths[width] }}>
                {children}
              </Body>
            </Content>
          </RadixDialogDialog.Portal>
        </RadixDialogDialog.Root>
      </DialogProvider>
    );
  }
};
