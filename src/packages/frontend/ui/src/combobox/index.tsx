import { Combobox as BaseCombobox } from '@base-ui/react/combobox';
import { VisuallyHidden } from '@radix-ui/react-visually-hidden';
import { RiArrowDownSLine, RiCheckLine } from '@remixicon/react';
import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { keyframes, styled } from 'styled-components';
import { ButtonSize, getButtonSize } from '../button/constants';
import { useDialogContext } from '../dialog/state';
import { Error } from '../error';
import { InputDescription, InputLabel } from '../input';
import { Spinner } from '../spinner';
import { theme } from '../theme';

let fadeIn = keyframes`
  from {
    transform: scale(0.98);
    opacity: 0;
  }

  to {
    transform: scale(1);
    opacity: 1;
  }
`;

let Wrapper = styled('div')`
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  width: 100%;
`;

let InputGroup = styled(BaseCombobox.InputGroup)`
  outline: 1px solid transparent;
  background: ${theme.colors.gray300};
  color: ${theme.colors.foreground};
  display: flex;
  width: 100%;
  transition: all 0.3s ease;
  gap: 8px;
  align-items: center;

  &:focus-within {
    background: ${theme.colors.gray400};
    outline: 1px solid ${theme.colors.gray600};
  }

  &[data-disabled] {
    opacity: 0.6;
    cursor: not-allowed;
  }
`;

let Input = styled(BaseCombobox.Input)`
  flex-grow: 1;
  border: none;
  background: transparent;
  height: 100%;
  outline: none;
  min-width: 0;

  &::placeholder {
    color: ${theme.colors.gray700};
  }

  &:disabled {
    cursor: not-allowed;
  }
`;

let Trigger = styled(BaseCombobox.Trigger).attrs({
  type: 'button'
})<{ $loading: boolean; $animateIn: boolean }>`
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: transparent;
  color: ${theme.colors.gray700};
  cursor: pointer;
  padding: 0;
  opacity: ${d => (d.$loading ? 0 : 1)};
  transform: scale(${d => (d.$loading ? 0.85 : 1)});
  transition: ${d =>
    d.$animateIn
      ? 'opacity 0.3s ease 0.08s, transform 0.3s ease 0.08s, color 0.3s ease'
      : 'opacity 0s linear, transform 0s linear, color 0.18s ease'};

  &:focus {
    outline: none;
    color: ${theme.colors.gray900};
  }

  &:disabled {
    cursor: not-allowed;
  }
`;

let EndSlot = styled('div')`
  width: 28px;
  align-self: stretch;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  padding-right: 12px;
  flex-shrink: 0;
`;

let SpinnerSlot = styled('div')<{ $visible: boolean }>`
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: ${d => (d.$visible ? 1 : 0)};
  transform: scale(${d => (d.$visible ? 1 : 0.85)});
  transition:
    opacity 0.3s ease,
    transform 0.3s ease;
  pointer-events: none;
`;

let Positioner = styled(BaseCombobox.Positioner)`
  width: var(--anchor-width);
  z-index: 9999;
`;

let Popup = styled(BaseCombobox.Popup)`
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 6px;
  box-shadow: ${theme.shadows.medium};
  background: ${theme.colors.gray200};
  border: 1px solid ${theme.colors.gray400};
  border-radius: 10px;
  max-height: min(320px, var(--available-height));
  overflow: hidden;

  &[data-open] {
    animation: ${fadeIn} 0.15s ease forwards;
  }
`;

let List = styled(BaseCombobox.List)`
  display: flex;
  flex-direction: column;
  gap: 4px;
  overflow: auto;
  padding-right: 2px;
`;

let Group = styled(BaseCombobox.Group)`
  display: flex;
  flex-direction: column;
  gap: 4px;
`;

let GroupLabel = styled(BaseCombobox.GroupLabel)`
  font-size: 11px;
  font-weight: 600;
  color: ${theme.colors.gray700};
  padding: 6px 8px 2px;
  letter-spacing: 0.04em;
`;

let Item = styled(BaseCombobox.Item)`
  display: flex;
  align-items: center;
  gap: 6px;
  min-height: 38px;
  padding: 8px 10px;
  border-radius: 8px;
  outline: none;
  cursor: pointer;
  transition: background 0.2s ease;

  &:hover,
  &[data-highlighted] {
    background: ${theme.colors.gray300};
  }

  &[data-selected] {
    background: ${theme.colors.gray400};
  }

  &[data-disabled] {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

let ItemIndicator = styled(BaseCombobox.ItemIndicator)`
  display: flex;
  align-items: center;
  justify-content: center;
  color: ${theme.colors.gray800};
`;

let ItemIndicatorSlot = styled('div')`
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
`;

let ItemContent = styled('div')`
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
  flex: 1;
`;

let ItemLabel = styled('div')`
  font-size: 14px;
  font-weight: 500;
  color: ${theme.colors.foreground};
  line-height: 1.2;
`;

let ItemDescription = styled('div')`
  font-size: 12px;
  color: ${theme.colors.gray700};
  line-height: 1.35;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

let EmptyState = styled(BaseCombobox.Empty)`
  font-size: 13px;
  color: ${theme.colors.gray700};
  padding: 10px;
  text-align: center;

  &:empty {
    display: none;
    padding: 0;
  }
`;

let Footer = styled('div')`
  font-size: 12px;
  color: ${theme.colors.gray700};
  padding: 4px 8px 2px;
`;

export type ComboboxItemData<TData = unknown> = {
  id: string;
  label: string;
  description?: React.ReactNode;
  disabled?: boolean;
  keywords?: string[];
  data?: TData;
};

export type ComboboxGroupData<TData = unknown> = {
  label: React.ReactNode;
  items: ComboboxItemData<TData>[];
};

export type ComboboxData<TData = unknown> =
  | ComboboxItemData<TData>[]
  | ComboboxGroupData<TData>[];

export type ComboboxProviderArgs<TData = unknown> = {
  search: string;
  searchQuery?: string;
  value?: string | null;
};

export type ComboboxProviderResult<TData = unknown> = {
  items: ComboboxData<TData>;
  isLoading?: boolean;
  status?: React.ReactNode;
  empty?: React.ReactNode;
};

type CachedComboboxProviderResult<TData = unknown> = {
  items: ComboboxData<TData>;
  status?: React.ReactNode;
  empty?: React.ReactNode;
};

type ComboboxPropsBase<TData> = {
  size?: ButtonSize;
  label?: React.ReactNode;
  description?: React.ReactNode;
  hideLabel?: boolean;
  error?: React.ReactNode;
  placeholder?: string;
  disabled?: boolean;
  readOnly?: boolean;
  required?: boolean;
  value?: string | null;
  valueLabel?: string;
  debounceMs?: number;
  noResultsMessage?: React.ReactNode;
  inputRef?: React.Ref<HTMLInputElement>;
  onChange?: (value: string | null, item: ComboboxItemData<TData> | null) => void;
  onSearchChange?: (value: string) => void;
  renderItem?: (item: ComboboxItemData<TData>) => React.ReactNode;
} & Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  'size' | 'value' | 'defaultValue' | 'onChange'
>;

type StaticComboboxProps<TData> = ComboboxPropsBase<TData> & {
  items?: ComboboxData<TData>;
  provider?: never;
};

type ProviderComboboxProps<TData> = ComboboxPropsBase<TData> & {
  items?: never;
  provider: (args: ComboboxProviderArgs<TData>) => ComboboxProviderResult<TData>;
};

export type ComboboxProps<TData = unknown> =
  | StaticComboboxProps<TData>
  | ProviderComboboxProps<TData>;

let useDebouncedValue = <T,>(value: T, delay: number) => {
  let [debouncedValue, setDebouncedValue] = useState(() => value);

  useEffect(() => {
    let timeout = window.setTimeout(() => setDebouncedValue(value), delay);
    return () => window.clearTimeout(timeout);
  }, [delay, value]);

  return debouncedValue;
};

let normalizeGroups = <TData,>(items: ComboboxData<TData> | undefined) => {
  if (!items || items.length === 0) return [] as ComboboxGroupData<TData>[];
  if ('items' in items[0]) return items as ComboboxGroupData<TData>[];

  return [
    {
      label: null,
      items: items as ComboboxItemData<TData>[]
    }
  ];
};

let flattenGroups = <TData,>(groups: ComboboxGroupData<TData>[]) => {
  return groups.flatMap(group => group.items);
};

let matchesItem = <TData,>(item: ComboboxItemData<TData>, searchQuery?: string) => {
  if (!searchQuery) return true;

  let query = searchQuery.toLocaleLowerCase();
  let searchable = [item.label, ...(item.keywords ?? [])];

  if (typeof item.description == 'string') searchable.push(item.description);

  return searchable.some(value => value.toLocaleLowerCase().includes(query));
};

let filterGroups = <TData,>(items: ComboboxData<TData> | undefined, searchQuery?: string) => {
  let groups = normalizeGroups(items);
  if (!searchQuery) return groups;

  return groups
    .map(group => ({
      ...group,
      items: group.items.filter(item => matchesItem(item, searchQuery))
    }))
    .filter(group => group.items.length > 0);
};

let createLabelCache = <TData,>(items: ComboboxItemData<TData>[]) => {
  return items.reduce(
    (acc, item) => {
      acc[item.id] = item.label;
      return acc;
    },
    {} as Record<string, string>
  );
};

let ComboboxInner = <TData,>({
  items,
  isLoading,
  status,
  empty,
  search,
  setSearch,
  size = '3',
  label,
  description,
  hideLabel,
  error,
  placeholder,
  disabled,
  readOnly,
  required,
  value,
  valueLabel,
  noResultsMessage = 'No results found.',
  inputRef,
  onChange,
  onSearchChange,
  renderItem,
  ...inputProps
}: ComboboxPropsBase<TData> &
  ComboboxProviderResult<TData> & {
    search: string;
    setSearch: (value: string) => void;
  }) => {
  let generatedId = useId();
  let { id: providedId, name, onFocus, ...restInputProps } = inputProps;
  let id = providedId ?? generatedId;
  let sizeStyles = getButtonSize(size);
  let normalizedValue = value ?? null;
  let normalizedGroups = useMemo(() => normalizeGroups(items), [items]);
  let flatItems = useMemo(() => flattenGroups(normalizedGroups), [normalizedGroups]);
  let [labelCache, setLabelCache] = useState<Record<string, string>>(() =>
    createLabelCache(flatItems)
  );
  let selectedItem = flatItems.find(item => item.id === normalizedValue) ?? null;
  let selectedLabel =
    selectedItem?.label ??
    (normalizedValue ? labelCache[normalizedValue] : undefined) ??
    valueLabel ??
    '';
  let [open, setOpen] = useState(false);
  let previousLoading = useRef(!!isLoading);
  let [animateArrowIn, setAnimateArrowIn] = useState(false);
  let dialog = useDialogContext();
  let showLoading = open && !!isLoading;
  let clearSelectedLabelSearch = () => {
    if (search !== selectedLabel) return;
    setSearch('');
    onSearchChange?.('');
  };

  useEffect(() => {
    if (flatItems.length === 0) return;

    setLabelCache(current => ({
      ...current,
      ...createLabelCache(flatItems)
    }));
  }, [flatItems]);

  useEffect(() => {
    if (!normalizedValue || !valueLabel) return;

    setLabelCache(current => {
      if (current[normalizedValue] === valueLabel) return current;
      return {
        ...current,
        [normalizedValue]: valueLabel
      };
    });
  }, [normalizedValue, valueLabel]);

  useEffect(() => {
    if (open) return;
    setSearch(selectedLabel);
  }, [open, selectedLabel, setSearch]);

  useEffect(() => {
    let wasLoading = previousLoading.current;
    let isCurrentlyLoading = !!isLoading;

    if (wasLoading && !isCurrentlyLoading) {
      setAnimateArrowIn(true);

      let timeout = window.setTimeout(() => {
        setAnimateArrowIn(false);
      }, 300);

      previousLoading.current = isCurrentlyLoading;
      return () => window.clearTimeout(timeout);
    }

    if (isCurrentlyLoading) {
      setAnimateArrowIn(false);
    }

    previousLoading.current = isCurrentlyLoading;
  }, [isLoading]);

  return (
    <Wrapper>
      {label &&
        (hideLabel ? (
          <VisuallyHidden>
            <InputLabel htmlFor={id}>{label}</InputLabel>
          </VisuallyHidden>
        ) : (
          <InputLabel htmlFor={id}>{label}</InputLabel>
        ))}

      {description && <InputDescription>{description}</InputDescription>}

      <BaseCombobox.Root
        name={name}
        value={normalizedValue}
        itemToStringLabel={(itemValue: string) => labelCache[itemValue] ?? itemValue}
        onValueChange={(nextValue: string | null) => {
          let nextItem = flatItems.find(item => item.id === nextValue) ?? null;
          if (nextItem) {
            setLabelCache(current => ({
              ...current,
              [nextItem.id]: nextItem.label
            }));
          }
          setSearch(nextItem?.label ?? '');
          onChange?.(nextItem?.id ?? null, nextItem);
          setOpen(false);
        }}
        inputValue={search}
        onInputValueChange={(nextValue: string) => {
          setSearch(nextValue);
          onSearchChange?.(nextValue);
        }}
        open={open}
        onOpenChange={(nextOpen: boolean) => {
          setOpen(nextOpen);

          if (nextOpen) {
            clearSelectedLabelSearch();
            return;
          }

          if (!nextOpen && selectedLabel) {
            setSearch(selectedLabel);
          }
        }}
        items={flatItems}
        filteredItems={flatItems}
        autoHighlight
        disabled={disabled}
        readOnly={readOnly}
        required={required}
        inputRef={inputRef}
      >
        <InputGroup
          style={{
            height: sizeStyles.height,
            borderRadius: sizeStyles.borderRadius,
            outline: error ? `1px solid ${theme.colors.red900}` : undefined
          }}
        >
          <Input
            id={id}
            placeholder={placeholder}
            disabled={disabled}
            readOnly={readOnly}
            onFocus={e => {
              setOpen(true);
              clearSelectedLabelSearch();
              onFocus?.(e);
            }}
            style={{
              padding: sizeStyles.padding,
              paddingRight: 0,
              height: sizeStyles.height,
              fontSize: '14px'
            }}
            {...restInputProps}
          />

          <EndSlot>
            <SpinnerSlot $visible={showLoading} aria-hidden={!showLoading}>
              <Spinner size={14} foreground={theme.colors.gray700} background="transparent" />
            </SpinnerSlot>

            <Trigger
              $animateIn={animateArrowIn}
              $loading={showLoading}
              aria-label={typeof label == 'string' ? label : 'Toggle options'}
            >
              <RiArrowDownSLine size={16} />
            </Trigger>
          </EndSlot>
        </InputGroup>

        <BaseCombobox.Portal container={dialog?.contentRef}>
          <Positioner sideOffset={6}>
            <Popup>
              <List>
                {normalizedGroups.map((group, groupIndex) =>
                  group.label ? (
                    <Group key={groupIndex}>
                      <GroupLabel>{group.label}</GroupLabel>
                      {group.items.map(item => (
                        <Item key={item.id} value={item.id} disabled={item.disabled}>
                          <ItemIndicatorSlot>
                            <ItemIndicator>
                              <RiCheckLine size={14} />
                            </ItemIndicator>
                          </ItemIndicatorSlot>
                          <ItemContent>
                            {renderItem ? (
                              renderItem(item)
                            ) : (
                              <>
                                <ItemLabel>{item.label}</ItemLabel>
                                {item.description && (
                                  <ItemDescription>{item.description}</ItemDescription>
                                )}
                              </>
                            )}
                          </ItemContent>
                        </Item>
                      ))}
                    </Group>
                  ) : (
                    group.items.map(item => (
                      <Item key={item.id} value={item.id} disabled={item.disabled}>
                        <ItemIndicatorSlot>
                          <ItemIndicator>
                            <RiCheckLine size={14} />
                          </ItemIndicator>
                        </ItemIndicatorSlot>
                        <ItemContent>
                          {renderItem ? (
                            renderItem(item)
                          ) : (
                            <>
                              <ItemLabel>{item.label}</ItemLabel>
                              {item.description && (
                                <ItemDescription>{item.description}</ItemDescription>
                              )}
                            </>
                          )}
                        </ItemContent>
                      </Item>
                    ))
                  )
                )}

                {!isLoading && <EmptyState>{empty ?? noResultsMessage}</EmptyState>}
              </List>

              {status && (
                <Footer>
                  <BaseCombobox.Status>{status}</BaseCombobox.Status>
                </Footer>
              )}
            </Popup>
          </Positioner>
        </BaseCombobox.Portal>
      </BaseCombobox.Root>

      {error && (
        <Error size={12} style={{ marginTop: 6 }}>
          {error}
        </Error>
      )}
    </Wrapper>
  );
};

let ProvidedCombobox = <TData,>({
  provider,
  value,
  ...props
}: ProviderComboboxProps<TData>) => {
  let [search, setSearch] = useState(props.valueLabel ?? '');
  let immediateSearchQuery = search.trim() || undefined;
  let debouncedSearchQuery =
    useDebouncedValue(immediateSearchQuery, props.debounceMs ?? 500) || undefined;
  let searchQuery = immediateSearchQuery ? debouncedSearchQuery : undefined;
  let isSearchPending = immediateSearchQuery !== searchQuery;
  let cacheRef = useRef<Map<string, CachedComboboxProviderResult<TData>>>(new Map());
  let liveResult = provider({
    search,
    searchQuery,
    value
  });
  let resolvedQueryKey = searchQuery ?? '';
  let pendingQueryKey = immediateSearchQuery ?? '';
  let activeCacheKey = isSearchPending ? pendingQueryKey : resolvedQueryKey;

  useEffect(() => {
    if (liveResult.isLoading) return;

    cacheRef.current.set(resolvedQueryKey, {
      items: liveResult.items,
      status: liveResult.status,
      empty: liveResult.empty
    });
  }, [liveResult.empty, liveResult.isLoading, liveResult.items, liveResult.status, resolvedQueryKey]);

  let cachedResult = cacheRef.current.get(activeCacheKey);
  let result =
    cachedResult && (liveResult.isLoading || isSearchPending)
      ? {
          items: cachedResult.items,
          status: liveResult.status ?? cachedResult.status,
          empty: liveResult.empty ?? cachedResult.empty,
          isLoading: true
        }
      : liveResult;

  return (
    <ComboboxInner
      {...props}
      value={value}
      search={search}
      setSearch={setSearch}
      {...result}
      isLoading={result.isLoading || (isSearchPending && !cachedResult)}
      onSearchChange={props.onSearchChange}
    />
  );
};

let StaticCombobox = <TData,>({ items, ...props }: StaticComboboxProps<TData>) => {
  let [search, setSearch] = useState(props.valueLabel ?? '');
  let filteredItems = useMemo(() => filterGroups(items, search), [items, search]);

  return (
    <ComboboxInner
      {...props}
      items={filteredItems}
      search={search}
      setSearch={setSearch}
      onSearchChange={props.onSearchChange}
    />
  );
};

export let Combobox = <TData,>(props: ComboboxProps<TData>) => {
  if ('provider' in props && props.provider) {
    return <ProvidedCombobox {...props} />;
  }

  return <StaticCombobox {...props} />;
};
