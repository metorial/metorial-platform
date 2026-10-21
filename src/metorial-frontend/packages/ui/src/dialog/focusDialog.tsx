import * as RadixDialogDialog from '@radix-ui/react-dialog';
import { RiCloseLine } from '@remixicon/react';
import React, { useRef } from 'react';
import { styled } from 'styled-components';
import { theme } from '../theme';
import { useModalAutoFocus } from './focus';
import {
  DialogProvider,
  preventDialogDismissForSelectInteraction,
  useDialogZIndex
} from './state';
import { Close, Content, Overlay } from './styles';

let Wrapper = styled(Content)`
  width: calc(100vw - 40px);
  max-height: calc(100vh - 40px);
  overflow: auto;
  padding: 0;
  border-radius: 15px;
  border: solid 1px ${theme.colors.gray500};
  display: flex;
  flex-direction: column;
`;

let Inner = styled('div')`
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 80px 40px;
  text-align: center;
  color: ${theme.colors.gray900};

  @media (max-width: 500px) {
    padding: 60px 20px;
  }
`;

let Title = styled(RadixDialogDialog.Title)`
  margin: 0;
  padding: 0 0 8px 0;
  font-size: 20px;
  font-weight: 600;
`;

let Description = styled(RadixDialogDialog.Description)`
  margin: 0;
  max-width: 300px;
  font-size: 14px;
  font-weight: 500;
  line-height: 1.5;
  color: ${theme.colors.gray600};
`;

let Children = styled('div')`
  width: 100%;
  margin-top: 48px;
  display: flex;
  flex-direction: column;
  align-items: center;
`;

export let FocusDialog = ({
  title,
  description,
  children,
  isOpen,
  onOpenChange,
  width = 420,
  minHeight = 600
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  children?: React.ReactNode;
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  width?: number;
  minHeight?: number;
}) => {
  let zIndex = useDialogZIndex(isOpen);
  let contentRef = useRef<HTMLDivElement | null>(null);
  let autoFocus = useModalAutoFocus(contentRef, isOpen);

  return (
    <DialogProvider value={{ isOpen, onOpenChange, contentRef }}>
      <RadixDialogDialog.Root open={isOpen} onOpenChange={onOpenChange}>
        <RadixDialogDialog.Portal>
          <Overlay style={{ zIndex }} />

          <Wrapper
            ref={autoFocus.ref}
            onOpenAutoFocus={autoFocus.onOpenAutoFocus}
            onPointerDownOutside={preventDialogDismissForSelectInteraction}
            onInteractOutside={preventDialogDismissForSelectInteraction}
            onFocusOutside={preventDialogDismissForSelectInteraction}
            style={{
              zIndex: zIndex + 1,
              maxWidth: width,
              minHeight: `min(${minHeight}px, calc(100vh - 40px))`
            }}
          >
            <Inner>
              <Title>{title}</Title>
              {description && <Description>{description}</Description>}
              {children && <Children>{children}</Children>}
            </Inner>

            <RadixDialogDialog.Close asChild>
              <Close aria-label="Close">
                <RiCloseLine size={16} />
              </Close>
            </RadixDialogDialog.Close>
          </Wrapper>
        </RadixDialogDialog.Portal>
      </RadixDialogDialog.Root>
    </DialogProvider>
  );
};
