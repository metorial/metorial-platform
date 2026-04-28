import { usePaginationSearchParamsEnabled } from '@metorial/data-hooks';
import { memo } from '@lowerdeck/memo';
import {
  Button,
  CenteredSpinner,
  Checkbox,
  Error,
  Input,
  Menu,
  Spacer,
  Text,
  theme,
  useIsGroup
} from '@metorial/ui';
import { RiArrowDownSLine, RiMore2Line } from '@remixicon/react';
import { AnimatePresence, motion } from 'framer-motion';
import React, { Fragment, memo as reactMemo, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { styled } from 'styled-components';
import { TableFilter, TableFilterState, getFilterPayload } from '../filter';
import { Observer, useObserver } from '../state';
import {
  TableActions,
  TableClickable,
  TableColumn,
  TableItemAction,
  TableStateProvider,
  TableStateProviderResult
} from '../type';
import { Columns } from './columns';
import { TableFilters } from './filter';
import { useFilterQuery } from './query';

let Wrapper = styled('div')`
  display: flex;
  flex-direction: column;
  width: 100%;
  flex-grow: 1;
`;

let Header = styled('header')`
  display: flex;
  justify-content: space-between;
  flex-wrap: wrap;
  align-items: center;
  margin-bottom: 2px;
`;

let HeaderSection = styled('section')`
  display: flex;
  align-items: center;
  gap: 10px;
  justify-content: space-between;
  width: 100%;
`;

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

let TableHead = styled('thead')``;

let TableBody = styled('tbody')``;

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

let Footer = styled('footer')`
  display: flex;
  justify-content: space-between;
  width: 100%;
  margin-top: 0px;
  align-items: center;
`;

let ActionBarWrapper = styled('div')`
  position: fixed;
  bottom: 60px;
  left: 0;
  right: 0;
  display: flex;
  justify-content: center;
  pointer-events: none;
`;

let ActionBar = styled(motion.div)`
  background: ${theme.colors.foreground};
  border: 1px solid ${theme.colors.gray300};
  padding: 12px 20px;
  border-radius: 100px;
  max-width: 500px;
  overflow-x: auto;
  box-shadow: ${theme.shadows.small};
  display: flex;
  gap: 10px;
  align-items: center;
  pointer-events: auto;
`;

let RowPanel = (props: { row: any; rowPanel: (row: any) => React.ReactNode }) => {
  return <>{props.rowPanel(props.row)}</>;
};

let chunk = <T,>(items: T[], size: number) => {
  let chunks: T[][] = [];

  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }

  return chunks;
};

let TABLE_LAYOUT_STORAGE_KEY_PREFIX = 'dashboard-table-layout';

let getDefaultLayout = (columns: TableColumn<any, any>[]) => {
  return columns.map(column => ({
    id: column.id,
    isSelected: column.isDefault
  }));
};

let sanitizeLayout = (
  layout: { id: string; isSelected: boolean }[],
  columns: TableColumn<any, any>[]
) => {
  let columnIds = new Set(columns.map(column => column.id));
  let nextLayout: { id: string; isSelected: boolean }[] = [];
  let seenIds = new Set<string>();

  for (let item of layout) {
    if (!columnIds.has(item.id) || seenIds.has(item.id)) continue;

    nextLayout.push({
      id: item.id,
      isSelected: item.isSelected
    });
    seenIds.add(item.id);
  }

  for (let column of columns) {
    if (seenIds.has(column.id)) continue;

    nextLayout.push({
      id: column.id,
      isSelected: column.isDefault
    });
  }

  return nextLayout;
};

let getStoredLayout = (name: string, columns: TableColumn<any, any>[]) => {
  if (typeof window == 'undefined') return getDefaultLayout(columns);

  try {
    let storedValue = window.localStorage.getItem(
      `${TABLE_LAYOUT_STORAGE_KEY_PREFIX}:${name}`
    );
    if (!storedValue) return getDefaultLayout(columns);

    let parsedValue = JSON.parse(storedValue);
    if (!Array.isArray(parsedValue)) return getDefaultLayout(columns);

    let layout = parsedValue.flatMap(item => {
      if (
        typeof item != 'object' ||
        item == null ||
        typeof item.id != 'string' ||
        typeof item.isSelected != 'boolean'
      ) {
        return [];
      }

      return [{ id: item.id, isSelected: item.isSelected }];
    });

    return sanitizeLayout(layout, columns);
  } catch {
    return getDefaultLayout(columns);
  }
};

let isInteractiveElement = (target: EventTarget | null) => {
  if (!(target instanceof HTMLElement)) return false;

  return !!target.closest(
    'a, button, input, textarea, select, summary, [role="button"], [role="menuitem"]'
  );
};

export let TableComponent = reactMemo(
  (props: {
    name: string;
    layoutObserver: Observer<{ id: string; isSelected: boolean }[]>;
    state: TableStateProvider<any, any, TableStateProviderResult<any>>;
    getHookState?: (res: any, input: any) => any;
    columns: TableColumn<any, any>[];
    actions?: TableActions<any, any>;
    rowActions?: TableItemAction<any, any>[];
    bulkActions?: TableItemAction<any, any>[];
    filters?: TableFilter<any>[];
    search?: {
      placeholder: string;
    };
    props: any;
    link?: (item: any, stateProps: any) => string | null | undefined;
    clickable?: TableClickable<any, any>;
    sidePadding?: number;
    hasPagination: boolean;
    customizable: boolean;
    rowPanel?: (row: any) => React.ReactNode;
    emptyState?: (() => React.ReactNode) | string;
    onItemClick?: (item: any) => void;
    selectedItemId?: string;
    headerActions?: (d: { filter: any; search?: string }) => React.ReactNode;
  }) => {
    let filterState = useState([] as TableFilterState[]);
    let filterPayload = useMemo(() => getFilterPayload(filterState[0]), [filterState[0]]);
    let [hasHydratedLayout, setHasHydratedLayout] = useState(false);

    let isGroup = useIsGroup();
    let sidePadding = isGroup ? 10 : props.sidePadding;

    let [search, setSearch] = useState('');
    let [debouncedSearch, setDebouncedSearch] = useState('');

    useEffect(() => {
      let to = setTimeout(() => {
        setDebouncedSearch(search);
      }, 300);

      return () => clearTimeout(to);
    }, [search]);

    useFilterQuery({
      filters: props.filters,
      filterState,
      searchState: [search, setSearch],
      debouncedSearch
    });

    let state = props.state(props.props, {
      filter: filterPayload,
      search: debouncedSearch || undefined
    });
    let hookState = props.getHookState ? props.getHookState(state, props.props) : {};
    let loadingIds: string[] | undefined = hookState.loadingIds;

    let layout = useObserver(props.layoutObserver);

    useEffect(() => {
      props.layoutObserver.notify(getStoredLayout(props.name, props.columns));
      setHasHydratedLayout(true);
    }, [props.columns, props.layoutObserver, props.name]);

    useEffect(() => {
      if (!hasHydratedLayout || typeof window == 'undefined' || !layout) return;

      try {
        window.localStorage.setItem(
          `${TABLE_LAYOUT_STORAGE_KEY_PREFIX}:${props.name}`,
          JSON.stringify(sanitizeLayout(layout, props.columns))
        );
      } catch {}
    }, [hasHydratedLayout, layout, props.columns, props.name]);

    let currentColumns = useMemo(
      () =>
        layout
          ? layout
              .filter(c => c.isSelected)
              .map(c => props.columns.find(col => col.id == c.id)!)
          : [],
      [layout, props.columns]
    );

    let [selectedItems, setSelectedItems] = useState<string[]>([]);
    let allSelected = state.items.length > 0 && selectedItems.length == state.items.length;

    useEffect(() => {
      let items = selectedItems.filter(id => state.items.find(i => i.id == id));
      if (items.length != selectedItems.length) setSelectedItems(items);
    }, [state.items]);

    let hasBulkActions = props.bulkActions && props.bulkActions.length > 0;
    let hasRowActions = (props.rowActions && props.rowActions.length > 0) || !!props.link;

    let [initialLoading, setInitialLoading] = useState(true);
    useEffect(() => {
      if (!state.isLoading) setInitialLoading(false);
    }, [state.isLoading]);

    let link = useMemo(
      () => (props.link ? memo(props.link) || undefined : undefined),
      [props.link]
    );

    let isFullLoading = initialLoading && state.isLoading;
    let navigate = useNavigate();
    let paginationSearchParamsEnabled = usePaginationSearchParamsEnabled();
    let [, setSearchParams] = useSearchParams();

    let hasHeader =
      !!props.search ||
      !!props.headerActions ||
      (props.filters && props.filters.length > 0) ||
      props.customizable;

    let [openRowPanel, setOpenRowPanel] = useState<string[]>([]);
    let [runningBulkActionId, setRunningBulkActionId] = useState<string | null>(null);

    let goToPreviousPage = () => {
      let firstItem = state.items[0];
      if (!firstItem) return;

      if (paginationSearchParamsEnabled) {
        setSearchParams(
          currentSearchParams => {
            let nextSearchParams = new URLSearchParams(currentSearchParams);
            nextSearchParams.set('before', firstItem.id);
            nextSearchParams.delete('after');
            return nextSearchParams;
          },
          { replace: true }
        );
      }

      state.loadPrevious();
    };

    let goToNextPage = () => {
      let lastItem = state.items[state.items.length - 1];
      if (!lastItem) return;

      if (paginationSearchParamsEnabled) {
        setSearchParams(
          currentSearchParams => {
            let nextSearchParams = new URLSearchParams(currentSearchParams);
            nextSearchParams.set('after', lastItem.id);
            nextSearchParams.delete('before');
            return nextSearchParams;
          },
          { replace: true }
        );
      }

      state.loadNext();
    };

    let runTableAction = async (action: TableItemAction<any, any>, rows: any[]) => {
      if (!props.actions) return;

      if (action.bulkExecution?.mode === 'per-row') {
        let batchSize = action.bulkExecution.batchSize ?? 10;

        for (let batch of chunk(rows, batchSize)) {
          await Promise.allSettled(
            batch.map(row => props.actions![action.action as string]([row], hookState))
          );
        }

        return;
      }

      await props.actions[action.action as string](rows, hookState);
    };

    let hasActiveSearch = search.trim().length > 0 || debouncedSearch.trim().length > 0;
    let hasActiveFilters = filterState[0].length > 0;

    if (
      state.items.length == 0 &&
      !hasActiveFilters &&
      !hasActiveSearch &&
      !state.isLoading &&
      !state.error &&
      !state.hasMoreBefore &&
      typeof props.emptyState == 'function'
    ) {
      return (
        <Wrapper>
          <props.emptyState />
        </Wrapper>
      );
    }

    return (
      <Wrapper>
        {hasHeader && (
          <Header
            style={{
              paddingLeft: sidePadding,
              paddingRight: sidePadding,

              paddingTop: isGroup ? 10 : 0
            }}
          >
            <HeaderSection>
              {props.search && (
                <div style={{ width: 350, maxWidth: '100%', flexGrow: 0, flexShrink: 0 }}>
                  <Input
                    label="Search"
                    hideLabel
                    size="2"
                    placeholder={props.search.placeholder}
                    value={search}
                    onInput={v => setSearch(v)}
                  />
                </div>
              )}

              {props.filters && props.filters.length > 0 && (
                <TableFilters filters={props.filters} filterState={filterState} />
              )}

              <Spacer />

              <Columns columns={props.columns} layoutObserver={props.layoutObserver} />

              {props.headerActions && (
                <props.headerActions filter={filterPayload} search={debouncedSearch} />
              )}
            </HeaderSection>
          </Header>
        )}

        {isFullLoading && (
          <div style={{ padding: '10px 0px' }}>
            <CenteredSpinner />
          </div>
        )}

        {state.error && (
          <>
            <Spacer height={10} />
            <Error>
              {state.error.data?.message ?? state.error.message ?? 'An error occurred'}
            </Error>
          </>
        )}

        {!isFullLoading && !state.error && (
          <>
            <TableWrapper
              style={{
                opacity: state.isLoading ? 0.3 : 1,
                transition: 'opacity 0.2s'
              }}
            >
              <AnimatePresence>
                {state.isLoading && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      right: 0,
                      bottom: 0,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      zIndex: 1
                    }}
                  >
                    <motion.div
                      initial={{ scale: 0.5 }}
                      animate={{ scale: 1 }}
                      transition={{ duration: 0.2 }}
                    >
                      <CenteredSpinner />
                    </motion.div>
                  </motion.div>
                )}
              </AnimatePresence>

              <Table>
                <TableHead>
                  <TableRow sidePadding={sidePadding}>
                    {props.rowPanel && <TableHeaderCell />}

                    {hasBulkActions && (
                      <TableSelectCell
                        as="th"
                        style={{
                          width: '20px',
                          borderBottom: `2px solid ${theme.colors.gray300}`
                        }}
                      >
                        <TableCellInner>
                          <Checkbox
                            label="Select all"
                            hideLabel
                            checked={allSelected}
                            onCheckedChange={checked => {
                              if (checked) {
                                setSelectedItems(state.items.map(i => i.id));
                              } else {
                                setSelectedItems([]);
                              }
                            }}
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
                </TableHead>

                <TableBody>
                  {state.items.map((row, i) => {
                    let to = link?.(row, props.props);
                    let isRowInteractive =
                      !!props.clickable || !!props.onItemClick || !!props.rowPanel;

                    return (
                      <Fragment key={`wrapper-${row.id}`}>
                        <TableRow
                          sidePadding={sidePadding}
                          $isInteractive={isRowInteractive}
                          key={row.id}
                          onClick={e => {
                            if (isInteractiveElement(e.target)) {
                              return;
                            }

                            props.onItemClick?.(row);

                            if (e.shiftKey) {
                              let current = state.items.findIndex(i => i.id == row.id);
                              let last = state.items.findIndex(i => i.id == selectedItems[0]);

                              if (last == -1) {
                                setSelectedItems([row.id]);
                              } else {
                                let start = Math.min(current, last);
                                let end = Math.max(current, last);

                                setSelectedItems(
                                  state.items.slice(start, end + 1).map(i => i.id)
                                );
                              }
                            } else if (e.ctrlKey) {
                              if (selectedItems.includes(row.id)) {
                                setSelectedItems(selectedItems.filter(i => i != row.id));
                              } else {
                                setSelectedItems([...selectedItems, row.id]);
                              }
                            } else {
                              props.clickable?.(row, props.props);

                              if (props.rowPanel) {
                                setOpenRowPanel(p => {
                                  if (p.includes(row.id)) return p.filter(id => id != row.id);
                                  return [...p, row.id];
                                });
                              }
                            }
                          }}
                          style={{
                            background:
                              selectedItems.includes(row.id) || props.selectedItemId == row.id
                                ? theme.colors.gray100
                                : 'none',
                            opacity: loadingIds?.includes(row.id) ? 0.5 : 1,
                            transition: 'opacity 0.2s'
                          }}
                        >
                          {props.rowPanel && (
                            <TableCell
                              style={{
                                width: '16px',
                                background: selectedItems.includes(row.id)
                                  ? theme.colors.gray100
                                  : theme.colors.background,
                                transition: 'all .3s'
                              }}
                            >
                              <TableCellInner>
                                <RiArrowDownSLine
                                  size={14}
                                  style={{ color: theme.colors.gray600 }}
                                />
                              </TableCellInner>
                            </TableCell>
                          )}

                          {hasBulkActions && (
                            <TableSelectCell
                              style={{
                                width: '20px',
                                background: selectedItems.includes(row.id)
                                  ? theme.colors.gray100
                                  : theme.colors.background,
                                transition: 'all .3s'
                              }}
                            >
                              <TableCellInner>
                                <Checkbox
                                  label="Select row"
                                  hideLabel
                                  checked={selectedItems.includes(row.id)}
                                  onCheckedChange={checked => {
                                    if (checked) {
                                      setSelectedItems([...selectedItems, row.id]);
                                    } else {
                                      setSelectedItems(selectedItems.filter(i => i != row.id));
                                    }
                                  }}
                                />
                              </TableCellInner>
                            </TableSelectCell>
                          )}

                          {currentColumns.map(column => (
                            <TableCell key={column.id}>
                              {to ? (
                                <TableLink to={to}>
                                  <TableCellInner>
                                    {column.render(row, props.props)}
                                  </TableCellInner>
                                </TableLink>
                              ) : (
                                <TableCellInner>
                                  {column.render(row, props.props)}
                                </TableCellInner>
                              )}
                            </TableCell>
                          ))}

                          {hasRowActions && (
                            <TableActionsCell
                              style={{
                                width: '26px',
                                background: selectedItems.includes(row.id)
                                  ? theme.colors.gray100
                                  : theme.colors.background,
                                transition: 'all .3s'
                              }}
                            >
                              <TableCellInner>
                                <Menu
                                  items={[
                                    ...(to ? [{ id: '$$open$$', label: 'Open' }] : []),
                                    ...(props.rowActions ?? []).map(action => ({
                                      id: action.id,
                                      label: action.label,
                                      disabled: action.disabled?.(row)
                                    }))
                                  ]}
                                  onItemClick={id => {
                                    if (id == '$$open$$') return navigate(to!);

                                    let rowAction = props.rowActions?.find(a => a.id == id);
                                    if (!rowAction) return;
                                    void runTableAction(rowAction, [row]);
                                  }}
                                >
                                  <Button
                                    size="1"
                                    variant="outline"
                                    iconLeft={<RiMore2Line />}
                                  />
                                </Menu>
                              </TableCellInner>
                            </TableActionsCell>
                          )}
                        </TableRow>

                        {props.rowPanel && openRowPanel.includes(row.id) && (
                          <TableRow sidePadding={sidePadding}>
                            <TableCell
                              colSpan={currentColumns.length + 1 + (hasRowActions ? 1 : 0)}
                            >
                              <TableCellInner>
                                <RowPanel row={row} rowPanel={props.rowPanel!} />
                              </TableCellInner>
                            </TableCell>
                          </TableRow>
                        )}
                      </Fragment>
                    );
                  })}

                  {state.items.length == 0 && (
                    <TableRow sidePadding={sidePadding}>
                      <TableCell
                        colSpan={
                          currentColumns.length +
                          (hasBulkActions ? 1 : 0) +
                          (hasRowActions ? 1 : 0)
                        }
                      >
                        <TableCellInner
                          style={{
                            padding: '20px',
                            display: 'flex',
                            justifyContent: 'center',
                            alignItems: 'center'
                          }}
                        >
                          <Text size="1" color="gray800" align="center">
                            {state.hasMoreBefore
                              ? 'You have reached the end of this list'
                              : typeof props.emptyState == 'string'
                                ? props.emptyState
                                : 'No items found matching your criteria'}
                          </Text>
                        </TableCellInner>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableWrapper>

            {props.hasPagination && (
              <Footer
                style={{
                  padding: `10px ${sidePadding ? sidePadding + 5 : 0}px`,
                  borderTop: isGroup ? `1px solid ${theme.colors.gray300}` : 'none'
                }}
              >
                <Text size="1" color="gray700" weight="medium">
                  Showing {state.items.length} item{state.items.length == 1 ? '' : 's'}
                </Text>

                <div style={{ display: 'flex', gap: 5 }}>
                  <Button
                    size="1"
                    variant="outline"
                    disabled={!state.hasMoreBefore}
                    onClick={goToPreviousPage}
                  >
                    Previous
                  </Button>

                  <Button
                    size="1"
                    variant="outline"
                    disabled={!state.hasMoreAfter}
                    onClick={goToNextPage}
                  >
                    Next
                  </Button>
                </div>
              </Footer>
            )}

            <ActionBarWrapper>
              <AnimatePresence>
                {selectedItems.length > 0 && (
                  <ActionBar
                    initial={{ opacity: 0, scale: 0.5 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.5 }}
                    transition={{
                      duration: 0.4,
                      type: 'spring',
                      ease: 'easeInOut',
                      bounce: 0.35
                    }}
                  >
                    <Text size="1" color="gray400" weight="medium">
                      {selectedItems.length == 1 ? (
                        <>
                          <strong>1</strong> item selected
                        </>
                      ) : (
                        <>
                          <strong>{selectedItems.length}</strong> items selected
                        </>
                      )}
                    </Text>

                    {props.bulkActions!.map(action => (
                      <Button
                        key={action.id}
                        onClick={async () => {
                          let selected = state.items.filter(i => selectedItems.includes(i.id));

                          if (action.disabled) {
                            selected = selected.filter(r => !action.disabled!(r));
                          }

                          if (selected.length == 0) return;

                          setRunningBulkActionId(action.id);

                          try {
                            await runTableAction(action, selected);
                            setSelectedItems([]);
                          } finally {
                            setRunningBulkActionId(current =>
                              current == action.id ? null : current
                            );
                          }
                        }}
                        size="1"
                        loading={runningBulkActionId == action.id}
                        disabled={runningBulkActionId !== null}
                      >
                        {action.label}
                      </Button>
                    ))}

                    <Button
                      onClick={() => {
                        setSelectedItems([]);
                      }}
                      size="1"
                      disabled={runningBulkActionId !== null}
                    >
                      Clear selection
                    </Button>
                  </ActionBar>
                )}
              </AnimatePresence>
            </ActionBarWrapper>
          </>
        )}
      </Wrapper>
    );
  }
);
