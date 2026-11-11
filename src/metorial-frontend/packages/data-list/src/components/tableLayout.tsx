import { Button, Checkbox, Menu, Text, theme } from '@metorial/ui';
import { RiArrowDownSLine, RiMore2Line } from '@remixicon/react';
import React, { Fragment } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { styled } from 'styled-components';
import type { DataListController } from '../controller';

let TableWrapper = styled('div')`
  overflow-x: auto;
  width: 100%;
  position: relative;
  flex-grow: 1;
`;

let Table = styled('table')`
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
`;

let TableRow = styled('tr').withConfig({
  shouldForwardProp: prop => prop != 'sidePadding' && prop != '$isInteractive'
})<{ sidePadding?: number; $isInteractive?: boolean }>`
  user-select: none;
  cursor: ${p => (p.$isInteractive ? 'pointer' : 'default')};

  ${p =>
    typeof p.sidePadding == 'number'
      ? `
    & > td,
    & > th {
      &:first-of-type {
        padding-left: ${p.sidePadding}px;
      }

      &:last-of-type {
        padding-right: ${p.sidePadding}px;
      }
    }
  `
      : ''}

  &:not(:last-child) {
    & > td,
    & > th {
      border-bottom: 1px solid ${theme.colors.gray300};
    }
  }
`;

let TableCell = styled('td')`
  padding: 0;
  text-align: left;
`;

let TableSelectCell = styled(TableCell)`
  background: ${theme.colors.background};
  position: sticky;
  left: 0;
`;

let TableActionsCell = styled(TableCell)`
  background: ${theme.colors.background};
  position: sticky;
  right: 0;
`;

let TableHeaderCell = styled('th')`
  border-bottom: 2px solid ${theme.colors.gray300};
  padding: 0;
  font-size: 13px;
  font-weight: 600;
  color: ${theme.colors.gray800};
  text-align: left;
`;

let TableCellInner = styled('div')`
  min-height: 42px;
  padding: 5px 4px;
  display: flex;
  align-items: center;
  white-space: nowrap;
  font-size: 12px;
  color: ${theme.colors.foreground};
`;

let TableLink = styled(Link)`
  display: block;
  color: ${theme.colors.foreground};
  text-decoration: none;
`;

let isInteractiveElement = (target: EventTarget | null) => {
  if (!(target instanceof HTMLElement)) return false;

  return !!target.closest(
    'a, button, input, textarea, select, summary, [role="button"], [role="menuitem"]'
  );
};

export let DataListTableLayout = ({
  controller,
  emptyMessage,
  sidePadding
}: {
  controller: DataListController;
  emptyMessage: string;
  sidePadding?: number;
}) => {
  let {
    config,
    props,
    ctx,
    state,
    currentColumns,
    selectedItems,
    setSelectedItems,
    openRowPanel,
    bulkEntries,
    hasRowActions: hasMenuActions,
    loadingIds,
    getRowMenu,
    getHref,
    handleRowClick
  } = controller;

  let navigate = useNavigate();

  let hasBulkActions = bulkEntries.length > 0;
  let hasRowActions = hasMenuActions || !!config.link;
  let allSelected = state.items.length > 0 && selectedItems.length == state.items.length;

  let selectedBackground = (id: string) =>
    selectedItems.includes(id) ? theme.colors.gray100 : theme.colors.background;

  return (
    <TableWrapper>
      <Table>
        <thead>
          <TableRow sidePadding={sidePadding}>
            {config.rowPanel && <TableHeaderCell />}

            {hasBulkActions && (
              <TableSelectCell
                as="th"
                style={{ width: '20px', borderBottom: `2px solid ${theme.colors.gray300}` }}
              >
                <TableCellInner>
                  <Checkbox
                    label="Select all"
                    hideLabel
                    checked={allSelected}
                    onCheckedChange={checked =>
                      setSelectedItems(checked ? state.items.map(i => i.id) : [])
                    }
                  />
                </TableCellInner>
              </TableSelectCell>
            )}

            {currentColumns.map(column => (
              <TableHeaderCell key={column.id}>
                <TableCellInner>{column.header}</TableCellInner>
              </TableHeaderCell>
            ))}

            {hasRowActions && <TableHeaderCell style={{ width: '26px' }} />}
          </TableRow>
        </thead>

        <tbody>
          {state.items.map(row => {
            let to = getHref(row);
            let menu = getRowMenu(row);
            let isRowInteractive =
              !!config.clickable || !!props.onItemClick || !!config.rowPanel;

            return (
              <Fragment key={`wrapper-${row.id}`}>
                <TableRow
                  sidePadding={sidePadding}
                  $isInteractive={isRowInteractive}
                  onClick={e => {
                    if (isInteractiveElement(e.target)) return;
                    handleRowClick(e, row);
                  }}
                  style={{
                    background:
                      selectedItems.includes(row.id) || props.selectedItemId == row.id
                        ? theme.colors.gray100
                        : 'none',
                    opacity: loadingIds.includes(row.id) ? 0.5 : 1,
                    transition: 'opacity 0.2s'
                  }}
                >
                  {config.rowPanel && (
                    <TableCell
                      style={{
                        width: '16px',
                        background: selectedBackground(row.id),
                        transition: 'all .3s'
                      }}
                    >
                      <TableCellInner>
                        <RiArrowDownSLine size={14} style={{ color: theme.colors.gray600 }} />
                      </TableCellInner>
                    </TableCell>
                  )}

                  {hasBulkActions && (
                    <TableSelectCell
                      style={{
                        width: '20px',
                        background: selectedBackground(row.id),
                        transition: 'all .3s'
                      }}
                    >
                      <TableCellInner>
                        <Checkbox
                          label="Select row"
                          hideLabel
                          checked={selectedItems.includes(row.id)}
                          onCheckedChange={checked =>
                            setSelectedItems(current =>
                              checked ? [...current, row.id] : current.filter(i => i != row.id)
                            )
                          }
                        />
                      </TableCellInner>
                    </TableSelectCell>
                  )}

                  {currentColumns.map(column => {
                    let cell = (
                      <TableCellInner>{column.render(row, props, ctx)}</TableCellInner>
                    );

                    return (
                      <TableCell key={column.id}>
                        {to ? <TableLink to={to}>{cell}</TableLink> : cell}
                      </TableCell>
                    );
                  })}

                  {hasRowActions && (
                    <TableActionsCell
                      style={{
                        width: '26px',
                        background: selectedBackground(row.id),
                        transition: 'all .3s'
                      }}
                    >
                      <TableCellInner>
                        <Menu
                          items={[
                            ...(to ? [{ id: '$$open$$', label: 'Open' }] : []),
                            ...menu.map(item => ({
                              id: item.id,
                              label: item.label,
                              disabled: item.disabled
                            }))
                          ]}
                          onItemClick={id => {
                            if (id == '$$open$$') return navigate(to!);
                            menu.find(item => item.id == id)?.onClick();
                          }}
                        >
                          <Button size="1" variant="outline" iconLeft={<RiMore2Line />} />
                        </Menu>
                      </TableCellInner>
                    </TableActionsCell>
                  )}
                </TableRow>

                {config.rowPanel && openRowPanel.includes(row.id) && (
                  <TableRow sidePadding={sidePadding}>
                    <TableCell
                      colSpan={
                        currentColumns.length +
                        1 +
                        (hasBulkActions ? 1 : 0) +
                        (hasRowActions ? 1 : 0)
                      }
                    >
                      <TableCellInner>{config.rowPanel(row)}</TableCellInner>
                    </TableCell>
                  </TableRow>
                )}
              </Fragment>
            );
          })}

          {state.items.length == 0 && !state.isLoading && (
            <TableRow sidePadding={sidePadding}>
              <TableCell
                colSpan={
                  currentColumns.length + (hasBulkActions ? 1 : 0) + (hasRowActions ? 1 : 0)
                }
              >
                <TableCellInner
                  style={{
                    padding: '20px',
                    justifyContent: 'center',
                    alignItems: 'center'
                  }}
                >
                  <Text size="1" color="gray800" align="center">
                    {emptyMessage}
                  </Text>
                </TableCellInner>
              </TableCell>
            </TableRow>
          )}
        </tbody>
      </Table>
    </TableWrapper>
  );
};
