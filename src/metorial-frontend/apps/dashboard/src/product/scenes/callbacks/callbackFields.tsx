import * as RadixPopover from '@radix-ui/react-popover';
import { RiArrowDownSLine } from '@remixicon/react';
import { Checkbox, Error, InputDescription, InputLabel, theme } from '@metorial/ui';
import { type ReactNode, useId } from 'react';
import { keyframes, styled } from 'styled-components';

let MaskedField = styled.div`
  display: flex;
  flex-direction: column;
`;

let MaskedValue = styled.pre`
  display: block;
  margin: 0;
  padding: 10px;
  border: 1px solid ${theme.colors.gray300};
  border-radius: 8px;
  background: ${theme.colors.gray100};
  color: ${theme.colors.foreground};
  font-size: 14px;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
`;

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

let CompactField = styled.div`
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
`;

let CompactTrigger = styled(RadixPopover.Trigger).attrs({ type: 'button' })`
  display: flex;
  width: 100%;
  height: 36px;
  padding: 0 12px;
  border: none;
  border-radius: 10px;
  outline: 1px solid transparent;
  background: ${theme.colors.gray300};
  color: ${theme.colors.foreground};
  font-size: 14px;
  font-weight: 500;
  gap: 10px;
  align-items: center;
  justify-content: space-between;
  transition: all 0.3s ease;

  &:focus,
  &:focus-within {
    outline-color: ${theme.colors.gray600};
    background: ${theme.colors.gray400};
  }

  &:disabled {
    cursor: not-allowed;
    opacity: 0.55;
  }

  &[data-placeholder] {
    color: ${theme.colors.gray700};
  }
`;

let CompactTriggerValue = styled.div`
  display: flex;
  flex: 1;
  min-width: 0;
  overflow: hidden;
`;

let SummaryChip = styled.span`
  max-width: 100%;
  padding: 3px 5px;
  border-radius: 5px;
  overflow: hidden;
  background: ${theme.colors.foreground};
  color: ${theme.colors.background};
  box-shadow: ${theme.shadows.small};
  font-size: 12px;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

let Placeholder = styled.span`
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

let CompactContent = styled(RadixPopover.Content)`
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  width: var(--radix-popover-trigger-width);
  max-height: min(400px, var(--radix-popover-content-available-height));
  padding: 15px;
  border-radius: 8px;
  overflow-y: auto;
  background: ${theme.colors.background};
  box-shadow: ${theme.shadows.medium};
  font-size: 14px;
  font-weight: 500;
  gap: 10px;
  z-index: 9999;

  &[data-state='open'] {
    animation: ${fadeIn} 0.15s ease forwards;
  }
`;

export let CallbackMaskedValue = (p: { value: string; label?: string }) => (
  <MaskedField>
    {p.label && <InputLabel as="div">{p.label}</InputLabel>}
    <MaskedValue>{p.value}</MaskedValue>
  </MaskedField>
);

export let CallbackCompactMultiSelect = (p: {
  value?: readonly string[];
  onChange?: (value: string[]) => void;
  label?: string;
  description?: ReactNode;
  placeholder?: string;
  summary: ReactNode;
  disabled?: boolean;
  error?: string | false;
  items: readonly {
    id: string;
    label: string;
    disabled?: boolean;
  }[];
}) => {
  let id = useId();
  let selectedValues = p.value ?? [];
  let hasValue = selectedValues.length > 0;

  let updateItem = (itemId: string, checked: boolean) => {
    if (p.disabled) return;

    if (checked) {
      if (!selectedValues.includes(itemId)) {
        p.onChange?.([...selectedValues, itemId]);
      }
      return;
    }

    p.onChange?.(selectedValues.filter(value => value !== itemId));
  };

  return (
    <CompactField>
      {p.label && <InputLabel htmlFor={id}>{p.label}</InputLabel>}
      {p.description && <InputDescription>{p.description}</InputDescription>}

      <RadixPopover.Root>
        <CompactTrigger
          id={id}
          disabled={p.disabled}
          aria-label={p.label}
          data-placeholder={hasValue ? undefined : ''}
        >
          <CompactTriggerValue>
            {hasValue ? (
              <SummaryChip>{p.summary}</SummaryChip>
            ) : (
              <Placeholder>{p.placeholder}</Placeholder>
            )}
          </CompactTriggerValue>
          <RiArrowDownSLine size={14} style={{ flexShrink: 0, opacity: 0.5 }} />
        </CompactTrigger>

        <RadixPopover.Portal>
          <CompactContent
            sideOffset={5}
            role="group"
            aria-label={`${p.label ?? 'Select'} options`}
          >
            {p.items.map(item => (
              <Checkbox
                key={item.id}
                checked={selectedValues.includes(item.id)}
                onCheckedChange={checked => updateItem(item.id, checked)}
                label={item.label}
                disabled={item.disabled || p.disabled}
              />
            ))}
          </CompactContent>
        </RadixPopover.Portal>
      </RadixPopover.Root>

      {p.error && <Error>{p.error}</Error>}
    </CompactField>
  );
};
