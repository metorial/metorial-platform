import { Popover } from '@base-ui/react/popover';
import React from 'react';
import { styled } from 'styled-components';
import { theme } from '../theme';
import { floatingPopupSurface, floatingTokens } from './tokens';

export type FloatingPopoverProps = {
  trigger: React.ReactElement<Record<string, unknown>>;
  children: React.ReactNode;
  side?: 'top' | 'right' | 'bottom' | 'left';
  align?: 'start' | 'center' | 'end';
  sideOffset?: number;
  width?: number | string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  title?: React.ReactNode;
  description?: React.ReactNode;
};

let Positioner = styled(Popover.Positioner)`
  z-index: ${floatingTokens.zIndex};
  outline: none;
`;

let Popup = styled(Popover.Popup)<{ $width: string }>`
  ${floatingPopupSurface};
  width: ${({ $width }) => $width};
  max-width: calc(100vw - 24px);
  max-height: min(var(--available-height), 720px);
  overflow-y: auto;
  box-sizing: border-box;
`;

let Head = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 14px 14px 10px;
`;

let Title = styled(Popover.Title)`
  margin: 0;
  font-size: 14px;
  font-weight: 600;
`;

let Description = styled(Popover.Description)`
  margin: 0;
  color: ${theme.colors.gray650};
  font-size: 12.5px;
`;

export let FloatingPopoverBody = styled.div`
  padding: 0 14px 14px;
`;

export let FloatingPopoverFooter = styled.div`
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  padding: 10px 14px;
  border-top: 1px solid ${theme.colors.gray300};
`;

export let FloatingPopover = ({
  trigger,
  children,
  side = 'bottom',
  align = 'start',
  sideOffset = 8,
  width = 320,
  open,
  onOpenChange,
  title,
  description
}: FloatingPopoverProps) => (
  <Popover.Root open={open} onOpenChange={value => onOpenChange?.(value)}>
    <Popover.Trigger render={trigger} />

    <Popover.Portal>
      <Positioner side={side} align={align} sideOffset={sideOffset} collisionPadding={12}>
        <Popup $width={typeof width == 'number' ? `${width}px` : width}>
          {(title || description) && (
            <Head>
              {title && <Title>{title}</Title>}
              {description && <Description>{description}</Description>}
            </Head>
          )}

          {children}
        </Popup>
      </Positioner>
    </Popover.Portal>
  </Popover.Root>
);

export let FloatingPopoverClose = Popover.Close;
