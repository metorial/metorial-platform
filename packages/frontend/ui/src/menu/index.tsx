import * as RadixMenu from '@radix-ui/react-dropdown-menu';
import React, { useEffect, useLayoutEffect, useState } from 'react';
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

let Content = styled(RadixMenu.Content)`
  display: flex;
  flex-direction: column;
  transition: all 0.3s ease;
  padding: 5px;
  color: ${theme.colors.background};
  box-shadow: ${theme.shadows.large};
  background: ${theme.colors.foreground};
  border-radius: 10px;
  min-width: 200px;
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

let Separator = styled(RadixMenu.Separator)`
  height: 1px;
  background: ${theme.colors.gray800};
`;

let Item = styled(RadixMenu.Item)`
  font-size: 14px;
  font-weight: 500;
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 7px 13px;
  border-radius: 6px;
  outline: none;
  border: none;
  background: transparent;
  transition: all 0.3s ease;
  color: ${theme.colors.background};

  &:not(:disabled) {
    &:hover {
      background: ${theme.colors.gray800};
    }

    &:focus {
      background: ${theme.colors.gray800};
    }
  }

  &:disabled {
    opacity: 0.7;
  }
`;

let Title = styled(RadixMenu.Label)`
  font-size: 14px;
  font-weight: 600;
  color: ${theme.colors.gray100};
  padding: 7px 13px;
  border-radius: 6px;
  background: transparent;
  transition: all 0.3s ease;
  display: flex;
  align-items: center;
  gap: 5px;
`;

export let Menu = ({
  children,
  label,
  onItemClick,
  items,
  title,
  setIsOpen
}: {
  label?: string;
  children: React.ReactNode;
  onItemClick?: (id: string) => void;
  items: (
    | {
        id: string;
        disabled?: boolean;
        label: React.ReactNode;
      }
    | {
        type: 'separator';
      }
  )[];
  title?: string;
  setIsOpen?: (isOpen: boolean) => void;
}) => {
  let [open, setOpen] = useState(false);
  let [content, setContent] = useState<HTMLElement | null>(null);
  let zIndex = useDialogZIndex(open);

  useLayoutEffect(() => {
    let parent = content?.parentElement;
    if (parent) parent.style.zIndex = zIndex.toString();
  }, [content, zIndex]);

  useEffect(() => setIsOpen?.(open), [open]);

  return (
    <RadixMenu.Root open={open} onOpenChange={setOpen}>
      <RadixMenu.Trigger aria-label={label} asChild>
        {children}
      </RadixMenu.Trigger>
      <RadixMenu.Portal>
        <Content sideOffset={5} ref={setContent}>
          {title && (
            <>
              <Title>{title}</Title>
              <Separator />
            </>
          )}

          {items.map((item: any, i) =>
            item.type === 'separator' ? (
              <Separator key={i} />
            ) : (
              <Item
                key={i}
                onClick={() => onItemClick?.(item.id)}
                disabled={item.disabled}
                asChild
              >
                <button disabled={item.disabled}>{item.label}</button>
              </Item>
            )
          )}
        </Content>
      </RadixMenu.Portal>
    </RadixMenu.Root>
  );
};
