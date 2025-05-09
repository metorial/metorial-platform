import * as RadixDialogDialog from '@radix-ui/react-dialog';
import { RiCloseLine } from '@remixicon/react';
import React from 'react';
import { styled } from 'styled-components';
import { DialogProvider, useDialogZIndex } from './state';
import { Close, Content, Overlay } from './styles';

export { useDialog, useDialogContext, useIsInDialog } from './state';

let PanelContent = styled(Content)`
  max-width: 90vw;
  width: min(max(400px, 80vw), 1100px);
  min-height: min(70vh, 850px);
  max-height: 90vh;
  padding: 0;
  overflow: auto;
`;

export let LargePanelDialog = {
  Wrapper: ({
    children,
    isOpen,
    onOpenChange,
    style,
    autoCloseOnSubmit,
    closeButton = true
  }: {
    children: React.ReactNode;
    isOpen: boolean;
    onOpenChange: (isOpen: boolean) => void;
    style?: React.CSSProperties;
    autoCloseOnSubmit?: boolean;
    closeButton?: boolean;
  }) => {
    let zIndex = useDialogZIndex(isOpen);

    return (
      <DialogProvider value={{ isOpen, onOpenChange, autoCloseOnSubmit }}>
        <RadixDialogDialog.Root open={isOpen} onOpenChange={onOpenChange}>
          <RadixDialogDialog.Portal>
            <Overlay style={{ zIndex }} />

            <PanelContent
              style={{
                ...style,
                zIndex: zIndex + 1
              }}
            >
              {children}

              {closeButton && (
                <RadixDialogDialog.Close asChild>
                  <Close aria-label="Close">
                    <RiCloseLine size={16} />
                  </Close>
                </RadixDialogDialog.Close>
              )}
            </PanelContent>
          </RadixDialogDialog.Portal>
        </RadixDialogDialog.Root>
      </DialogProvider>
    );
  }
};
