import { FilterBarAction, FilterPopover } from '@metorial/filter-bar';
import { SortableCheckList, theme } from '@metorial/ui';
import { RiLayoutColumnLine } from '@remixicon/react';
import React, { memo, useMemo, useState } from 'react';
import { styled } from 'styled-components';
import { Observer, useObserver } from '../state';
import { TableColumn } from '../types';

let Header = styled('div')`
  padding: 10px 14px 8px;
  font-size: 12px;
  font-weight: 600;
  color: ${theme.colors.gray700};
  border-bottom: 1px solid ${theme.colors.gray300};
  background: ${theme.colors.gray100};
`;

let Body = styled('div')`
  padding: 6px 14px;
  overflow-y: auto;
  max-height: 340px;
  overscroll-behavior: contain;
`;

export let Columns = memo(
  ({
    columns,
    layoutObserver
  }: {
    columns: TableColumn<any, any>[];
    layoutObserver: Observer<{ id: string; isSelected: boolean }[]>;
  }) => {
    let layout = useObserver(layoutObserver) ?? [];
    let [open, setOpen] = useState(false);

    let items = useMemo(() => {
      let items: { id: string; label: React.ReactNode; isChecked: boolean }[] = [];

      for (let c of layout) {
        let column = columns.find(column => column.id == c.id);

        if (column) {
          items.push({
            id: column.id,
            label: column.header,
            isChecked: c.isSelected
          });
        }
      }

      return items;
    }, [columns, layout]);

    return (
      <FilterPopover
        open={open}
        onOpenChange={setOpen}
        align="end"
        width={260}
        label="Columns"
        trigger={
          <FilterBarAction
            label="Columns"
            icon={<RiLayoutColumnLine size={16} />}
            active={open}
          />
        }
      >
        <Header>Columns</Header>

        <Body>
          <SortableCheckList
            items={items}
            onChange={items => {
              layoutObserver.notify(
                items.map(({ id, isChecked }) => ({ id, isSelected: isChecked }))
              );
            }}
          />
        </Body>
      </FilterPopover>
    );
  }
);
