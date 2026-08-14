import * as RadixMenu from '@radix-ui/react-dropdown-menu';
import { RiArrowRightSLine } from '@remixicon/react';
import React, { useEffect, useState } from 'react';
import { css, keyframes, styled } from 'styled-components';
import { theme } from '..';
import { markOverlayPointerDismiss, useDialogZIndex } from '../dialog/state';
import { OverlayOpenProvider, useSuppressTooltipWhileOpen } from '../tooltip/state';

let fadeInBottom = keyframes`
  from { opacity: 0; transform: translateY(-10px) scale(0.99); }
  to { opacity: 1; transform: translateY(0) scale(1); }
`;

let fadeOutBottom = keyframes`
  from { opacity: 1; transform: translateY(0); }
  to { opacity: 0; transform: translateY(-10px); }
`;

let fadeInTop = keyframes`
  from { opacity: 0; transform: translateY(10px) scale(0.99); }
  to { opacity: 1; transform: translateY(0) scale(1); }
`;

let fadeOutTop = keyframes`
  from { opacity: 1; transform: translateY(0); }
  to { opacity: 0; transform: translateY(10px); }
`;

let fadeInLeft = keyframes`
  from { opacity: 0; transform: translateX(-10px) scale(0.99); }
  to { opacity: 1; transform: translateX(0) scale(1); }
`;

let fadeOutLeft = keyframes`
  from { opacity: 1; transform: translateX(0); }
  to { opacity: 0; transform: translateX(-10px); }
`;

let fadeInRight = keyframes`
  from { opacity: 0; transform: translateX(10px) scale(0.99); }
  to { opacity: 1; transform: translateX(0) scale(1); }
`;

let fadeOutRight = keyframes`
  from { opacity: 1; transform: translateX(0); }
  to { opacity: 0; transform: translateX(10px); }
`;

let contentStyles = css<{
  $lightMode?: boolean;
  $matchTriggerWidth?: boolean;
}>`
  display: flex;
  flex-direction: column;
  transition: all 0.3s ease;
  padding: 5px;
  color: ${({ $lightMode }) =>
    $lightMode ? theme.colors.foreground : theme.colors.background};
  box-shadow: ${theme.shadows.large};
  background: ${({ $lightMode }) =>
    $lightMode ? theme.colors.background : theme.colors.foreground};
  border: 1px solid
    ${({ $lightMode }) => ($lightMode ? theme.colors.gray400 : theme.colors.foreground)};
  border-radius: 10px;
  min-width: 200px;
  width: ${({ $matchTriggerWidth }) =>
    $matchTriggerWidth ? 'var(--radix-dropdown-menu-trigger-width)' : undefined};
  gap: 5px;
  &[data-state='open'][data-side='top'] {
    animation: ${fadeInTop} 0.2s ease forwards;
  }

  &[data-state='closed'][data-side='top'] {
    animation: ${fadeOutTop} 0.2s ease forwards;
  }

  &[data-state='open'][data-side='bottom'] {
    animation: ${fadeInBottom} 0.2s ease forwards;
  }

  &[data-state='closed'][data-side='bottom'] {
    animation: ${fadeOutBottom} 0.2s ease forwards;
  }

  &[data-state='open'][data-side='left'] {
    animation: ${fadeInLeft} 0.2s ease forwards;
  }

  &[data-state='closed'][data-side='left'] {
    animation: ${fadeOutLeft} 0.2s ease forwards;
  }

  &[data-state='open'][data-side='right'] {
    animation: ${fadeInRight} 0.2s ease forwards;
  }

  &[data-state='closed'][data-side='right'] {
    animation: ${fadeOutRight} 0.2s ease forwards;
  }
`;

let Content = styled(RadixMenu.Content)<{
  $lightMode?: boolean;
  $matchTriggerWidth?: boolean;
}>`
  ${contentStyles}
`;

let SubContent = styled(RadixMenu.SubContent)<{ $lightMode?: boolean }>`
  ${contentStyles}
`;

let Separator = styled(RadixMenu.Separator)<{ $lightMode?: boolean }>`
  height: 1px;
  background: ${({ $lightMode }) =>
    $lightMode ? theme.colors.gray300 : theme.colors.gray800};
`;

let itemStyles = css<{
  $lightMode?: boolean;
  $matchTriggerWidth?: boolean;
  $row?: boolean;
}>`
  font-size: 14px;
  font-weight: 500;
  display: flex;
  flex-direction: ${({ $row }) => ($row ? 'row' : 'column')};
  align-items: ${({ $row }) => ($row ? 'center' : 'stretch')};
  justify-content: ${({ $row }) => ($row ? 'flex-start' : 'center')};
  text-align: left;
  gap: 5px;
  padding: 7px 13px;
  border-radius: 6px;
  outline: none;
  border: none;
  background: transparent;
  transition: all 0.3s ease;
  color: ${({ $lightMode }) =>
    $lightMode ? theme.colors.foreground : theme.colors.background};
  max-width: ${({ $matchTriggerWidth }) => ($matchTriggerWidth ? 'unset' : '250px')};

  &:not(:disabled) {
    &:hover {
      background: ${({ $lightMode }) =>
        $lightMode ? theme.colors.gray300 : theme.colors.gray800};
    }

    &:focus {
      background: ${({ $lightMode }) =>
        $lightMode ? theme.colors.gray300 : theme.colors.gray800};
    }
  }

  &:disabled {
    opacity: 0.7;
  }

  h1 {
    font-size: 14px;
    font-weight: 500;
    color: ${({ $lightMode }) =>
      $lightMode ? theme.colors.foreground : theme.colors.background};
  }

  p {
    font-size: 12px;
    color: ${theme.colors.gray600};
  }
`;

let Item = styled(RadixMenu.Item)<{
  $lightMode?: boolean;
  $matchTriggerWidth?: boolean;
  $row?: boolean;
}>`
  ${itemStyles}
`;

// The sub trigger renders a div rather than a button, so it relies on the data attributes
// Radix sets instead of the :hover/:focus/:disabled selectors the leaf items use.
let SubTrigger = styled(RadixMenu.SubTrigger)<{
  $lightMode?: boolean;
  $matchTriggerWidth?: boolean;
  $row?: boolean;
}>`
  ${itemStyles}
  cursor: default;
  user-select: none;

  &:not([data-disabled]) {
    &[data-highlighted],
    &[data-state='open'] {
      background: ${({ $lightMode }) =>
        $lightMode ? theme.colors.gray300 : theme.colors.gray800};
    }
  }

  &[data-disabled] {
    opacity: 0.7;
  }
`;

let ItemIcon = styled.span`
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  height: 16px;
  width: 16px;

  svg {
    height: 16px;
    width: 16px;
  }
`;

let ItemCopy = styled.span`
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 5px;
  min-width: 0;
  flex: 1;
`;

let ItemChevron = styled.span`
  display: flex;
  align-items: center;
  margin-left: auto;
  flex-shrink: 0;
  opacity: 0.4;

  svg {
    height: 16px;
    width: 16px;
  }
`;

let Title = styled(RadixMenu.Label)<{ $lightMode?: boolean }>`
  font-size: 14px;
  font-weight: 600;
  color: ${({ $lightMode }) => ($lightMode ? theme.colors.gray800 : theme.colors.gray100)};
  padding: 7px 13px;
  border-radius: 6px;
  background: transparent;
  transition: all 0.3s ease;
  display: flex;
  align-items: center;
  gap: 5px;
`;

export type MenuItem =
  | {
      id: string;
      disabled?: boolean;
      description?: React.ReactNode;
      label: React.ReactNode;
      icon?: React.ReactNode;
      onClick?: () => void;
    }
  | {
      id?: string;
      disabled?: boolean;
      description?: React.ReactNode;
      label: React.ReactNode;
      icon?: React.ReactNode;
      onClick: () => void;
    }
  | {
      type: 'separator';
    }
  | {
      type: 'submenu';
      id?: string;
      disabled?: boolean;
      description?: React.ReactNode;
      label: React.ReactNode;
      icon?: React.ReactNode;
      items: MenuItem[];
    };

export type MenuProps = {
  label?: string;
  children: React.ReactNode;
  onItemClick?: (id: string) => void;
  items: MenuItem[];
  title?: string;
  setIsOpen?: (isOpen: boolean) => void;
  matchTriggerWidth?: boolean;
  lightMode?: boolean;
} & Omit<React.ComponentPropsWithoutRef<'button'>, 'children' | 'title'>;

export let Menu = React.forwardRef<HTMLButtonElement, MenuProps>(
  (
    {
      children,
      label,
      onItemClick,
      items,
      title,
      setIsOpen,
      matchTriggerWidth,
      lightMode,
      ...triggerProps
    },
    ref
  ) => {
    let [open, setOpen] = useState(false);
    let zIndex = useDialogZIndex(open);

    useEffect(() => setIsOpen?.(open), [open]);

    useSuppressTooltipWhileOpen(open);

    let renderItems = (items: MenuItem[]): React.ReactNode =>
      items.map((item: any, i) => {
        if (item.type === 'separator') return <Separator key={i} $lightMode={lightMode} />;

        if (item.type === 'submenu') {
          return (
            <RadixMenu.Sub key={i}>
              <SubTrigger
                $lightMode={lightMode}
                $matchTriggerWidth={matchTriggerWidth}
                $row
                disabled={item.disabled}
              >
                {item.icon && <ItemIcon>{item.icon}</ItemIcon>}

                <ItemCopy>
                  <h1>{item.label}</h1>
                  {item.description && <p>{item.description}</p>}
                </ItemCopy>

                <ItemChevron>
                  <RiArrowRightSLine />
                </ItemChevron>
              </SubTrigger>

              <RadixMenu.Portal>
                <SubContent
                  $lightMode={lightMode}
                  data-metorial-menu-content="true"
                  sideOffset={2}
                  alignOffset={-5}
                  style={{ zIndex: zIndex + 1 }}
                >
                  {renderItems(item.items)}
                </SubContent>
              </RadixMenu.Portal>
            </RadixMenu.Sub>
          );
        }

        return (
          <Item
            key={i}
            $lightMode={lightMode}
            $matchTriggerWidth={matchTriggerWidth}
            $row={!!item.icon}
            onClick={() => {
              item.onClick?.();
              if (item.id != null) onItemClick?.(item.id);
            }}
            disabled={item.disabled}
            asChild
          >
            <button type="button" disabled={item.disabled}>
              {item.icon ? (
                <>
                  <ItemIcon>{item.icon}</ItemIcon>

                  <ItemCopy>
                    <h1>{item.label}</h1>
                    {item.description && <p>{item.description}</p>}
                  </ItemCopy>
                </>
              ) : (
                <>
                  <h1>{item.label}</h1>
                  {item.description && <p>{item.description}</p>}
                </>
              )}
            </button>
          </Item>
        );
      });

    return (
      <RadixMenu.Root open={open} onOpenChange={setOpen}>
        {/* Props and the ref are forwarded to the trigger so the menu can itself be the child
            of a tooltip trigger, and the open state is published so a tooltip on the trigger
            knows to hide. */}
        <OverlayOpenProvider value={open}>
          <RadixMenu.Trigger aria-label={label} {...triggerProps} asChild ref={ref}>
            {children}
          </RadixMenu.Trigger>
        </OverlayOpenProvider>

        <RadixMenu.Portal>
          <Content
            $lightMode={lightMode}
            $matchTriggerWidth={matchTriggerWidth}
            data-metorial-menu-content="true"
            sideOffset={5}
            style={{ zIndex }}
            onPointerDownOutside={markOverlayPointerDismiss}
          >
            {title && (
              <>
                <Title $lightMode={lightMode}>{title}</Title>
                <Separator $lightMode={lightMode} />
              </>
            )}

            {renderItems(items)}
          </Content>
        </RadixMenu.Portal>
      </RadixMenu.Root>
    );
  }
);
