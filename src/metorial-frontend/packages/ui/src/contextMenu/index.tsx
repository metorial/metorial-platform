import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
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

let Trigger = styled.div`
  display: contents;
`;

let Content = styled.div<{ $closing?: boolean }>`
  position: fixed;
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
  animation: ${p => (p.$closing ? fadeOutBottom : fadeInBottom)} 0.2s ease forwards;
`;

let Separator = styled.div`
  height: 1px;
  background: ${theme.colors.gray800};
`;

let Item = styled.button`
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
  color: ${theme.colors.background};
  max-width: 250px;

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

  h1 {
    font-size: 14px;
    font-weight: 500;
    color: ${theme.colors.background};
  }

  p {
    font-size: 12px;
    color: ${theme.colors.gray600};
  }
`;

let Title = styled.div`
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

export type ContextMenuItem =
  | {
      id: string;
      disabled?: boolean;
      description?: React.ReactNode;
      label: React.ReactNode;
    }
  | {
      type: 'separator';
    };

let isSeparator = (item: ContextMenuItem): item is { type: 'separator' } =>
  'type' in item && item.type == 'separator';

export let ContextMenu = ({
  children,
  disabled,
  label,
  onItemClick,
  items,
  title,
  setIsOpen
}: {
  children: React.ReactNode;
  disabled?: boolean;
  label?: string;
  onItemClick?: (id: string) => void;
  items: ContextMenuItem[];
  title?: string;
  setIsOpen?: (isOpen: boolean) => void;
}) => {
  let [open, setOpen] = useState(false);
  let [closing, setClosing] = useState(false);
  let [position, setPosition] = useState({ x: 0, y: 0 });
  let zIndex = useDialogZIndex(open);

  let close = () => {
    setClosing(true);
    setTimeout(() => {
      setOpen(false);
      setClosing(false);
    }, 200);
  };

  useEffect(() => setIsOpen?.(open), [open]);

  useEffect(() => {
    if (!open) return;

    let handlePointerDown = () => close();
    let handleClose = () => close();
    let handleKeyDown = (e: KeyboardEvent) => {
      if (e.key == 'Escape') close();
    };

    document.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('resize', handleClose);
    window.addEventListener('scroll', handleClose, true);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('resize', handleClose);
      window.removeEventListener('scroll', handleClose, true);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  return (
    <Trigger
      aria-label={label}
      onContextMenu={e => {
        if (disabled) return;

        e.preventDefault();
        setClosing(false);
        setPosition({ x: e.clientX, y: e.clientY });
        setOpen(true);
      }}
    >
      {children}
      {open
        ? createPortal(
            <Content
              $closing={closing}
              onContextMenu={e => e.preventDefault()}
              onPointerDown={e => e.stopPropagation()}
              role="menu"
              style={{ left: position.x, top: position.y, zIndex }}
            >
              {title && (
                <>
                  <Title>{title}</Title>
                  <Separator />
                </>
              )}

              {items.map((item, i) =>
                isSeparator(item) ? (
                  <Separator key={i} role="separator" />
                ) : (
                  <Item
                    disabled={item.disabled}
                    key={i}
                    onClick={() => {
                      if (item.disabled) return;
                      onItemClick?.(item.id);
                      close();
                    }}
                    role="menuitem"
                    type="button"
                  >
                    <h1>{item.label}</h1>
                    {item.description && <p>{item.description}</p>}
                  </Item>
                )
              )}
            </Content>,
            document.body
          )
        : null}
    </Trigger>
  );
};
