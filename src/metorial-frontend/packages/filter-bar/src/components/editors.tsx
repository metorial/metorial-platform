import { Button, DatePicker, Input, Select, theme } from '@metorial/ui';
import React, { useMemo, useState } from 'react';
import { styled } from 'styled-components';
import { getListValue, type ListFilter, toggleListValue } from '../model/state';
import {
  toFilterFieldNames,
  type TableFilter,
  type TableFilterPayloadMap,
  type TableFilterState,
  type TableFilterStateDate,
  type TableFilterStateNumber
} from '../model/tableFilter';
import { useListFilterOptions } from './listOptions';
import { OptionList } from './optionList';

let Form = styled('form')`
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
`;

let Fields = styled('div')`
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 14px;
  flex: 1;
`;

let Range = styled('div')`
  display: flex;
  align-items: center;
  gap: 8px;

  & > span {
    font-size: 12px;
    color: ${theme.colors.gray600};
  }
`;

let Actions = styled('footer')`
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 10px 14px;
  border-top: 1px solid ${theme.colors.gray300};
`;

let operationItems = [
  { id: 'eq', label: 'Is' },
  { id: 'gt', label: 'Greater than' },
  { id: 'lt', label: 'Less than' },
  { id: 'gte', label: 'At least' },
  { id: 'lte', label: 'At most' },
  { id: 'between', label: 'Between' }
];

let dateOperationItems = [
  { id: 'eq', label: 'On' },
  { id: 'gt', label: 'After' },
  { id: 'lt', label: 'Before' },
  { id: 'gte', label: 'On or after' },
  { id: 'lte', label: 'On or before' },
  { id: 'between', label: 'Between' }
];

export type EditorProps<F extends TableFilter<any> = TableFilter<any>> = {
  filter: F;
  state?: TableFilterState;
  filters: TableFilterPayloadMap;
  setFilterState: React.Dispatch<React.SetStateAction<TableFilterState[]>>;
  apply: (state: TableFilterState) => void;
  maxHeight?: number;
};

export let ListEditor = ({
  filter,
  state,
  filters,
  setFilterState,
  maxHeight
}: EditorProps<ListFilter>) => {
  let [search, setSearch] = useState('');
  let selected = getListValue(state);
  let options = useListFilterOptions(filter, search, filters, selected);
  let showSearch = filter.type == 'entity' || filter.options.length > 8;

  return (
    <OptionList
      items={options.items}
      pinnedItems={options.pinnedItems}
      selected={selected}
      isLoading={options.isLoading}
      empty={options.empty}
      search={search}
      onSearch={setSearch}
      showSearch={showSearch}
      maxHeight={maxHeight}
      searchPlaceholder={
        filter.type == 'entity'
          ? (filter.searchPlaceholder ?? `Search ${filter.label.toLowerCase()}...`)
          : `Search ${filter.label.toLowerCase()}...`
      }
      onToggle={(id, checked) => setFilterState(prev => toggleListValue(prev, filter, id, checked))}
    />
  );
};

let ApplyActions = ({ valid }: { valid: boolean }) => (
  <Actions>
    <Button size="2" type="submit" disabled={!valid}>
      Apply
    </Button>
  </Actions>
);

export let StringEditor = ({ filter, state, apply }: EditorProps) => {
  let [value, setValue] = useState(() => (state?.type == 'string' ? state.value : ''));

  return (
    <Form
      onSubmit={e => {
        e.preventDefault();
        apply({
          id: filter.id,
          fields: toFilterFieldNames(filter.fields),
          type: 'string',
          operation: 'eq',
          value: value.trim()
        });
      }}
    >
      <Fields>
        <Input
          label={filter.label}
          hideLabel
          size="2"
          autoFocus
          placeholder={`Enter ${filter.label.toLowerCase()}...`}
          value={value}
          onInput={setValue}
        />
      </Fields>

      <ApplyActions valid={value.trim().length > 0} />
    </Form>
  );
};

export let NumberEditor = ({ filter, state, apply }: EditorProps) => {
  let initial = state?.type == 'number' ? state : undefined;
  let [operation, setOperation] = useState<TableFilterStateNumber['operation']>(
    initial?.operation ?? 'eq'
  );
  let [from, setFrom] = useState(() =>
    initial ? String(Array.isArray(initial.value) ? initial.value[0] : initial.value) : ''
  );
  let [to, setTo] = useState(() =>
    initial && Array.isArray(initial.value) ? String(initial.value[1]) : ''
  );

  let parsed = useMemo(() => {
    let a = parseFloat(from);
    let b = parseFloat(to);
    if (isNaN(a)) return null;
    if (operation == 'between' && (isNaN(b) || a > b)) return null;
    return { a, b };
  }, [from, to, operation]);

  return (
    <Form
      onSubmit={e => {
        e.preventDefault();
        if (!parsed) return;

        let base = { id: filter.id, fields: toFilterFieldNames(filter.fields), type: 'number' };
        apply(
          (operation == 'between'
            ? { ...base, operation, value: [parsed.a, parsed.b] }
            : { ...base, operation, value: parsed.a }) as TableFilterStateNumber
        );
      }}
    >
      <Fields>
        <Select
          label="Condition"
          hideLabel
          size="2"
          value={operation}
          items={operationItems}
          onChange={value => setOperation(value as TableFilterStateNumber['operation'])}
        />

        {operation == 'between' ? (
          <Range>
            <Input label="From" hideLabel size="2" type="number" placeholder="Min" value={from} onInput={setFrom} />
            <span>and</span>
            <Input label="To" hideLabel size="2" type="number" placeholder="Max" value={to} onInput={setTo} />
          </Range>
        ) : (
          <Input
            label="Value"
            hideLabel
            size="2"
            type="number"
            autoFocus
            placeholder="Value"
            value={from}
            onInput={setFrom}
          />
        )}
      </Fields>

      <ApplyActions valid={!!parsed} />
    </Form>
  );
};

export let DateEditor = ({ filter, state, apply }: EditorProps) => {
  let initial = state?.type == 'date' ? state : undefined;
  let [operation, setOperation] = useState<TableFilterStateDate['operation']>(
    initial?.operation ?? 'between'
  );
  let [from, setFrom] = useState<Date | undefined>(() =>
    initial ? (Array.isArray(initial.value) ? initial.value[0] : initial.value) : undefined
  );
  let [to, setTo] = useState<Date | undefined>(() =>
    initial && Array.isArray(initial.value) ? initial.value[1] : undefined
  );

  let valid = !!from && (operation != 'between' || (!!to && from <= to));

  return (
    <Form
      onSubmit={e => {
        e.preventDefault();
        if (!from) return;

        let base = { id: filter.id, fields: toFilterFieldNames(filter.fields), type: 'date' };
        if (operation == 'between') {
          if (!to) return;
          apply({ ...base, operation, value: [from, to] } as TableFilterStateDate);
          return;
        }

        apply({ ...base, operation, value: from } as TableFilterStateDate);
      }}
    >
      <Fields>
        <Select
          label="Condition"
          hideLabel
          size="2"
          value={operation}
          items={dateOperationItems}
          onChange={value => setOperation(value as TableFilterStateDate['operation'])}
        />

        {operation == 'between' ? (
          <DatePicker
            label="Date range"
            hideLabel
            size="2"
            type="range"
            placeholder="Pick a range"
            value={from && to ? [from, to] : undefined}
            onChange={value => {
              setFrom(value[0]);
              setTo(value[1]);
            }}
          />
        ) : (
          <DatePicker
            label="Date"
            hideLabel
            size="2"
            type="single"
            placeholder="Pick a date"
            value={from}
            onChange={setFrom}
          />
        )}
      </Fields>

      <ApplyActions valid={valid} />
    </Form>
  );
};

export let FilterEditor = (props: EditorProps) => {
  let { filter } = props;

  if (filter.type == 'select' || filter.type == 'entity') {
    return <ListEditor {...props} filter={filter} />;
  }

  if (filter.type == 'string') return <StringEditor {...props} />;
  if (filter.type == 'number') return <NumberEditor {...props} />;
  if (filter.type == 'date') return <DateEditor {...props} />;

  return null;
};
