import * as RadixMenu from '@radix-ui/react-dropdown-menu';
import React, { useEffect, useState } from 'react';
import { keyframes, styled } from 'styled-components';
import { theme } from '..';
import { useDialogZIndex } from '../dialog/state';

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

let Content = styled(RadixMenu.Content)<{
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

let Separator = styled(RadixMenu.Separator)<{ $lightMode?: boolean }>`
  height: 1px;
  background: ${({ $lightMode }) =>
    $lightMode ? theme.colors.gray300 : theme.colors.gray800};
`;

let Item = styled(RadixMenu.Item)<{ $lightMode?: boolean; $matchTriggerWidth?: boolean }>`
  font-size: 14px;
  font-weight: 500;
  display: flex;
  flex-direction: column;
  justify-content: center;
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
      onClick?: () => void;
    }
  | {
      id?: string;
      disabled?: boolean;
      description?: React.ReactNode;
      label: React.ReactNode;
      onClick: () => void;
    }
  | {
      type: 'separator';
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
};

export let Menu = ({
  children,
  label,
  onItemClick,
  items,
  title,
  setIsOpen,
  matchTriggerWidth,
  lightMode
}: MenuProps) => {
  let [open, setOpen] = useState(false);
  let zIndex = useDialogZIndex(open);

  useEffect(() => setIsOpen?.(open), [open]);

  return (
    <RadixMenu.Root open={open} onOpenChange={setOpen}>
      <RadixMenu.Trigger aria-label={label} asChild>
        {children}
      </RadixMenu.Trigger>
      <RadixMenu.Portal>
        <Content
          $lightMode={lightMode}
          $matchTriggerWidth={matchTriggerWidth}
          sideOffset={5}
          style={{ zIndex }}
        >
          {title && (
            <>
              <Title $lightMode={lightMode}>{title}</Title>
              <Separator $lightMode={lightMode} />
            </>
          )}

          {items.map((item: any, i) =>
            item.type === 'separator' ? (
              <Separator key={i} $lightMode={lightMode} />
            ) : (
              <Item
                key={i}
                $lightMode={lightMode}
                $matchTriggerWidth={matchTriggerWidth}
                onClick={() => {
                  item.onClick?.();
                  if (item.id != null) onItemClick?.(item.id);
                }}
                disabled={item.disabled}
                asChild
              >
                <button type="button" disabled={item.disabled}>
                  <h1>{item.label}</h1>
                  {item.description && <p>{item.description}</p>}
                </button>
              </Item>
            )
          )}
        </Content>
      </RadixMenu.Portal>
    </RadixMenu.Root>
  );
};
