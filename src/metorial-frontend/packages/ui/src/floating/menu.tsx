import { Menu } from '@base-ui/react/menu';
import { RiArrowRightSLine, RiCheckLine } from '@remixicon/react';
import React from 'react';
import { styled } from 'styled-components';
import { theme } from '../theme';
import { floatingPopupSurface, floatingTokens } from './tokens';

export type FloatingMenuItem =
  | {
      type?: 'item';
      id?: string;
      label: React.ReactNode;
      description?: React.ReactNode;
      icon?: React.ReactNode;
      kbd?: React.ReactNode;
      checked?: boolean;
      disabled?: boolean;
      danger?: boolean;
      closeOnClick?: boolean;
      onClick?: () => void;
    }
  | { type: 'separator'; id?: string }
  | { type: 'label'; id?: string; label: React.ReactNode }
  | {
      type: 'submenu';
      id?: string;
      label: React.ReactNode;
      icon?: React.ReactNode;
      hint?: React.ReactNode;
      disabled?: boolean;
      items: FloatingMenuItem[];
    }
  | { type: 'custom'; id?: string; render: () => React.ReactNode };

export type FloatingMenuProps = {
  trigger: React.ReactElement<Record<string, unknown>>;
  items: FloatingMenuItem[];
  side?: 'top' | 'right' | 'bottom' | 'left';
  align?: 'start' | 'center' | 'end';
  sideOffset?: number;
  minWidth?: number;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  header?: React.ReactNode;
};

let Positioner = styled(Menu.Positioner)`
  z-index: ${floatingTokens.zIndex};
  outline: none;
`;

let Popup = styled(Menu.Popup)<{ $minWidth: number }>`
  ${floatingPopupSurface};
  min-width: ${({ $minWidth }) => $minWidth}px;
  max-width: min(360px, calc(100vw - 24px));
  max-height: min(var(--available-height), 640px);
  overflow-y: auto;
  padding: 4px;
  box-sizing: border-box;
`;

let itemStyles = `
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  min-height: 32px;
  padding: 5px 10px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  font-family: inherit;
  font-size: 13.5px;
  text-align: left;
  cursor: pointer;
  outline: none;
  box-sizing: border-box;
  user-select: none;
`;

let Item = styled(Menu.Item)<{ $danger?: boolean }>`
  ${itemStyles};
  color: ${({ $danger }) => ($danger ? theme.colors.red900 : theme.colors.gray900)};

  &[data-highlighted] {
    background: ${theme.colors.gray250};
  }

  &[data-disabled] {
    color: ${theme.colors.gray550};
    cursor: default;
  }

  &[data-disabled] > svg {
    color: ${theme.colors.gray500};
  }
`;

let SubmenuTrigger = styled(Menu.SubmenuTrigger)`
  ${itemStyles};
  color: ${theme.colors.gray900};

  &[data-highlighted],
  &[data-popup-open] {
    background: ${theme.colors.gray250};
  }
`;

let ItemIcon = styled.span<{ $danger?: boolean }>`
  display: inline-flex;
  justify-content: center;
  flex: 0 0 auto;
  width: 18px;
  color: ${({ $danger }) => ($danger ? theme.colors.red900 : theme.colors.gray700)};

  svg {
    width: 17px;
    height: 17px;
  }
`;

let ItemLabel = styled.span`
  display: flex;
  flex-direction: column;
  flex: 1;
  min-width: 0;
`;

let ItemDescription = styled.span`
  color: ${theme.colors.gray650};
  font-size: 11.5px;
`;

let Kbd = styled.kbd`
  color: ${theme.colors.gray600};
  font-family: inherit;
  font-size: 12px;
`;

let Check = styled.span`
  display: inline-flex;
  color: ${theme.colors.foreground};

  svg {
    width: 16px;
    height: 16px;
  }
`;

let Hint = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: ${theme.colors.gray650};
  font-size: 12px;

  svg {
    width: 16px;
    height: 16px;
  }
`;

export let FloatingMenuSeparator = styled(Menu.Separator)`
  height: 1px;
  margin: 5px 8px;
  background: ${theme.colors.gray300};
`;

export let FloatingMenuLabel = styled.div`
  padding: 8px 10px 4px;
  color: ${theme.colors.gray600};
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
`;

export let FloatingMenuRow = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 36px;
  padding: 4px 6px 4px 10px;
  color: ${theme.colors.gray900};
  font-size: 13.5px;

  & > svg {
    flex: 0 0 auto;
    width: 17px;
    height: 17px;
    color: ${theme.colors.gray700};
  }
`;

export let FloatingMenuRowLabel = styled.span`
  flex: 1;
  min-width: 0;
`;

let renderItems = (items: FloatingMenuItem[], minWidth: number): React.ReactNode =>
  items.map((item, index) => {
    let key = item.id ?? `item-${index}`;

    if (item.type == 'separator') return <FloatingMenuSeparator key={key} />;
    if (item.type == 'label')
      return <FloatingMenuLabel key={key}>{item.label}</FloatingMenuLabel>;
    if (item.type == 'custom')
      return <React.Fragment key={key}>{item.render()}</React.Fragment>;

    if (item.type == 'submenu') {
      return (
        <Menu.SubmenuRoot key={key} disabled={item.disabled}>
          <SubmenuTrigger>
            {item.icon && <ItemIcon>{item.icon}</ItemIcon>}
            <ItemLabel>{item.label}</ItemLabel>
            <Hint>
              {item.hint}
              <RiArrowRightSLine />
            </Hint>
          </SubmenuTrigger>

          <Menu.Portal>
            <Positioner side="right" align="start" sideOffset={6}>
              <Popup $minWidth={minWidth}>{renderItems(item.items, minWidth)}</Popup>
            </Positioner>
          </Menu.Portal>
        </Menu.SubmenuRoot>
      );
    }

    return (
      <Item
        key={key}
        $danger={item.danger}
        disabled={item.disabled}
        closeOnClick={item.closeOnClick ?? true}
        onClick={item.onClick}
      >
        {item.icon && <ItemIcon $danger={item.danger}>{item.icon}</ItemIcon>}

        <ItemLabel>
          {item.label}
          {item.description && <ItemDescription>{item.description}</ItemDescription>}
        </ItemLabel>

        {item.kbd !== undefined && <Kbd>{item.kbd}</Kbd>}

        {item.checked && (
          <Check>
            <RiCheckLine />
          </Check>
        )}
      </Item>
    );
  });

export let FloatingMenu = ({
  trigger,
  items,
  side = 'bottom',
  align = 'start',
  sideOffset = 8,
  minWidth = 220,
  open,
  onOpenChange,
  header
}: FloatingMenuProps) => (
  <Menu.Root open={open} onOpenChange={value => onOpenChange?.(value)}>
    <Menu.Trigger render={trigger} />

    <Menu.Portal>
      <Positioner side={side} align={align} sideOffset={sideOffset} collisionPadding={12}>
        <Popup $minWidth={minWidth}>
          {header}
          {renderItems(items, minWidth)}
        </Popup>
      </Positioner>
    </Menu.Portal>
  </Menu.Root>
);
