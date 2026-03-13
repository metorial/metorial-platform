import { Button, SortableCheckList, Title, theme } from '@metorial/ui';
import * as RadixPopover from '@radix-ui/react-popover';
import { RiTableView } from '@remixicon/react';
import React, { memo, useMemo, useState } from 'react';
import { keyframes, styled } from 'styled-components';
import { Observer, useObserver } from '../state';
import { TableColumn } from '../type';

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

let Wrapper = styled('div')`
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px;
`;

let ColumnPopover = styled(RadixPopover.Content)`
  background: ${theme.colors.background};
  border: 1px solid ${theme.colors.gray300};
  border-radius: 10px;
  box-shadow: ${theme.shadows.medium};
  z-index: 9999;
  width: 300px;
  max-height: 400px;
  overflow-y: auto;

  &[data-state='open'] {
    animation: ${fadeIn} 0.15s ease-in-out;
  }

  &[data-state='closed'] {
    animation: ${fadeOut} 0.15s ease-in-out;
  }
`;

let ColumnContent = styled('div')`
  display: flex;
  flex-direction: column;
`;

let ColumnContentHeader = styled('div')`
  padding: 14px 20px;
  border-bottom: 1px solid ${theme.colors.gray300};
  position: sticky;
  top: 0;
  background: ${theme.colors.background};
  z-index: 999;
`;

let ColumnContentBody = styled('main')`
  padding: 15px 20px;
  flex-grow: 1;
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
      <Wrapper>
        <RadixPopover.Root open={open} onOpenChange={setOpen}>
          <RadixPopover.Trigger asChild>
            <Button iconLeft={<RiTableView />} size="2" variant="outline">
              Columns
            </Button>
          </RadixPopover.Trigger>

          <RadixPopover.Portal>
            <ColumnPopover sideOffset={5}>
              <ColumnContent>
                <ColumnContentHeader>
                  <Title as="h1" size="2" weight="bold">
                    Customize Table
                  </Title>
                </ColumnContentHeader>
                <ColumnContentBody>
                  <SortableCheckList
                    items={items}
                    onChange={items => {
                      layoutObserver.notify(
                        items.map(({ id, isChecked }) => ({ id, isSelected: isChecked }))
                      );
                    }}
                  />
                </ColumnContentBody>
              </ColumnContent>
            </ColumnPopover>
          </RadixPopover.Portal>
        </RadixPopover.Root>
      </Wrapper>
    );
  }
);
