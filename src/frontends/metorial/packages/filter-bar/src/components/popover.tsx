import {
  floatingTokens,
  preventPopoverDismissForNestedOverlay,
  theme,
  useDialogContext,
  useZindex
} from '@metorial/ui';
import * as RadixPopover from '@radix-ui/react-popover';
import React from 'react';
import { keyframes, styled } from 'styled-components';

let popIn = keyframes`
  from {
    opacity: 0;
    transform: translateY(-4px) scale(0.98);
  }

  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
`;

let popOut = keyframes`
  from {
    opacity: 1;
  }

  to {
    opacity: 0;
    transform: translateY(-4px) scale(0.99);
  }
`;

let Content = styled(RadixPopover.Content)`
  border: 1px solid ${floatingTokens.border};
  border-radius: 12px;
  background: ${theme.colors.background};
  box-shadow:
    0 1px 2px rgba(0, 0, 0, 0.04),
    0 12px 32px rgba(0, 0, 0, 0.09);
  color: ${theme.colors.foreground};
  outline: none;
  overflow: hidden;
  max-width: calc(100vw - 24px);
  max-height: min(var(--radix-popover-content-available-height), 560px);
  display: flex;
  flex-direction: column;
  transform-origin: var(--radix-popover-content-transform-origin);

  &[data-state='open'] {
    animation: ${popIn} 0.14s ${floatingTokens.ease};
  }

  &[data-state='closed'] {
    animation: ${popOut} 0.1s ease-in forwards;
  }
`;

type OutsideEvent = Event & { detail?: { originalEvent?: Event } };

export type FilterPopoverProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trigger?: React.ReactElement;
  anchorRef?: React.RefObject<{ getBoundingClientRect: () => DOMRect } | null>;
  children: React.ReactNode;
  align?: 'start' | 'center' | 'end';
  sideOffset?: number;
  width?: number | string;
  autoFocus?: boolean;
  isInside?: (target: Element) => boolean;
  label?: string;
  followAnchor?: boolean;
};

export let FilterPopover = ({
  open,
  onOpenChange,
  trigger,
  anchorRef,
  children,
  align = 'start',
  sideOffset = 6,
  width = 320,
  autoFocus = true,
  isInside,
  label,
  followAnchor
}: FilterPopoverProps) => {
  let dialog = useDialogContext();
  let zIndex = useZindex(open);

  let guardOutside = (event: OutsideEvent) => {
    preventPopoverDismissForNestedOverlay(event);
    if (event.defaultPrevented || !isInside) return;

    let target = event.detail?.originalEvent?.target ?? event.target;
    if (target instanceof Element && isInside(target)) event.preventDefault();
  };

  return (
    <RadixPopover.Root open={open} onOpenChange={onOpenChange}>
      {trigger && <RadixPopover.Trigger asChild>{trigger}</RadixPopover.Trigger>}
      {anchorRef && <RadixPopover.Anchor virtualRef={anchorRef as React.RefObject<any>} />}

      <RadixPopover.Portal container={dialog?.contentRef?.current}>
        <Content
          aria-label={label}
          side="bottom"
          align={align}
          sideOffset={sideOffset}
          collisionPadding={12}
          updatePositionStrategy={followAnchor ? 'always' : 'optimized'}
          style={{ zIndex, width: typeof width == 'number' ? `${width}px` : width }}
          onOpenAutoFocus={autoFocus ? undefined : e => e.preventDefault()}
          onCloseAutoFocus={autoFocus ? undefined : e => e.preventDefault()}
          onPointerDownOutside={guardOutside}
          onInteractOutside={guardOutside}
          onFocusOutside={guardOutside}
        >
          {children}
        </Content>
      </RadixPopover.Portal>
    </RadixPopover.Root>
  );
};
