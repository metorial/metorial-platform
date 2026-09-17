import {
  Button,
  Checkbox,
  DatePicker,
  Input,
  Select,
  Spacer,
  Spinner,
  Text,
  Title,
  Tooltip,
  theme
} from '@metorial/ui';
import * as RadixPopover from '@radix-ui/react-popover';
import { RiAddLine, RiFilter2Line } from '@remixicon/react';
import React, { memo, useEffect, useMemo, useRef, useState } from 'react';
import { keyframes, styled } from 'styled-components';
import {
  TableFilter,
  TableFilterState,
  TableFilterStateDate,
  TableFilterStateEntity,
  TableFilterStateNumber,
  TableFilterStateSelect,
  TableFilterStateString,
  getCachedFilterLabel,
  isEmptyFilterValue,
  rememberFilterLabels,
  toFilterFieldNames
} from './tableFilter';

let fadeIn = keyframes`
  from {
    opacity: 0;
    transform: scale(0.95) translateY(-10px);
  }

  to {
    opacity: 1;
    transform: scale(1);
  }
`;

let fadeOut = keyframes`
  from {
    opacity: 1;
    transform: scale(1);
  }

  to {
    opacity: 0;
    transform: scale(0.95) translateY(-10px);
  }
`;

let Wrapper = styled('div')<{ $fullWidth: boolean; $wrap: boolean }>`
  display: flex;
  align-items: center;
  flex-wrap: ${p => (p.$wrap ? 'wrap' : 'nowrap')};
  gap: 10px;
  width: ${p => (p.$fullWidth ? '100%' : 'auto')};
`;

let CurrentFilters = styled('div')<{ $wrap: boolean }>`
  display: flex;
  gap: 10px;
  align-items: center;
  flex-wrap: ${p => (p.$wrap ? 'wrap' : 'nowrap')};
`;

let PinnedFilters = styled('div')`
  display: flex;
  gap: 10px;
  align-items: center;
  flex-wrap: wrap;
`;

let CurrentFilter = styled('div')`
  flex-shrink: 0;
  max-width: 200px;
  height: 22px;
  border: 1px solid ${theme.colors.gray300};
  border-radius: 50px;
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 0px 8px 0px 7px;
  cursor: pointer;
  user-select: none;
`;

let FilterIcon = styled('div')`
  color: ${theme.colors.gray600};

  svg {
    height: 12;
    width: 12;
    stroke-width: 2.5;
  }
`;

let FilterLabel = styled('p')`
  color: ${theme.colors.gray800};
  font-weight: 700;
  font-size: 12px;
  flex-shrink: 0;
`;

let FilterValue = styled('p')`
  color: ${theme.colors.gray700};
  font-size: 12px;
  font-weight: 500;

  /* Truncate text */
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
`;

let FilterPopover = styled(RadixPopover.Content)<{ $compact?: boolean }>`
  background: ${theme.colors.background};
  border: 1px solid ${theme.colors.gray300};
  border-radius: 10px;
  box-shadow: ${theme.shadows.medium};
  overflow: hidden;
  z-index: 999;
  width: ${({ $compact }) =>
    $compact ? 'min(320px, calc(100vw - 32px))' : 'min(500px, calc(100vw - 32px))'};
  height: ${({ $compact }) => ($compact ? 'auto' : '350px')};
  max-height: min(350px, calc(100vh - 32px));
  display: grid;
  grid-template-columns: ${({ $compact }) => ($compact ? '1fr' : '200px auto')};
  grid-template-rows: minmax(0, 1fr);

  &[data-state='open'] {
    animation: ${fadeIn} 0.15s ease-in-out;
  }

  &[data-state='closed'] {
    animation: ${fadeOut} 0.15s ease-in-out;
  }
`;

let FilterPopoverSide = styled('div')`
  height: 100%;
  overflow-y: auto;
`;

let FilterSidebar = styled(FilterPopoverSide)`
  background: ${theme.colors.gray100};
  border-right: 1px solid ${theme.colors.gray300};
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 7px;
`;

let FilterContent = styled(FilterPopoverSide)`
  display: flex;
  flex-direction: column;

  form {
    display: flex;
    flex-direction: column;
    flex-grow: 1;
  }
`;

let FilterContentHeader = styled('div')`
  padding: 14px 20px;
  border-bottom: 1px solid ${theme.colors.gray300};
  position: sticky;
  top: 0;
  background: ${theme.colors.background};
  z-index: 999;
`;

let FilterContentBody = styled('main')`
  padding: 20px;
  flex-grow: 1;
`;

let FilterContentFooter = styled('footer')`
  padding: 14px 20px;
  border-top: 1px solid ${theme.colors.gray300};
  position: sticky;
  bottom: 0;
  background: ${theme.colors.background};
  z-index: 999;
  display: flex;
  gap: 10px;
`;

let getFilterText = (filter: TableFilter<any>, state: TableFilterState): string => {
  if (filter.type == 'select' && state.type == 'select') {
    return filter.options
      .filter(option => state.value.includes(option.id))
      .map(option => option.label)
      .join(', ');
  }

  if (filter.type == 'entity' && state.type == 'entity') {
    return state.value.map(id => getCachedFilterLabel(filter.id, id)).join(', ');
  }

  if (filter.type == 'number' && state.type == 'number') {
    if (state.operation == 'between') {
      return `${state.value[0]} - ${state.value[1]}`;
    }

    return state.value.toString();
  }

  if (filter.type == 'date' && state.type == 'date') {
    if (state.operation == 'between') {
      return `${state.value[0].toLocaleDateString()} - ${state.value[1].toLocaleDateString()}`;
    }

    return state.value.toLocaleDateString();
  }

  if (state.type == 'string') {
    return state.value;
  }

  return state.value.toString();
};

export let TableFilters = memo(
  ({
    filters,
    filterState: [filterState, setFilterState],
    fullWidth = true,
    defaultFilterId,
    resetCurrentFilterOnOpen = false,
    wrap = true,
    popoverAlign = 'end'
  }: {
    filters: TableFilter<any>[];
    filterState: readonly [
      TableFilterState[],
      React.Dispatch<React.SetStateAction<TableFilterState[]>>
    ];
    fullWidth?: boolean;
    defaultFilterId?: string;
    resetCurrentFilterOnOpen?: boolean;
    wrap?: boolean;
    popoverAlign?: 'start' | 'center' | 'end';
  }) => {
    let [open, setOpen] = useState(false);
    let closedAtRef = useRef(0);

    useEffect(() => {
      if (!open) closedAtRef.current = Date.now();
    }, [open]);

    let [currentFilterId, setCurrentFilterId] = useState(
      () => defaultFilterId ?? filters[0].id
    );
    let currentFilter = useMemo(
      () => filters.find(f => f.id == currentFilterId),
      [currentFilterId, filters]
    );

    let currentFilterState = useMemo(
      () => filterState.find(f => f.id == currentFilterId),
      [currentFilterId, filterState]
    );

    useEffect(() => {
      if (!filters.some(filter => filter.id == currentFilterId)) {
        setCurrentFilterId(defaultFilterId ?? filters[0]?.id);
      }
    }, [currentFilterId, defaultFilterId, filters]);

    useEffect(() => {
      if (!open || !resetCurrentFilterOnOpen) return;
      setCurrentFilterId(defaultFilterId ?? filters[0]?.id);
    }, [defaultFilterId, filters, open, resetCurrentFilterOnOpen]);

    let applyFilter = (state: TableFilterState) => {
      setFilterState(prev => {
        if (isEmptyFilterValue(state)) {
          return prev.filter(f => f.id != state.id);
        }

        let index = prev.findIndex(f => f.id == state.id);
        let next = [...prev];

        if (index == -1) {
          next.push(state);
        } else {
          next[index] = state;
        }

        return next;
      });
    };

    let resetFilter = (id: string) => {
      setFilterState(prev => prev.filter(f => f.id != id));
    };

    let compact = filters.length == 1;
    let pinnedFilters = useMemo(() => filters.filter(f => f.pinned), [filters]);
    let unpinnedFilterState = useMemo(
      () => filterState.filter(state => !filters.find(f => f.id == state.id)?.pinned),
      [filterState, filters]
    );

    return (
      <Wrapper $fullWidth={fullWidth} $wrap={wrap}>
        <RadixPopover.Root open={open} onOpenChange={setOpen}>
          <RadixPopover.Trigger asChild>
            <Button iconLeft={<RiFilter2Line />} size="2">
              Filter
            </Button>
          </RadixPopover.Trigger>

          <RadixPopover.Portal>
            <FilterPopover
              $compact={compact}
              side="bottom"
              align={popoverAlign}
              sideOffset={5}
              collisionPadding={16}
            >
              {!compact ? (
                <FilterSidebar>
                  {filters.map(filter => (
                    <Button
                      variant="ghost"
                      onClick={() => setCurrentFilterId(filter.id)}
                      onMouseEnter={() => setCurrentFilterId(filter.id)}
                      onFocus={() => setCurrentFilterId(filter.id)}
                      color={filter.id == currentFilterId ? 'blue' : undefined}
                      size="2"
                      key={filter.id}
                    >
                      {filter.label}
                    </Button>
                  ))}
                </FilterSidebar>
              ) : null}

              <FilterContent>
                <FilterContentHeader>
                  <Title as="h1" size="2" weight="bold">
                    {currentFilter?.description}
                  </Title>
                </FilterContentHeader>

                {currentFilter && (
                  <FilterBody
                    key={currentFilter.id}
                    filter={currentFilter}
                    state={currentFilterState}
                    apply={applyFilter}
                    reset={currentFilterState ? () => resetFilter(currentFilterId) : undefined}
                  />
                )}
              </FilterContent>
            </FilterPopover>
          </RadixPopover.Portal>
        </RadixPopover.Root>

        {pinnedFilters.length > 0 && (
          <PinnedFilters>
            {pinnedFilters.map(filter => (
              <PinnedFilterPill
                key={filter.id}
                filter={filter}
                state={filterState.find(f => f.id == filter.id)}
                apply={applyFilter}
                reset={() => resetFilter(filter.id)}
              />
            ))}
          </PinnedFilters>
        )}

        {unpinnedFilterState.length > 0 && (
          <CurrentFilters $wrap={wrap}>
            {unpinnedFilterState.map(state => {
              let filter = filters.find(f => f.id == state.id);
              if (!filter) return null;

              let text = getFilterText(filter, state);

              return (
                <Tooltip key={state.id} content={text}>
                  <CurrentFilter
                    onClick={() => {
                      if (
                        state.id == currentFilterId &&
                        (open || Date.now() - closedAtRef.current < 200)
                      ) {
                        setOpen(false);
                        return;
                      }

                      setOpen(true);
                      setCurrentFilterId(state.id);
                      setTimeout(() => setCurrentFilterId(state.id), 20);
                    }}
                  >
                    <FilterIcon>
                      <RiFilter2Line size={12} />
                    </FilterIcon>

                    <FilterLabel>{filter.label}</FilterLabel>

                    <FilterValue>{text}</FilterValue>
                  </CurrentFilter>
                </Tooltip>
              );
            })}
          </CurrentFilters>
        )}

        {filterState.length > 0 && (
          <Button size="1" variant="ghost" onClick={() => setFilterState([])}>
            Clear all filters
          </Button>
        )}
      </Wrapper>
    );
  }
);

let FilterBody = ({
  filter,
  state,
  apply,
  reset
}: {
  filter: TableFilter<any>;
  state?: TableFilterState;
  apply: (state: TableFilterState) => void;
  reset?: () => void;
}) => {
  if (filter.type == 'string') {
    return (
      <FilterString
        filter={filter}
        state={state as TableFilterStateString}
        apply={apply}
        reset={reset}
      />
    );
  }

  if (filter.type == 'select') {
    return (
      <FilterSelect
        filter={filter}
        state={state as TableFilterStateSelect}
        apply={apply}
        reset={reset}
      />
    );
  }

  if (filter.type == 'entity') {
    return (
      <FilterEntity
        filter={filter}
        state={state as TableFilterStateEntity}
        apply={apply}
        reset={reset}
      />
    );
  }

  if (filter.type == 'number') {
    return (
      <FilterNumber
        filter={filter}
        state={state as TableFilterStateNumber}
        apply={apply}
        reset={reset}
      />
    );
  }

  if (filter.type == 'date') {
    return (
      <FilterDate
        filter={filter}
        state={state as TableFilterStateDate}
        apply={apply}
        reset={reset}
      />
    );
  }

  return null;
};

let AddIconTrack = styled('div')`
  display: flex;
  align-items: center;
  width: 0;
  margin-right: 0;
  opacity: 0;
  overflow: hidden;
  transition:
    width 0.18s ease,
    margin-right 0.18s ease,
    opacity 0.18s ease;
`;

let PreviewFilter = styled(CurrentFilter)`
  gap: 0;
  border: 1px dashed ${theme.colors.gray500};

  &:hover ${AddIconTrack} {
    width: 12px;
    margin-right: 5px;
    opacity: 1;
  }
`;

let PinnedFilterPill = ({
  filter,
  state,
  apply,
  reset
}: {
  filter: TableFilter<any>;
  state?: TableFilterState;
  apply: (state: TableFilterState) => void;
  reset: () => void;
}) => {
  let [open, setOpen] = useState(false);
  let text = state ? getFilterText(filter, state) : undefined;

  return (
    <RadixPopover.Root open={open} onOpenChange={setOpen}>
      <RadixPopover.Trigger asChild>
        {text ? (
          <CurrentFilter>
            <FilterIcon>
              <RiFilter2Line size={12} />
            </FilterIcon>

            <FilterLabel>{filter.label}</FilterLabel>

            <FilterValue>{text}</FilterValue>
          </CurrentFilter>
        ) : (
          <PreviewFilter>
            <AddIconTrack>
              <FilterIcon>
                <RiAddLine size={12} />
              </FilterIcon>
            </AddIconTrack>

            <FilterLabel>{filter.label}</FilterLabel>
          </PreviewFilter>
        )}
      </RadixPopover.Trigger>

      <RadixPopover.Portal>
        <FilterPopover $compact side="bottom" align="start" sideOffset={5} collisionPadding={16}>
          <FilterContent>
            <FilterContentHeader>
              <Title as="h1" size="2" weight="bold">
                {filter.description}
              </Title>
            </FilterContentHeader>

            <FilterBody
              key={filter.id}
              filter={filter}
              state={state}
              apply={next => {
                apply(next);
                setOpen(false);
              }}
              reset={
                state
                  ? () => {
                      reset();
                      setOpen(false);
                    }
                  : undefined
              }
            />
          </FilterContent>
        </FilterPopover>
      </RadixPopover.Portal>
    </RadixPopover.Root>
  );
};

let FilterString = ({
  filter,
  state,
  apply,
  reset
}: {
  filter: TableFilter<any> & { type: 'string' };
  state?: TableFilterStateString;
  apply: (state: TableFilterStateString) => void;
  reset?: () => void;
}) => {
  let [value, setValue] = useState(() => state?.value ?? '');
  useEffect(() => setValue(state?.value ?? ''), [state]);

  return (
    <form onSubmit={e => e.preventDefault()}>
      <FilterContentBody>
        <Input
          placeholder="Value"
          size="2"
          label={filter.label}
          value={value}
          onChange={e => setValue(e.target.value)}
        />
      </FilterContentBody>

      <FilterContentFooter>
        <Button
          variant="soft"
          size="2"
          type="submit"
          onClick={() => {
            apply({
              id: filter.id,
              fields: toFilterFieldNames(filter.fields),
              type: 'string',
              operation: 'eq',
              value
            });
          }}
        >
          Apply
        </Button>

        <Button variant="soft" size="2" disabled={!reset} onClick={reset} type="button">
          Reset
        </Button>
      </FilterContentFooter>
    </form>
  );
};

let SelectList = styled('ul')`
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
`;

let SelectItem = styled('li')``;

let FilterSelect = ({
  filter,
  state,
  apply,
  reset
}: {
  filter: TableFilter<any> & { type: 'select' };
  state?: TableFilterStateSelect;
  apply: (state: TableFilterStateSelect) => void;
  reset?: () => void;
}) => {
  let [value, setValue] = useState(() => state?.value ?? []);
  useEffect(() => setValue(state?.value ?? []), [state, filter.id]);

  return (
    <form onSubmit={e => e.preventDefault()}>
      <FilterContentBody>
        <SelectList>
          {filter.options.map(item => (
            <SelectItem key={item.id}>
              <Checkbox
                label={item.label}
                checked={value.includes(item.id)}
                onCheckedChange={checked => {
                  setValue(prev => {
                    if (checked) {
                      return [...prev, item.id];
                    } else {
                      return prev.filter(id => id != item.id);
                    }
                  });
                }}
              />
            </SelectItem>
          ))}
        </SelectList>
      </FilterContentBody>

      <FilterContentFooter>
        <Button
          variant="soft"
          size="2"
          type="submit"
          onClick={() => {
            apply({
              id: filter.id,
              fields: toFilterFieldNames(filter.fields),
              type: 'select',
              operation: 'eq',
              value
            });
          }}
        >
          Apply
        </Button>

        <Button variant="soft" size="2" disabled={!reset} onClick={reset} type="button">
          Reset
        </Button>
      </FilterContentFooter>
    </form>
  );
};

let noValueLabels = (): Record<string, string> => ({});

let FilterEntity = ({
  filter,
  state,
  apply,
  reset
}: {
  filter: TableFilter<any> & { type: 'entity' };
  state?: TableFilterStateEntity;
  apply: (state: TableFilterStateEntity) => void;
  reset?: () => void;
}) => {
  let [value, setValue] = useState(() => state?.value ?? []);
  useEffect(() => setValue(state?.value ?? []), [state, filter.id]);

  let [search, setSearch] = useState('');
  let [debouncedSearch, setDebouncedSearch] = useState('');

  useEffect(() => {
    let to = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(to);
  }, [search]);

  let remoteSearch = filter.remoteSearch !== false;
  let { items, isLoading, empty } = filter.useOptions({
    search: remoteSearch ? debouncedSearch : ''
  });

  useEffect(() => rememberFilterLabels(filter.id, items), [filter.id, items]);

  let missingIds = useMemo(
    () => value.filter(id => !items.some(item => item.id == id)),
    [value, items]
  );

  let useValueLabels = filter.useValueLabels ?? noValueLabels;
  let missingLabels = useValueLabels(missingIds);

  useEffect(() => {
    let resolved = missingIds
      .filter(id => missingLabels[id])
      .map(id => ({ id, label: missingLabels[id] }));
    if (resolved.length) rememberFilterLabels(filter.id, resolved);
  }, [filter.id, missingIds, missingLabels]);

  let visibleItems = useMemo(() => {
    if (remoteSearch || !debouncedSearch.trim()) return items;

    let normalizedSearch = debouncedSearch.trim().toLowerCase();
    return items.filter(item =>
      `${item.label} ${item.description ?? ''}`.toLowerCase().includes(normalizedSearch)
    );
  }, [items, remoteSearch, debouncedSearch]);

  let pinnedMissingItems = missingIds.map(id => ({
    id,
    label: missingLabels[id] ?? getCachedFilterLabel(filter.id, id)
  }));

  let toggle = (id: string, checked: boolean) =>
    setValue(prev => (checked ? [...prev, id] : prev.filter(item => item != id)));

  return (
    <form onSubmit={e => e.preventDefault()}>
      <FilterContentBody>
        <Input
          label={`Search ${filter.label}`}
          hideLabel
          size="2"
          placeholder={filter.searchPlaceholder ?? `Search ${filter.label.toLowerCase()}...`}
          value={search}
          onChange={e => setSearch(e.target.value)}
        />

        <Spacer size={10} />

        {isLoading ? (
          <Spinner size={20} />
        ) : (
          <SelectList>
            {pinnedMissingItems.map(item => (
              <SelectItem key={item.id}>
                <Checkbox
                  label={item.label}
                  checked={value.includes(item.id)}
                  onCheckedChange={checked => toggle(item.id, checked)}
                />
              </SelectItem>
            ))}

            {visibleItems.map(item => (
              <SelectItem key={item.id}>
                <Checkbox
                  label={item.label}
                  checked={value.includes(item.id)}
                  onCheckedChange={checked => toggle(item.id, checked)}
                />
              </SelectItem>
            ))}

            {!pinnedMissingItems.length && !visibleItems.length && (
              <Text size="2" color="gray600">
                {empty ?? 'No results found.'}
              </Text>
            )}
          </SelectList>
        )}
      </FilterContentBody>

      <FilterContentFooter>
        <Button
          variant="soft"
          size="2"
          type="submit"
          onClick={() => {
            apply({
              id: filter.id,
              fields: toFilterFieldNames(filter.fields),
              type: 'entity',
              operation: 'eq',
              value
            });
          }}
        >
          Apply
        </Button>

        <Button variant="soft" size="2" disabled={!reset} onClick={reset} type="button">
          Reset
        </Button>
      </FilterContentFooter>
    </form>
  );
};

let FilterNumber = ({
  filter,
  state,
  apply,
  reset
}: {
  filter: TableFilter<any> & { type: 'number' };
  state?: TableFilterStateNumber;
  apply: (state: TableFilterStateNumber) => void;
  reset?: () => void;
}) => {
  let [value1, setValue1] = useState(
    () => (Array.isArray(state?.value) ? state.value[0] : state?.value) ?? ''
  );
  let [value2, setValue2] = useState(
    () => (Array.isArray(state?.value) ? state.value[1] : state?.value) ?? ''
  );
  useEffect(
    () => setValue1(Array.isArray(state?.value) ? state.value[0] : (state?.value ?? '')),
    [state]
  );
  useEffect(
    () => setValue2(Array.isArray(state?.value) ? state.value[1] : (state?.value ?? '')),
    [state]
  );

  let [operation, setOperation] = useState<TableFilterStateNumber['operation']>(
    () => state?.operation ?? 'eq'
  );

  let { valid, value1Num, value2Num } = useMemo(() => {
    let value1Num = parseFloat(value1.toString());
    let value2Num = parseFloat(value2.toString());

    if (isNaN(value1Num) || (operation == 'between' && isNaN(value2Num))) {
      return {
        valid: false,
        value1Num: 0,
        value2Num: 0
      };
    }

    if (operation == 'between' && value1Num > value2Num) {
      return {
        valid: false,
        value1Num: 0,
        value2Num: 0
      };
    }

    return {
      valid: true,
      value1Num,
      value2Num
    };
  }, [value1, value2, operation]);

  return (
    <form onSubmit={e => e.preventDefault()}>
      <FilterContentBody>
        <Select
          label="Operation"
          value={operation}
          onChange={value => setOperation(value as TableFilterStateNumber['operation'])}
          size="2"
          items={[
            { id: 'eq', label: 'Equals' },
            { id: 'gt', label: 'Greater than' },
            { id: 'lt', label: 'Less than' },
            { id: 'gte', label: 'Greater than or equal' },
            { id: 'lte', label: 'Less than or equal' },
            { id: 'between', label: 'Between' }
          ]}
        />

        <Spacer size={10} />

        {operation == 'between' ? (
          <div
            style={{
              display: 'flex',
              gap: 10,
              alignItems: 'center',
              width: '100%'
            }}
          >
            <Input
              placeholder="Value"
              size="2"
              label="From"
              hideLabel
              value={value1}
              type="number"
              onChange={e => setValue1(e.target.value)}
            />

            <Text as="p" size="1" weight="medium">
              and
            </Text>

            <Input
              placeholder="Value"
              size="2"
              label="To"
              hideLabel
              value={value2}
              type="number"
              onChange={e => setValue2(e.target.value)}
            />
          </div>
        ) : (
          <Input
            placeholder="Value"
            size="2"
            label="Value"
            hideLabel
            value={value1}
            type="number"
            onChange={e => setValue1(e.target.value)}
          />
        )}
      </FilterContentBody>

      <FilterContentFooter>
        <Button
          variant="soft"
          size="2"
          disabled={!valid}
          type="submit"
          onClick={() => {
            if (operation == 'between') {
              apply({
                id: filter.id,
                fields: toFilterFieldNames(filter.fields),
                type: 'number',
                operation: 'between',
                value: [value1Num, value2Num]
              });
              return;
            }

            apply({
              id: filter.id,
              fields: toFilterFieldNames(filter.fields),
              type: 'number',
              operation,
              value: value1Num
            });
          }}
        >
          Apply
        </Button>

        <Button variant="soft" size="2" disabled={!reset} onClick={reset} type="button">
          Reset
        </Button>
      </FilterContentFooter>
    </form>
  );
};

let FilterDate = ({
  filter,
  state,
  apply,
  reset
}: {
  filter: TableFilter<any> & { type: 'date' };
  state?: TableFilterStateDate;
  apply: (state: TableFilterStateDate) => void;
  reset?: () => void;
}) => {
  let [value1, setValue1] = useState(() =>
    Array.isArray(state?.value) ? state.value[0] : state?.value
  );
  let [value2, setValue2] = useState(() =>
    Array.isArray(state?.value) ? state.value[1] : state?.value
  );
  useEffect(
    () => setValue1(Array.isArray(state?.value) ? state.value[0] : state?.value),
    [state]
  );
  useEffect(
    () => setValue2(Array.isArray(state?.value) ? state.value[1] : state?.value),
    [state]
  );

  let [operation, setOperation] = useState<TableFilterStateDate['operation']>(
    () => state?.operation ?? 'eq'
  );

  let { valid } = useMemo(() => {
    if (
      !value1 ||
      (operation == 'between' && !value2) ||
      (operation == 'between' && value1 > value2!)
    ) {
      return { valid: false };
    }
    return { valid: true };
  }, [value1, value2, operation]);

  return (
    <form onSubmit={e => e.preventDefault()}>
      <FilterContentBody>
        <Select
          label="Operation"
          value={operation}
          onChange={value => setOperation(value as TableFilterStateDate['operation'])}
          size="2"
          items={[
            { id: 'eq', label: 'Equals' },
            { id: 'gt', label: 'Greater than' },
            { id: 'lt', label: 'Less than' },
            { id: 'gte', label: 'Greater than or equal' },
            { id: 'lte', label: 'Less than or equal' },
            { id: 'between', label: 'Between' }
          ]}
        />

        <Spacer size={10} />

        {operation == 'between' ? (
          <DatePicker
            placeholder="Value"
            size="2"
            label="To"
            hideLabel
            value={value1 && value2 ? [value1, value2] : undefined}
            type="range"
            onChange={val => {
              setValue1(val[0]);
              setValue2(val[1]);
            }}
          />
        ) : (
          <DatePicker
            placeholder="Value"
            size="2"
            label="Value"
            hideLabel
            value={value1}
            type="single"
            onChange={val => setValue1(val)}
          />
        )}
      </FilterContentBody>

      <FilterContentFooter>
        <Button
          variant="soft"
          size="2"
          disabled={!valid}
          type="submit"
          onClick={() => {
            if (operation == 'between') {
              if (!value1 || !value2) return;

              apply({
                id: filter.id,
                fields: toFilterFieldNames(filter.fields),
                type: 'date',
                operation: 'between',
                value: [value1, value2]
              });
              return;
            }

            if (!value1) return;

            apply({
              id: filter.id,
              fields: toFilterFieldNames(filter.fields),
              type: 'date',
              operation,
              value: value1
            });
          }}
        >
          Apply
        </Button>

        <Button variant="soft" size="2" disabled={!reset} onClick={reset} type="button">
          Reset
        </Button>
      </FilterContentFooter>
    </form>
  );
};
