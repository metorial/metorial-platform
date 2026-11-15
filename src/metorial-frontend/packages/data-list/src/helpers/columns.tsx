import { RenderDate, Text } from '@metorial/ui';
import { ID } from '@metorial/ui-product';
import React from 'react';
import type { TableColumn } from '../types';
import { StatusBadge, type StatusDescriptor } from './status';

export let EmptyValue = ({ children = '—' }: { children?: React.ReactNode }) => (
  <Text size="2" color="gray600">
    {children}
  </Text>
);

type ColumnBase = {
  id?: string;
  header?: React.ReactNode;
  isDefault?: boolean;
};

let read = (row: any, key: string): any => row?.[key];

let pluralize = (count: number, noun: string) => `${count} ${count == 1 ? noun : `${noun}s`}`;

export let col = {
  name: <Item extends { id: string }>(
    opts: ColumnBase & {
      get?: (row: Item) => React.ReactNode;
      description?: false | ((row: Item) => React.ReactNode);
      fallback?: string;
    } = {}
  ): TableColumn<Item> => ({
    id: opts.id ?? 'name',
    isDefault: opts.isDefault ?? true,
    header: opts.header ?? 'Name',
    render: row => {
      let name = opts.get ? opts.get(row) : read(row, 'name');
      let description =
        opts.description === false
          ? null
          : opts.description
            ? opts.description(row)
            : read(row, 'description');

      return (
        <div>
          <Text size="2" weight="strong">
            {name || opts.fallback || 'Unnamed'}
          </Text>
          {description && (
            <Text size="1" color="gray600">
              {description}
            </Text>
          )}
        </div>
      );
    }
  }),

  twoLine: <Item extends { id: string }>(
    opts: ColumnBase & {
      id: string;
      primary: (row: Item) => React.ReactNode;
      secondary?: (row: Item) => React.ReactNode;
    }
  ): TableColumn<Item> => ({
    id: opts.id,
    isDefault: opts.isDefault ?? true,
    header: opts.header ?? 'Name',
    render: row => {
      let secondary = opts.secondary?.(row);

      return (
        <div>
          <Text size="2" weight="strong">
            {opts.primary(row)}
          </Text>
          {secondary && (
            <Text size="1" color="gray600">
              {secondary}
            </Text>
          )}
        </div>
      );
    }
  }),

  text: <Item extends { id: string }>(
    opts: ColumnBase & {
      id: string;
      get: (row: Item) => React.ReactNode;
      fallback?: React.ReactNode;
      weight?: 'regular' | 'medium' | 'strong';
    }
  ): TableColumn<Item> => ({
    id: opts.id,
    isDefault: opts.isDefault ?? true,
    header: opts.header ?? opts.id,
    render: row => {
      let value = opts.get(row);
      if (value === null || value === undefined || value === '') {
        return <EmptyValue>{opts.fallback}</EmptyValue>;
      }

      return (
        <Text size="2" weight={opts.weight}>
          {value}
        </Text>
      );
    }
  }),

  date: <Item extends { id: string }>(
    field: keyof Item & string,
    opts: ColumnBase & { fallback?: string } = {}
  ): TableColumn<Item> => ({
    id: opts.id ?? field,
    isDefault: opts.isDefault ?? false,
    header: opts.header ?? field,
    render: row => {
      let value = read(row, field);
      if (!value) return <EmptyValue>{opts.fallback}</EmptyValue>;
      return <RenderDate date={value} />;
    }
  }),

  createdAt: <Item extends { id: string }>(
    opts: ColumnBase & { field?: keyof Item & string } = {}
  ) =>
    col.date<Item>((opts.field ?? 'createdAt') as keyof Item & string, {
      id: 'createdAt',
      header: 'Created',
      isDefault: true,
      ...opts
    }),

  updatedAt: <Item extends { id: string }>(
    opts: ColumnBase & { field?: keyof Item & string } = {}
  ) =>
    col.date<Item>((opts.field ?? 'updatedAt') as keyof Item & string, {
      id: 'updatedAt',
      header: 'Updated',
      isDefault: false,
      ...opts
    }),

  id: <Item extends { id: string }>(opts: ColumnBase = {}): TableColumn<Item> => ({
    id: opts.id ?? 'id',
    isDefault: opts.isDefault ?? false,
    header: opts.header ?? 'ID',
    render: row => <ID id={row.id} />
  }),

  refId: <Item extends { id: string }>(
    id: string,
    get: (row: Item) => string | null | undefined,
    opts: ColumnBase & { copy?: boolean } = {}
  ): TableColumn<Item> => ({
    id,
    isDefault: opts.isDefault ?? false,
    header: opts.header ?? id,
    render: row => {
      let value = get(row);
      return value ? <ID id={value} copy={opts.copy} /> : <EmptyValue />;
    }
  }),

  status: <Item extends { id: string }, V extends string>(
    descriptor: StatusDescriptor<V>,
    opts: ColumnBase & { get?: (row: Item) => string | null | undefined } = {}
  ): TableColumn<Item> => ({
    id: opts.id ?? 'status',
    isDefault: opts.isDefault ?? true,
    header: opts.header ?? 'Status',
    render: row => {
      let value = opts.get ? opts.get(row) : read(row, 'status');
      return value ? <StatusBadge status={value} descriptor={descriptor} /> : <EmptyValue />;
    }
  }),

  count: <Item extends { id: string }>(
    id: string,
    get: (row: Item) => number | null | undefined,
    noun: string,
    opts: ColumnBase & { zero?: React.ReactNode } = {}
  ): TableColumn<Item> => ({
    id,
    isDefault: opts.isDefault ?? true,
    header: opts.header ?? id,
    render: row => {
      let count = get(row) ?? 0;
      if (count == 0 && opts.zero) return <EmptyValue>{opts.zero}</EmptyValue>;
      return <Text size="2">{pluralize(count, noun)}</Text>;
    }
  }),

  custom: <Item extends { id: string }, Props extends {} = any, Ctx = any>(
    opts: ColumnBase & {
      id: string;
      render: (row: Item, props: Props, ctx: Ctx) => React.ReactNode;
    }
  ): TableColumn<Item, Props, Ctx> => ({
    id: opts.id,
    isDefault: opts.isDefault ?? true,
    header: opts.header ?? opts.id,
    render: opts.render
  })
};
