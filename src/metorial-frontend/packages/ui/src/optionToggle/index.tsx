import * as RadixToggleGroup from '@radix-ui/react-toggle-group';
import { VisuallyHidden } from '@radix-ui/react-visually-hidden';
import React, { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { styled } from 'styled-components';
import { theme } from '..';
import { ButtonSize, getButtonSize } from '../button/constants';
import { InputDescription, InputLabel } from '../input';
import type { ColorKey } from '../theme/colors';

export type OptionToggleItem = {
  id: string;
  label: React.ReactNode;
  disabled?: boolean;
};

let Wrapper = styled('div')`
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 8px;
  width: 100%;
`;

let Root = styled(RadixToggleGroup.Root)<{
  $fullWidth?: boolean;
  $borderRadius: string;
  $background: ColorKey;
}>`
  position: relative;
  display: inline-flex;
  width: ${({ $fullWidth }) => ($fullWidth ? '100%' : 'fit-content')};
  padding: 4px;
  border-radius: ${({ $borderRadius }) => $borderRadius};
  background: ${({ $background }) => theme.colors[$background]};
  isolation: isolate;
  transition: all 0.3s ease;

  &:focus-within {
    background: ${({ $background }) => theme.colors[$background]};
  }

  &[data-disabled] {
    opacity: 0.55;
    pointer-events: none;
  }
`;

let Indicator = styled('div')<{ $borderRadius: string }>`
  position: absolute;
  top: 4px;
  left: 4px;
  height: calc(100% - 8px);
  border-radius: ${({ $borderRadius }) => $borderRadius};
  background: ${theme.colors.background};
  box-shadow: ${theme.shadows.small};
  transition:
    transform 0.24s cubic-bezier(0.22, 1, 0.36, 1),
    width 0.24s cubic-bezier(0.22, 1, 0.36, 1),
    opacity 0.2s ease;
  z-index: 0;
`;

let Item = styled(RadixToggleGroup.Item)<{
  $fullWidth?: boolean;
  $size: ButtonSize;
  $borderRadius: string;
}>`
  position: relative;
  z-index: 1;
  display: inline-flex;
  flex: ${({ $fullWidth }) => ($fullWidth ? '1 1 0' : '0 0 auto')};
  min-width: 92px;
  min-height: ${({ $size }) => getButtonSize($size).height};
  align-items: center;
  justify-content: center;
  border: none;
  border-radius: ${({ $borderRadius }) => $borderRadius};
  background: transparent;
  padding: ${({ $size }) => getButtonSize($size).padding};
  font-size: ${({ $size }) => getButtonSize($size).fontSize};
  font-weight: 500;
  color: ${theme.colors.gray700};
  white-space: nowrap;
  cursor: pointer;
  transition: color 0.2s ease;

  &:hover,
  &:focus-visible {
    color: ${theme.colors.gray900};
    outline: none;
  }

  &[data-state='on'] {
    color: ${theme.colors.gray900};
  }

  &:disabled {
    cursor: not-allowed;
    opacity: 0.5;
  }
`;

export let OptionToggle = ({
  items,
  value,
  onChange,
  label,
  description,
  hideLabel,
  ariaLabel,
  disabled,
  fullWidth,
  background = 'gray300',
  size = '3'
}: {
  items: OptionToggleItem[];
  value: string;
  onChange?: (value: string) => void;
  label?: React.ReactNode;
  description?: React.ReactNode;
  hideLabel?: boolean;
  ariaLabel?: string;
  disabled?: boolean;
  fullWidth?: boolean;
  background?: ColorKey;
  size?: ButtonSize;
}) => {
  let id = useId();
  let labelId = `${id}-label`;
  let rootRef = useRef<HTMLDivElement | null>(null);
  let itemRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  let [indicator, setIndicator] = useState<{ width: number; left: number } | null>(null);
  let sizeStyles = getButtonSize(size);
  let itemBorderRadius = `calc(${sizeStyles.borderRadius} - 2px)`;

  let selectedItem = useMemo(() => items.find(item => item.id == value), [items, value]);
  let updateIndicator = (nextIndicator: { width: number; left: number } | null) => {
    setIndicator(current => {
      if (current === null && nextIndicator === null) return current;
      if (current && nextIndicator) {
        if (current.width === nextIndicator.width && current.left === nextIndicator.left) {
          return current;
        }
      }

      return nextIndicator;
    });
  };

  useLayoutEffect(() => {
    let measure = () => {
      let root = rootRef.current;
      let item = selectedItem ? itemRefs.current[selectedItem.id] : null;
      if (!root || !item) {
        updateIndicator(null);
        return;
      }

      updateIndicator({
        width: item.offsetWidth,
        left: item.offsetLeft - 4
      });
    };

    measure();

    let resizeObserver =
      typeof ResizeObserver == 'undefined'
        ? null
        : new ResizeObserver(() => {
            measure();
          });

    if (rootRef.current) resizeObserver?.observe(rootRef.current);
    if (selectedItem) {
      let selectedNode = itemRefs.current[selectedItem.id];
      if (selectedNode) resizeObserver?.observe(selectedNode);
    }

    return () => resizeObserver?.disconnect();
  }, [items, selectedItem, value]);

  useEffect(() => {
    let handleResize = () => {
      let root = rootRef.current;
      let item = selectedItem ? itemRefs.current[selectedItem.id] : null;
      if (!root || !item) {
        updateIndicator(null);
        return;
      }

      updateIndicator({
        width: item.offsetWidth,
        left: item.offsetLeft - 4
      });
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [selectedItem]);

  return (
    <Wrapper>
      {label ? (
        hideLabel ? (
          <VisuallyHidden>
            <InputLabel id={labelId}>{label}</InputLabel>
          </VisuallyHidden>
        ) : (
          <InputLabel id={labelId} style={{ marginBottom: 0 }}>
            {label}
          </InputLabel>
        )
      ) : null}

      {description && (
        <InputDescription style={{ marginBottom: 0 }}>{description}</InputDescription>
      )}

      <Root
        ref={rootRef}
        type="single"
        value={value}
        onValueChange={nextValue => {
          if (!nextValue || nextValue == value) return;
          onChange?.(nextValue);
        }}
        disabled={disabled}
        aria-label={!label ? ariaLabel : undefined}
        aria-labelledby={label ? labelId : undefined}
        $fullWidth={fullWidth}
        $borderRadius={sizeStyles.borderRadius}
        $background={background}
      >
        <Indicator
          aria-hidden
          $borderRadius={itemBorderRadius}
          style={{
            opacity: indicator ? 1 : 0,
            width: indicator?.width,
            transform: `translateX(${indicator?.left ?? 0}px)`
          }}
        />

        {items.map(item => (
          <Item
            key={item.id}
            value={item.id}
            disabled={disabled || item.disabled}
            ref={element => {
              itemRefs.current[item.id] = element;
            }}
            $fullWidth={fullWidth}
            $size={size}
            $borderRadius={itemBorderRadius}
          >
            {item.label}
          </Item>
        ))}
      </Root>
    </Wrapper>
  );
};
