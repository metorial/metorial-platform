import * as RadixSelect from '@radix-ui/react-select';
import { VisuallyHidden } from '@radix-ui/react-visually-hidden';
import { RiArrowDownSLine, RiArrowUpSLine, RiCheckLine } from '@remixicon/react';
import React, { useEffect, useId, useMemo } from 'react';
import { keyframes, styled } from 'styled-components';
import { ButtonSize, getButtonSize } from '../button/constants';
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

let Trigger = styled(RadixSelect.Trigger)`
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
    background: ${theme.colors.gray300};
    outline: 1px solid ${theme.colors.gray600};
  }

  &[data-placeholder] {
    color: ${theme.colors.gray700};
  }
`;

let Content = styled(RadixSelect.Content)`
  display: flex;
  flex-direction: column;
  transition: all 0.3s ease;
  padding: 5px;
  box-shadow: ${theme.shadows.medium};
  background: ${theme.colors.gray200};
  border: 1px solid ${theme.colors.gray400};
  font-size: 14px;
  font-weight: 500;
  border-radius: 10px;
  gap: 5px;

  &[data-state='open'] {
    animation: ${fadeIn} 0.15s ease forwards;
  }
`;

let Separator = styled(RadixSelect.Separator)`
  height: 1;
  background: ${theme.colors.gray300};
  margin: 5px 0;
`;

let Item = styled(RadixSelect.Item)`
  font-size: 14;
  font-weight: 500;
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 5px 10px 5px 5px;
  border-radius: 6;
  outline: none;
  cursor: pointer;
  height: 30px;
  border-radius: 5px;

  &:hover {
    background: ${theme.colors.gray300};
  }

  &:focus {
    background: ${theme.colors.gray300};
  }

  &[data-state='checked'] {
    background: ${theme.colors.gray400};
  }

  &:disabled,
  &[data-disabled] {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

let Indicator = styled(RadixSelect.ItemIndicator)`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  opacity: 0.5;
`;

export let Select = ({
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
  value?: string;
  onChange?: (value: string) => void;
  label?: string;
  hideLabel?: boolean;
  description?: React.ReactNode;
  placeholder?: string;
  disabled?: boolean;
  error?: string | false;
  items: (
    | {
        id: string;
        label: string;
        disabled?: boolean;
      }
    | {
        type: 'separator';
      }
  )[];
}) => {
  let id = useId();
  let sizeStyles = getButtonSize(size);

  let disabledItems = useMemo(
    () =>
      items
        .filter((item: any) => item.disabled)
        .map((item: any) => item.id)
        .sort()
        .join(','),
    [items]
  );
  useEffect(() => {
    let disabledSelected = (items as any).find(
      (item: { id: string; disabled: boolean }) => item.id === value && item.disabled
    );
    if (disabledSelected) {
      let notDisabled = (items as any).find(
        (item: { id: string; disabled: boolean }) => !item.disabled
      );

      if (notDisabled) onChange?.(notDisabled.id);
    }
  }, [value, disabledItems]);

  return (
    <div
      style={{ display: 'flex', flexDirection: 'column', flexShrink: 0, textAlign: 'initial' }}
    >
      {label &&
        (hideLabel ? (
          <VisuallyHidden>
            <label htmlFor={id}>{label}</label>
          </VisuallyHidden>
        ) : (
          <InputLabel htmlFor={id}>{label}</InputLabel>
        ))}

      {description && <InputDescription>{description}</InputDescription>}

      <RadixSelect.Root value={value} onValueChange={onChange}>
        <Trigger
          id={id}
          disabled={disabled}
          aria-label={label}
          style={{
            ...sizeStyles,
            fontSize: 14
          }}
        >
          <RadixSelect.Value placeholder={placeholder} />
          <RadixSelect.Icon>
            <RiArrowDownSLine size={14} style={{ opacity: 0.5 }} />
          </RadixSelect.Icon>
        </Trigger>
        <RadixSelect.Portal>
          <Content style={{ zIndex: 9999 }}>
            <RadixSelect.ScrollUpButton className="SelectScrollButton">
              <RiArrowUpSLine size={14} />
            </RadixSelect.ScrollUpButton>

            <RadixSelect.Viewport className="SelectViewport">
              {items.map((item: any, i) =>
                item.type == 'separator' ? (
                  <Separator key={i} />
                ) : (
                  <Item value={item.id} key={i} disabled={item.disabled}>
                    <div style={{ width: 20 }}>
                      <Indicator>
                        <RiCheckLine size={12} strokeWidth={3.5} />
                      </Indicator>
                    </div>

                    <RadixSelect.ItemText>{item.label}</RadixSelect.ItemText>
                  </Item>
                )
              )}
            </RadixSelect.Viewport>

            <RadixSelect.ScrollDownButton className="SelectScrollButton">
              <RiArrowDownSLine size={14} />
            </RadixSelect.ScrollDownButton>
          </Content>
        </RadixSelect.Portal>
      </RadixSelect.Root>

      {error && <Error>{error}</Error>}
    </div>
  );
};
