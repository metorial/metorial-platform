import * as RadixPopover from '@radix-ui/react-popover';
import { VisuallyHidden } from '@radix-ui/react-visually-hidden';
import { RiArrowDownSLine } from '@remixicon/react';
import React, { useId } from 'react';
import { useMeasure } from 'react-use';
import { keyframes, styled } from 'styled-components';
import { ButtonSize, getButtonSize } from '../button/constants';
import { Checkbox } from '../checkbox';
import { Error } from '../error';
import { InputDescription, InputLabel } from '../input';
import { theme } from '../theme';

let fadeIn = keyframes`
  from {
    transform: scale(0.95);
    opacity: 0;
  }

  to {
    transform: scale(1);
    opacity: 1;
  }
`;

let Trigger = styled(RadixPopover.Trigger)`
  display: flex;
  outline: 1px solid transparent;
  background: ${theme.colors.gray300};
  color: ${theme.colors.foreground};
  outline: none;
  width: 100%;
  gap: 10px;
  align-items: center;
  justify-content: space-between;
  transition: all 0.3s ease;
  border: none;
  font-weight: 500;
  flex-shrink: 0;

  &:focus-within,
  &:focus {
    background: ${theme.colors.gray400};
    outline: 1px solid ${theme.colors.gray600};
  }

  &[data-placeholder] {
    color: ${theme.colors.gray700};
  }
`;

let Content = styled(RadixPopover.Content)`
  display: flex;
  flex-direction: column;
  transition: all 0.3s ease;
  padding: 15px;
  box-shadow: ${theme.shadows.medium};
  background: ${theme.colors.background};
  font-size: 14px;
  font-weight: 500;
  border-radius: 8px;
  gap: 10px;
  width: 100%;

  &[data-state='open'] {
    animation: ${fadeIn} 0.15s ease forwards;
  }
`;

let Item = styled('div')``;

let Value = styled('div')`
  font-size: 12px;
  color: ${theme.colors.background};
  background: ${theme.colors.foreground};
  padding: 3px 5px;
  border-radius: 5px;
  box-shadow: ${theme.shadows.small};
`;

let TriggerValues = styled('div')`
  display: flex;
  gap: 5px;
  flex-wrap: wrap;
`;

export let MultiSelect = ({
  size = '3',
  disabled,
  value,
  onChange,
  label,
  hideLabel,
  description,
  placeholder,
  error,
  items
}: {
  size?: ButtonSize;
  value?: string[];
  onChange?: (value: string[]) => void;
  label?: string;
  hideLabel?: boolean;
  description?: React.ReactNode;
  placeholder?: string;
  disabled?: boolean;
  error?: string | false;
  items: {
    id: string;
    label: string;
    disabled?: boolean;
  }[];
}) => {
  let id = useId();
  let sizeStyles = getButtonSize(size);
  let [ref, { width }] = useMeasure();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
      {label &&
        (hideLabel ? (
          <VisuallyHidden>
            <label htmlFor={id}>{label}</label>
          </VisuallyHidden>
        ) : (
          <InputLabel htmlFor={id}>{label}</InputLabel>
        ))}

      {description && <InputDescription>{description}</InputDescription>}

      <RadixPopover.Root>
        <Trigger
          id={id}
          disabled={disabled}
          aria-label={label}
          style={{
            ...sizeStyles,
            fontSize: 14
          }}
          ref={ref as any}
        >
          <TriggerValues>
            {[...(value ?? [])].sort().map(v => (
              <Value>{items.find(i => i.id === v)?.label}</Value>
            ))}
          </TriggerValues>

          <RiArrowDownSLine size={14} style={{ opacity: 0.5 }} />
        </Trigger>
        <RadixPopover.Portal>
          <Content sideOffset={5} style={{ width: width + 20, zIndex: 9999 }}>
            {items.map((item, i) => (
              <Item>
                <Checkbox
                  checked={value?.includes(item.id)}
                  onCheckedChange={checked => {
                    if (checked) {
                      onChange?.([...value!, item.id]);
                    } else {
                      onChange?.((value || [])?.filter(v => v !== item.id));
                    }
                  }}
                  label={item.label}
                  disabled={item.disabled || disabled}
                />
              </Item>
            ))}
          </Content>
        </RadixPopover.Portal>
      </RadixPopover.Root>

      {error && <Error>{error}</Error>}
    </div>
  );
};
