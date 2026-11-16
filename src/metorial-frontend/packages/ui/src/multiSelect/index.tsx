import * as RadixPopover from '@radix-ui/react-popover';
import { VisuallyHidden } from '@radix-ui/react-visually-hidden';
import { RiArrowDownSLine } from '@remixicon/react';
import React, { useId, useRef, useState } from 'react';
import { useMeasure } from 'react-use';
import { keyframes, styled } from 'styled-components';
import { ControlSize, getControlSize, getFieldFontSize, useControlSize } from '../controlSize';
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

let Trigger = styled(RadixPopover.Trigger).attrs({
  type: 'button'
})`
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

let Items = styled('div')<{ $scroll?: boolean }>`
  display: flex;
  flex-direction: column;
  gap: 10px;
  max-height: ${p => (p.$scroll ? '280px' : 'none')};
  overflow-y: ${p => (p.$scroll ? 'auto' : 'visible')};
`;

let Search = styled('input')`
  width: 100%;
  flex-shrink: 0;
  border: none;
  outline: 1px solid transparent;
  font-weight: 500;
  background: ${theme.colors.gray300};
  color: ${theme.colors.foreground};

  &::placeholder {
    color: ${theme.colors.gray700};
  }

  &:focus {
    background: ${theme.colors.gray400};
    outline: 1px solid ${theme.colors.gray600};
  }
`;

let Note = styled('div')`
  font-size: 13px;
  color: ${theme.colors.gray700};
`;

let Placeholder = styled('span')`
  color: ${theme.colors.gray700};
`;

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

let matchesSearch = (item: { label: string; description?: string }, search: string) => {
  let query = search.trim().toLocaleLowerCase();
  if (!query) return true;

  return [item.label, item.description].some(text =>
    text?.toLocaleLowerCase().includes(query)
  );
};

export let MultiSelect = ({
  size: sizeProp,
  disabled,
  value,
  onChange,
  label,
  hideLabel,
  description,
  placeholder,
  error,
  items,
  valueLabels,
  searchable,
  searchPlaceholder,
  onSearchChange,
  isLoading,
  empty,
  footer
}: {
  size?: ControlSize;
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
    description?: string;
    disabled?: boolean;
  }[];
  valueLabels?: Record<string, string>;
  searchable?: boolean;
  searchPlaceholder?: string;
  // When set, the parent filters `items` itself (for example on the server); otherwise the
  // search filters them by label and description.
  onSearchChange?: (search: string) => void;
  isLoading?: boolean;
  empty?: React.ReactNode;
  footer?: React.ReactNode;
}) => {
  let id = useId();
  let [search, setSearch] = useState('');
  let searchRef = useRef<HTMLInputElement>(null);
  let selected = value ?? [];
  let labelOf = (v: string) => items.find(i => i.id === v)?.label ?? valueLabels?.[v] ?? v;
  let size = useControlSize(sizeProp);
  let sizeStyles = getControlSize(size);
  let [ref, { width }] = useMeasure();

  // A list the parent filters can leave out chosen values, which must stay listed to be removed.
  let listed = onSearchChange
    ? [
        ...selected
          .filter(v => !items.some(i => i.id === v))
          .map(v => ({ id: v, label: labelOf(v), description: undefined, disabled: false })),
        ...items
      ]
    : items.filter(item => matchesSearch(item, search));
  let emptyMessage = empty ?? (searchable ? 'No results found.' : null);

  let changeSearch = (next: string) => {
    setSearch(next);
    onSearchChange?.(next);
  };

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

      <RadixPopover.Root
        onOpenChange={open => {
          if (!open && search) changeSearch('');
        }}
      >
        <Trigger
          id={id}
          disabled={disabled}
          aria-label={label}
          style={{
            ...sizeStyles,
            fontSize: getFieldFontSize(size)
          }}
          ref={ref as any}
        >
          <TriggerValues>
            {selected.length === 0 && placeholder ? (
              <Placeholder>{placeholder}</Placeholder>
            ) : null}
            {[...selected].sort().map(v => (
              <Value key={v}>{labelOf(v)}</Value>
            ))}
          </TriggerValues>

          <RiArrowDownSLine size={14} style={{ opacity: 0.5, flexShrink: 0 }} />
        </Trigger>
        <RadixPopover.Portal>
          <Content
            sideOffset={5}
            style={{ width: width + 20, zIndex: 9999 }}
            onOpenAutoFocus={event => {
              if (!searchRef.current) return;
              event.preventDefault();
              searchRef.current.focus();
            }}
          >
            {searchable ? (
              <Search
                ref={searchRef}
                type="search"
                value={search}
                placeholder={searchPlaceholder ?? 'Search'}
                aria-label={searchPlaceholder ?? 'Search'}
                onChange={event => changeSearch(event.target.value)}
                style={{
                  height: sizeStyles.height,
                  padding: sizeStyles.padding,
                  borderRadius: sizeStyles.borderRadius,
                  fontSize: getFieldFontSize(size)
                }}
              />
            ) : null}

            <Items $scroll={searchable}>
              {listed.map(item => (
                <Item key={item.id}>
                  <Checkbox
                    checked={selected.includes(item.id)}
                    onCheckedChange={checked => {
                      if (checked) {
                        onChange?.([...selected, item.id]);
                      } else {
                        onChange?.(selected.filter(v => v !== item.id));
                      }
                    }}
                    label={item.label}
                    description={item.description}
                    disabled={item.disabled || disabled}
                  />
                </Item>
              ))}

              {isLoading ? <Note>Loading…</Note> : null}
              {!isLoading && listed.length === 0 && emptyMessage ? (
                <Note>{emptyMessage}</Note>
              ) : null}
              {!isLoading && footer ? <Note>{footer}</Note> : null}
            </Items>
          </Content>
        </RadixPopover.Portal>
      </RadixPopover.Root>

      {error && <Error>{error}</Error>}
    </div>
  );
};
