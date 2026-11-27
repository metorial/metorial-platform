import { RiDeleteBinLine } from '@remixicon/react';
import React from 'react';
import type { DataListItemAction } from '../types';

export let defineAction = <Item extends { id: string }, Props = any, Ctx = any>(
  action: DataListItemAction<Item, Props, Ctx>
) => action;

type Mutate = { mutate: (input: any) => Promise<readonly [unknown, unknown] | unknown> };

export let deleteAction = <Item extends { id: string }, Props = any, Ctx = any>(opts: {
  noun: string;
  useMutate: (args: { props: Props; ctx: Ctx }) => Mutate;
  input: (row: Item, args: { props: Props; ctx: Ctx }) => unknown;
  name?: (row: Item) => string | null | undefined;
  disabled?: (row: Item) => boolean;
  hidden?: (row: Item) => boolean;
  id?: string;
  label?: string;
  batchSize?: number;
  bulk?: boolean;
}): DataListItemAction<Item, Props, Ctx> => ({
  id: opts.id ?? 'delete',
  label: opts.label ?? 'Delete',
  icon: <RiDeleteBinLine />,
  row: true,
  bulk: opts.bulk === false ? false : { batchSize: opts.batchSize ?? 10 },
  destructive: true,
  disabled: opts.disabled,
  hidden: opts.hidden,
  confirm: {
    title: `Delete ${opts.noun}`,
    confirmText: 'Delete',
    description: rows => {
      if (rows.length > 1) {
        return `Are you sure you want to delete ${rows.length} ${opts.noun.toLowerCase()}s?`;
      }

      let name = opts.name?.(rows[0]!);
      return `Are you sure you want to delete ${name || `this ${opts.noun.toLowerCase()}`}?`;
    }
  },
  useRun: args => {
    let mutator = opts.useMutate(args);

    return async row => {
      let result = await mutator.mutate(opts.input(row, args));

      if (Array.isArray(result) && result[1]) throw result[1];
    };
  }
});
