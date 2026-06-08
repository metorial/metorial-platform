import {
  Button,
  Checkbox,
  DatePicker,
  Input,
  Select,
  Spacer,
  Text,
  Title,
  Tooltip,
  theme
} from '@metorial/ui';
import * as RadixPopover from '@radix-ui/react-popover';
import { RiFilter2Line } from '@remixicon/react';
import React, { memo, useEffect, useMemo, useRef, useState } from 'react';
import { keyframes, styled } from 'styled-components';
import {
  TableFilter,
  TableFilterState,
  TableFilterStateDate,
  TableFilterStateNumber,
  TableFilterStateSelect,
  TableFilterStateString
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
  if (filter.type == 'select') {
    return filter.options
      .filter(option => (state.value as string[]).includes(option.id))
      .map(option => option.label)
      .join(', ');
  }

  if (filter.type == 'number' && Array.isArray(state.value)) {
    return `${state.value[0]} - ${state.value[1]}`;
  }

  if (filter.type == 'date') {
    if (Array.isArray(state.value)) {
      return `${(state.value as any)[0].toLocaleDateString()} - ${(
        state.value as any
      )[1].toLocaleDateString()}`;
    }

    return (state.value as any).toLocaleDateString();
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
    filterState: [
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
        if ((state.value as any).length === 0) {
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

                {currentFilter?.type == 'string' && (
                  <FilterString
                    key={currentFilter.id}
                    filter={currentFilter}
                    state={currentFilterState as TableFilterStateString}
                    apply={applyFilter}
                    reset={currentFilterState ? () => resetFilter(currentFilterId) : undefined}
                  />
                )}

                {currentFilter?.type == 'select' && (
                  <FilterSelect
                    key={currentFilter.id}
                    filter={currentFilter}
                    state={currentFilterState as TableFilterStateSelect}
                    apply={applyFilter}
                    reset={currentFilterState ? () => resetFilter(currentFilterId) : undefined}
                  />
                )}

                {currentFilter?.type == 'number' && (
                  <FilterNumber
                    key={currentFilter.id}
                    filter={currentFilter}
                    state={currentFilterState as TableFilterStateNumber}
                    apply={applyFilter}
                    reset={currentFilterState ? () => resetFilter(currentFilterId) : undefined}
                  />
                )}

                {currentFilter?.type == 'date' && (
                  <FilterDate
                    key={currentFilter.id}
                    filter={currentFilter}
                    state={currentFilterState as TableFilterStateDate}
                    apply={applyFilter}
                    reset={currentFilterState ? () => resetFilter(currentFilterId) : undefined}
                  />
                )}
              </FilterContent>
            </FilterPopover>
          </RadixPopover.Portal>
        </RadixPopover.Root>

        {filterState.length > 0 && (
          <CurrentFilters $wrap={wrap}>
            {filterState.map(state => {
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

            <Button size="1" variant="ghost" onClick={() => setFilterState([])}>
              Clear all filters
            </Button>
          </CurrentFilters>
        )}
      </Wrapper>
    );
  }
);

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
              fields: filter.fields as string[],
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
              fields: filter.fields as string[],
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

  let [operation, setOperation] = useState(() => state?.operation ?? 'eq');

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
          onChange={setOperation as any}
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
            apply({
              id: filter.id,
              fields: filter.fields as string[],
              type: 'number',
              operation,
              value: operation == 'between' ? [value1Num, value2Num] : value1Num
            } as TableFilterStateNumber);
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

  let [operation, setOperation] = useState(() => state?.operation ?? 'eq');

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
          onChange={setOperation as any}
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
            apply({
              id: filter.id,
              fields: filter.fields as string[],
              type: 'date',
              operation,
              value: operation == 'between' ? [value1, value2] : value1
            } as TableFilterStateDate);
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
