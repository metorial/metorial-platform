import * as RadixDialogDialog from '@radix-ui/react-dialog';
import { RiCloseLine } from '@remixicon/react';
import React, { useRef } from 'react';
import { styled } from 'styled-components';
import {
  DialogProvider,
  preventDialogDismissForSelectInteraction,
  useDialogZIndex
} from './state';
import { Close, Content, Overlay } from './styles';

export { useDialog, useDialogContext, useIsInDialog } from './state';

let PanelContent = styled(Content)`
  display: flex;
  flex-direction: column;
  max-width: 90vw;
  width: min(max(400px, 80vw), 1100px);
  height: min(90vh, 850px);
  max-height: 90vh;
  box-sizing: border-box;
  padding: 0;
  overflow: hidden;
`;

let PanelBody = styled.div`
  display: flex;
  flex: 1;
  min-width: 0;
  min-height: 0;
  width: 100%;
  overflow: hidden;
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
    let contentRef = useRef<HTMLDivElement | null>(null);

    return (
      <DialogProvider value={{ isOpen, onOpenChange, autoCloseOnSubmit, contentRef }}>
        <RadixDialogDialog.Root open={isOpen} onOpenChange={onOpenChange}>
          <RadixDialogDialog.Portal>
            <Overlay style={{ zIndex }} />

            <PanelContent
              ref={contentRef}
              onPointerDownOutside={preventDialogDismissForSelectInteraction}
              onInteractOutside={preventDialogDismissForSelectInteraction}
              onFocusOutside={preventDialogDismissForSelectInteraction}
              style={{
                ...style,
                zIndex: zIndex + 1
              }}
            >
              <PanelBody>{children}</PanelBody>

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
